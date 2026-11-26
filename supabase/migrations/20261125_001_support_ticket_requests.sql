-- Migration: support_ticket_requests — per-user rate limiting + audit trail
-- for the in-app support page (/account/support → Zoho Desk).
--
-- Why a table and not lib/rate-limit.ts: that helper is an in-memory Map, which
-- doesn't hold across Vercel serverless instances. The Zoho org and its API
-- quota are shared with other teams, so the limit (5 per user per hour) has to
-- be real. Every attempt (pending / created / failed) counts toward the limit,
-- because failed attempts still spend Zoho API quota.
--
-- Deliberately does NOT store the ticket description (it lives in Zoho, and
-- may contain personal details). Only metadata needed for rate limiting and
-- for matching a Zoho ticket back to a Career Bridge user.
--
-- Access: service role only (the API route uses supabaseServer). RLS is
-- enabled with no policies, so anon/authenticated clients get nothing.

CREATE TABLE IF NOT EXISTS support_ticket_requests (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'created', 'failed')),
  category           text        NOT NULL,
  priority           text        NOT NULL,
  zoho_ticket_id     text,
  zoho_ticket_number text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_requests_user_created_idx
  ON support_ticket_requests (user_id, created_at DESC);

ALTER TABLE support_ticket_requests ENABLE ROW LEVEL SECURITY;
