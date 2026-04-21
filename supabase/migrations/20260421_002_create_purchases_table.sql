-- ============================================================
-- Career Bridge Foundation — Purchases Table
-- Migration: 20260421_002_create_purchases_table.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE: purchases
-- One row per completed Stripe payment.
-- Created by the webhook handler on checkout.session.completed.
-- simulation_credits tracks the pool; simulations_used tracks
-- how many submissions have been consumed against this purchase.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.purchases (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_checkout_session_id  TEXT        NOT NULL UNIQUE,
  stripe_customer_id          TEXT,
  price_type                  TEXT        NOT NULL
                                CHECK (price_type IN ('single', 'bundle', 'portfolio', 'coach')),
  amount_paid                 INTEGER     NOT NULL, -- in pence
  currency                    TEXT        NOT NULL DEFAULT 'gbp',
  simulation_credits          INTEGER     NOT NULL DEFAULT 1, -- total credits granted
  simulations_used            INTEGER     NOT NULL DEFAULT 0, -- credits consumed by submissions
  status                      TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'expired', 'refunded')),
  purchased_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ           -- null = never expires
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Candidates can read their own purchase rows (to check access)
CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_purchases_user           ON public.purchases(user_id);
CREATE INDEX idx_purchases_stripe_session ON public.purchases(stripe_checkout_session_id);
CREATE INDEX idx_purchases_status         ON public.purchases(status);
