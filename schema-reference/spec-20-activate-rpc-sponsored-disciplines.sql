-- ============================================================
-- SCHEMA REFERENCE — Spec 20: sponsored credits limited to the
-- candidate's assigned disciplines
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor. Run as a single statement.
--
-- SUPERSEDES spec-15-activate-rpc.sql. Identical except:
--   * new parameter p_allow_sponsored BOOLEAN DEFAULT TRUE (9th arg)
--   * step 1c: when FALSE, only purchased credits are spendable and the
--     debit is always attributed to 'purchase'
--   * new failure code 'sponsored_not_allowed' — the candidate holds
--     credits, but none they can use on this discipline
--
-- Why: sponsor-code credits are fungible, so a candidate could spend a
-- partner's sponsored credits on disciplines that partner never assigned
-- them (reported 2026-11-02). Purchased credits stay usable anywhere —
-- a candidate may pay to take, or retry, any simulation.
--
-- The default TRUE keeps the old 8-arg call shape working, so this can be
-- applied BEFORE the app deploy that starts passing the flag. Apply it
-- before merging the Spec 20 branch: the new app code passes
-- p_allow_sponsored and would fail against the old function.
--
-- Changing the argument list creates an overload rather than replacing,
-- so the 8-arg signature is dropped first.
-- ============================================================

DROP FUNCTION IF EXISTS public.activate_simulation(UUID, UUID, UUID, TEXT, UUID, INET, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.activate_simulation(
  p_candidate_id      UUID,
  p_simulation_id     UUID,
  p_partner_id        UUID,
  p_terms_version     TEXT,
  p_cohort_id         UUID    DEFAULT NULL,
  p_ip_address        INET    DEFAULT NULL,
  p_immediate_consent BOOLEAN DEFAULT FALSE,
  p_user_agent        TEXT    DEFAULT NULL,
  p_allow_sponsored   BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sim_type        TEXT;
  v_attempt         INTEGER;
  v_terms_exist     BOOLEAN;
  v_cohort_balance  INTEGER := 0;
  v_fungible_balance INTEGER := 0;
  v_spend_cohort_id UUID;       -- NULL = spend from fungible, non-NULL = spend from cohort
  v_debited_reason  TEXT;       -- 'code_redemption' | 'purchase' — which grant type this debit draws down
  v_code_granted    INTEGER := 0;
  v_code_debited    INTEGER := 0;
  v_purchase_granted INTEGER := 0;
  v_purchase_debited INTEGER := 0;
  v_ledger_id       UUID;
  v_purchase_left   INTEGER := 0;   -- Spec 20: purchased credits still unspent
  v_had_balance     BOOLEAN := FALSE;
  v_activation_id   UUID;
BEGIN

  -- ── 1. Guard: simulation must exist ──
  SELECT simulation_type
  INTO   v_sim_type
  FROM   simulations
  WHERE  id = p_simulation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'simulation_not_found');
  END IF;

  -- ── 1b. Balance check, moved ahead of the Practice-Trial gate below ──
  -- A Practice Trial is free and unassessed by default (Spec 14 decision 2 —
  -- no entitlement/credit check). But a candidate who already holds a
  -- credit may choose to spend it to run this same simulation through the
  -- full assessed path instead: real simulation_activations row, AI
  -- evaluation, verdict band, counts toward a credential — same as any
  -- paid simulation. A candidate with no credit still gets routed to the
  -- free flow, which never calls this RPC at all.
  IF p_cohort_id IS NOT NULL THEN
    SELECT COALESCE(SUM(delta), 0)
    INTO   v_cohort_balance
    FROM   credit_ledger
    WHERE  candidate_id = p_candidate_id
      AND  cohort_id    = p_cohort_id;
  END IF;

  SELECT COALESCE(SUM(delta), 0)
  INTO   v_fungible_balance
  FROM   credit_ledger
  WHERE  candidate_id = p_candidate_id
    AND  cohort_id IS NULL;

  -- ── 1c. Spec 20: sponsored credits only cover the candidate's own disciplines ──
  -- p_allow_sponsored = FALSE when the candidate has no active entitlement
  -- for this simulation's discipline from their provisioning partner (the
  -- caller, POST /api/candidate/activate, resolves this). Then only credits
  -- the candidate PURCHASED are spendable: cohort credits are always
  -- sponsor-code credits, and fungible balance is capped at what remains
  -- of their purchases.
  IF NOT p_allow_sponsored THEN
    v_had_balance := (v_cohort_balance > 0 OR v_fungible_balance > 0);

    SELECT COALESCE(SUM(delta), 0) INTO v_purchase_granted
    FROM   credit_ledger
    WHERE  candidate_id = p_candidate_id
      AND  reason       = 'purchase'
      AND  cohort_id IS NULL;

    SELECT COALESCE(SUM(-delta), 0) INTO v_purchase_debited
    FROM   credit_ledger
    WHERE  candidate_id   = p_candidate_id
      AND  reason         = 'activation'
      AND  debited_reason = 'purchase'
      AND  cohort_id IS NULL;

    v_purchase_left    := v_purchase_granted - v_purchase_debited;
    v_cohort_balance   := 0;
    v_fungible_balance := GREATEST(LEAST(v_fungible_balance, v_purchase_left), 0);

    IF v_fungible_balance = 0 AND v_had_balance AND v_sim_type <> 'practice' THEN
      RETURN jsonb_build_object('success', false, 'code', 'sponsored_not_allowed');
    END IF;
  END IF;

  IF v_sim_type = 'practice'
     AND NOT ((p_cohort_id IS NOT NULL AND v_cohort_balance > 0) OR v_fungible_balance > 0) THEN
    RETURN jsonb_build_object('success', false, 'code', 'practice_simulation');
  END IF;

  -- ── 2. Determine the next attempt_number for this (candidate, simulation) ──
  SELECT COALESCE(MAX(attempt_number), 0) + 1
  INTO   v_attempt
  FROM   simulation_activations
  WHERE  candidate_id  = p_candidate_id
    AND  simulation_id = p_simulation_id;

  -- ── 3. Terms acceptance ──
  -- If terms already accepted for this version, skip. Otherwise accept now
  -- within this transaction so the legal record is atomic with the credit spend.
  SELECT EXISTS(
    SELECT 1
    FROM   candidate_terms_acceptances
    WHERE  candidate_id  = p_candidate_id
      AND  document_type = 'platform_terms'
      AND  partner_id IS NULL
      AND  version        = p_terms_version
  ) INTO v_terms_exist;

  IF NOT v_terms_exist THEN
    INSERT INTO candidate_terms_acceptances (
      candidate_id, document_type, partner_id, version, ip_address, user_agent, immediate_performance_consent
    ) VALUES (
      p_candidate_id, 'platform_terms', NULL, p_terms_version, p_ip_address, p_user_agent, p_immediate_consent
    );
  END IF;

  -- ── 4. Balance already computed in Step 1b above (read within the
  -- transaction; FOR UPDATE not needed — SERIALIZABLE is not set here, but
  -- the INSERT unique constraint on simulation_activations acts as the
  -- idempotency guard against double-activation on the same attempt). The
  -- race condition this guards against is double-click: both reads would
  -- see balance > 0, but only one INSERT into simulation_activations will
  -- succeed due to UNIQUE(candidate_id, simulation_id, attempt_number). ──

  -- ── 5. Spend rule (Spec 15): cohort first, fall through to fungible ──
  IF p_cohort_id IS NOT NULL AND v_cohort_balance > 0 THEN
    v_spend_cohort_id := p_cohort_id;
  ELSIF v_fungible_balance > 0 THEN
    v_spend_cohort_id := NULL;  -- spend fungible
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'insufficient_balance');
  END IF;

  -- ── 6. Resolve debit origin (fix: credit origin must carry through to
  -- consumption — Spec 18 acceptance criterion 5 / August 2026 handover
  -- "verify before building" #1). GET /api/partner/allocation sums debits
  -- by partner_id; without this, a self-purchased credit's debit is
  -- indistinguishable from a sponsor-code-funded one and over-bills the
  -- sponsoring partner.
  --
  -- A cohort-scoped spend (v_spend_cohort_id IS NOT NULL) is always
  -- code_redemption — only POST /api/candidate/redeem-code ever grants a
  -- cohort-scoped credit; POST /api/webhooks/stripe/:partnerId (Spec 16
  -- purchases) always grants cohort_id = NULL. No ambiguity to resolve.
  --
  -- A fungible spend (v_spend_cohort_id IS NULL) may be backed by either
  -- grant type. Preference order: code_redemption first, purchase second
  -- — a candidate's sponsored allocation is drawn down before their own
  -- money, so credits they paid for personally are the last to be spent.
  -- Remaining balance per origin = granted so far minus already-debited-
  -- against-that-origin, both scoped the same way v_spend_cohort_id was.
  IF NOT p_allow_sponsored THEN
    v_debited_reason := 'purchase';  -- Spec 20: 1c capped the balance to purchases
  ELSIF v_spend_cohort_id IS NOT NULL THEN
    v_debited_reason := 'code_redemption';
  ELSE
    SELECT COALESCE(SUM(delta), 0) INTO v_code_granted
    FROM   credit_ledger
    WHERE  candidate_id = p_candidate_id
      AND  reason       = 'code_redemption'
      AND  cohort_id IS NULL;

    SELECT COALESCE(SUM(-delta), 0) INTO v_code_debited
    FROM   credit_ledger
    WHERE  candidate_id   = p_candidate_id
      AND  reason         = 'activation'
      AND  debited_reason = 'code_redemption'
      AND  cohort_id IS NULL;

    IF (v_code_granted - v_code_debited) > 0 THEN
      v_debited_reason := 'code_redemption';
    ELSE
      SELECT COALESCE(SUM(delta), 0) INTO v_purchase_granted
      FROM   credit_ledger
      WHERE  candidate_id = p_candidate_id
        AND  reason       = 'purchase'
        AND  cohort_id IS NULL;

      SELECT COALESCE(SUM(-delta), 0) INTO v_purchase_debited
      FROM   credit_ledger
      WHERE  candidate_id   = p_candidate_id
        AND  reason         = 'activation'
        AND  debited_reason = 'purchase'
        AND  cohort_id IS NULL;

      IF (v_purchase_granted - v_purchase_debited) > 0 THEN
        v_debited_reason := 'purchase';
      ELSE
        -- Should not happen: v_fungible_balance > 0 passed the balance
        -- check above, so some grant type must have headroom. Fail safe
        -- to code_redemption rather than leave the debit unattributed.
        v_debited_reason := 'code_redemption';
      END IF;
    END IF;
  END IF;

  -- ── 7. Debit credit_ledger ──
  INSERT INTO credit_ledger (
    candidate_id, partner_id, cohort_id, delta, reason, debited_reason
  ) VALUES (
    p_candidate_id, p_partner_id, v_spend_cohort_id, -1, 'activation', v_debited_reason
  )
  RETURNING id INTO v_ledger_id;

  -- ── 8. Create simulation_activations row ──
  -- UNIQUE(candidate_id, simulation_id, attempt_number) catches any concurrent
  -- double-activation: the second INSERT raises unique_violation, caught below.
  INSERT INTO simulation_activations (
    candidate_id, simulation_id, attempt_number, credit_ledger_id, terms_version
  ) VALUES (
    p_candidate_id, p_simulation_id, v_attempt, v_ledger_id, p_terms_version
  )
  RETURNING id INTO v_activation_id;

  -- ── 9. Backfill source_activation_id on the ledger row ──
  -- Closes the circular reference without a FK constraint. Both rows now exist.
  UPDATE credit_ledger
  SET    source_activation_id = v_activation_id
  WHERE  id = v_ledger_id;

  RETURN jsonb_build_object(
    'success',          true,
    'activation_id',    v_activation_id,
    'credit_ledger_id', v_ledger_id,
    'attempt_number',   v_attempt
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent double-click: activation row already exists for this attempt.
    -- The credit_ledger debit was also rolled back by the exception handler.
    RETURN jsonb_build_object('success', false, 'code', 'already_activated');
END;
$$;

-- ── Grant execute to authenticated role ──
-- The API route calls this via the service-role client, which bypasses grants.
-- This grant covers any future direct RPC call from an authenticated session.
GRANT EXECUTE ON FUNCTION public.activate_simulation(UUID, UUID, UUID, TEXT, UUID, INET, BOOLEAN, TEXT, BOOLEAN)
  TO authenticated;
