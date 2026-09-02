-- ============================================================
-- SCHEMA REFERENCE — Spec 18: Atomic Sponsor Code Mint RPC
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor. Run as a single statement.
--
-- Apply AFTER spec-15-assessment-credits.sql and spec-18-sponsor-
-- codes.sql (all columns must exist).
--
-- Why an RPC and not app-layer sequential inserts:
--   1. Concurrency (Spec 18 acceptance criterion 6 — "Concurrent
--      mints by two partner-admins cannot together exceed ceiling
--      plus buffer"). A read-then-write ceiling check in the API
--      route has the same TOCTOU race Spec 15 flagged for activation:
--      two concurrent mints can both read "headroom available" before
--      either writes. FOR UPDATE on the partner_allocations row
--      serializes concurrent mints for the same partner.
--   2. Batch atomicity (edge case: "Unique batch partially fails
--      mid-mint" — the whole batch rolls back, never a partial mint).
--   3. CSPRNG generation must happen once per code with a proper
--      collision-retry, which is cleaner done in the same transaction
--      that reserves the ceiling headroom.
--
-- Handles both code shapes:
--   shared — ONE row, max_redemptions = p_quantity
--   unique — p_quantity rows, each max_redemptions = 1, sharing one
--            batch_id
-- Reserved value is identical either way: p_credits_per_redemption *
-- p_quantity — this is what's checked against remaining ceiling.
--
-- Return shape (JSONB):
--   success = true  → { success, batch_id (unique only), codes: [{id, code}, ...] }
--   success = false → { success, code, shortfall? }
--     codes: 'no_active_allocation' | 'ceiling_exceeded' | 'invalid_shape' |
--            'code_generation_failed'
-- ============================================================

CREATE OR REPLACE FUNCTION public.mint_sponsor_codes(
  p_partner_id             UUID,
  p_shape                  TEXT,      -- 'shared' | 'unique'
  p_label                  TEXT,
  p_prefix                 TEXT,      -- uppercase, caller-validated <=8 chars
  p_credits_per_redemption INTEGER,
  p_quantity               INTEGER,   -- redemptions (shared) or code count (unique)
  p_cohort_id              UUID    DEFAULT NULL,
  p_expires_at             TIMESTAMPTZ DEFAULT NULL,
  p_note                   TEXT    DEFAULT NULL,
  p_minted_by              UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- `extensions` (not just `public`) is required here — Supabase installs
-- pgcrypto into the `extensions` schema by default, and this function
-- calls gen_random_bytes() for CSPRNG code generation. Omitting it made
-- every mint fail at code-generation time with "function
-- gen_random_bytes(integer) does not exist" (diagnosed 2026-08-25 by
-- reproducing the RPC call directly against production).
SET search_path = public, extensions
AS $$
DECLARE
  CHARS CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- matches lib/entitlement/sponsorCode.ts
  v_committed       INTEGER;
  v_buffer_pct      INTEGER;
  v_hard_ceiling    INTEGER;
  v_reserved_value  INTEGER := p_credits_per_redemption * p_quantity;
  v_current_reserved INTEGER;
  v_batch_id        UUID;
  v_code            TEXT;
  v_bytes           BYTEA;
  v_j               INTEGER;
  v_row_max_redemptions INTEGER;
  v_i               INTEGER;
  v_codes           JSONB := '[]'::jsonb;
  v_inserted_id     UUID;
  v_attempt         INTEGER;
BEGIN
  IF p_shape NOT IN ('shared', 'unique') THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_shape');
  END IF;

  IF p_shape = 'unique' THEN
    v_batch_id := gen_random_uuid();
    v_row_max_redemptions := 1;
  ELSE
    v_batch_id := NULL;
    v_row_max_redemptions := p_quantity;
  END IF;

  -- ── Lock the active allocation row for this partner — serializes
  -- concurrent mints against the same ceiling (AC6). ──
  SELECT committed_credits, buffer_pct
  INTO   v_committed, v_buffer_pct
  FROM   partner_allocations
  WHERE  partner_id = p_partner_id
    AND  period_start <= now()
    AND  period_end   >= now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'no_active_allocation');
  END IF;

  v_hard_ceiling := v_committed + floor(v_committed * v_buffer_pct / 100.0);

  -- Reserved = remaining unredeemed reserve on active, non-expired,
  -- non-revoked codes — SUM((max_redemptions - redemptions_used) *
  -- credits_per_redemption), per Spec 18's data model section. Locked
  -- against the same FOR UPDATE row above, so this read is consistent
  -- for the duration of this mint.
  SELECT COALESCE(SUM((max_redemptions - redemptions_used) * credits_per_redemption), 0)
  INTO   v_current_reserved
  FROM   sponsor_codes
  WHERE  partner_id  = p_partner_id
    AND  revoked_at IS NULL
    AND  expires_at > now();

  IF v_current_reserved + v_reserved_value > v_hard_ceiling THEN
    RETURN jsonb_build_object(
      'success',   false,
      'code',      'ceiling_exceeded',
      'shortfall', (v_current_reserved + v_reserved_value) - v_hard_ceiling,
      'remaining', v_hard_ceiling - v_current_reserved
    );
  END IF;

  -- ── Mint p_quantity rows (unique) or 1 row (shared) ──
  FOR v_i IN 1..(CASE WHEN p_shape = 'unique' THEN p_quantity ELSE 1 END) LOOP
    v_attempt := 0;
    LOOP
      v_attempt := v_attempt + 1;
      IF v_attempt > 5 THEN
        -- Collision 5x in a row on a ~10^12 keyspace is effectively
        -- impossible; treat as a hard failure rather than loop forever.
        RETURN jsonb_build_object('success', false, 'code', 'code_generation_failed');
      END IF;

      v_bytes := gen_random_bytes(8);
      v_code := '';
      FOR v_j IN 0..7 LOOP
        v_code := v_code || substr(CHARS, (get_byte(v_bytes, v_j) % 32) + 1, 1);
      END LOOP;
      v_code := lower(p_prefix || v_code);

      BEGIN
        INSERT INTO sponsor_codes (
          partner_id, code, label, batch_id, prefix,
          credits_per_redemption, max_redemptions, cohort_id,
          expires_at, note, created_by, status
        ) VALUES (
          p_partner_id, v_code, p_label, v_batch_id, upper(p_prefix),
          p_credits_per_redemption, v_row_max_redemptions, p_cohort_id,
          p_expires_at, p_note, p_minted_by, 'active'
        )
        RETURNING id INTO v_inserted_id;

        v_codes := v_codes || jsonb_build_object(
          'id',   v_inserted_id,
          'code', upper(p_prefix) || '-' || upper(substr(v_code, length(p_prefix) + 1))
        );
        EXIT;  -- inserted — leave the retry loop, continue the outer FOR
      EXCEPTION
        WHEN unique_violation THEN
          -- Collision on `code` — retry with a freshly generated suffix.
          CONTINUE;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'batch_id', v_batch_id,
    'codes',    v_codes,
    'reserved', v_reserved_value
  );
END;
$$;

-- ── Grant execute to authenticated role ──
-- The API route calls this via the service-role client, which bypasses
-- grants. This grant covers any future direct RPC call from a session.
GRANT EXECUTE ON FUNCTION public.mint_sponsor_codes(
  UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, UUID, TIMESTAMPTZ, TEXT, UUID
) TO authenticated;
