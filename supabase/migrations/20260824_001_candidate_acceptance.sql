-- Migration: Candidate Acceptance & Community Provisioning (Spec 19)
--
-- Data model only. No Circle API integration in this pass — the community
-- columns are schema-ready and nullable/unused until real Circle credentials
-- exist (Spec 19.3 is deferred). Both seeded documents are `is_active = false`
-- — the mechanism is fully testable end-to-end but gates no one until a real
-- version is published via POST /api/admin/terms-documents.
--
-- Design note on `candidate_id`: it references auth.users(id) directly (i.e.
-- it IS auth.uid()), not portfolio_profiles(id). Acceptance is a property of
-- the authenticated person, not of a portfolio row, and every other
-- candidate-owned table in this schema that reliably works today
-- (evaluation_results, simulation_sessions, simulation_responses) keys off
-- auth.uid() = user_id directly for the same reason — see the comment on
-- portfolio_candidate_link() below for why portfolio_profiles itself is
-- deliberately NOT used as the join target here.

-- ===== TERMS_DOCUMENTS =====

CREATE TABLE IF NOT EXISTS terms_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('platform_terms', 'partner_programme_terms')),
  partner_id    UUID REFERENCES partners(id), -- NULL for platform_terms; required for partner_programme_terms
  version       TEXT NOT NULL,
  body          TEXT NOT NULL,
  document_hash TEXT NOT NULL, -- sha256 hex digest of `body`, computed at publish time — see app/api/admin/terms-documents/route.ts
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active     BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES auth.users(id)
);

-- Platform terms have no partner; partner terms must specify one. Enforced as
-- a CHECK rather than two separate nullable-FK tables, matching this
-- migration's existing style (e.g. candidate_entitlements' single-table shape).
ALTER TABLE terms_documents
  ADD CONSTRAINT terms_documents_partner_shape CHECK (
    (document_type = 'platform_terms' AND partner_id IS NULL) OR
    (document_type = 'partner_programme_terms' AND partner_id IS NOT NULL)
  );

-- At most one ACTIVE version per (document_type, partner_id). Partial unique
-- index (not a plain UNIQUE constraint) so multiple inactive/superseded
-- versions can coexist — only the active one is constrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_documents_one_active
  ON terms_documents (document_type, COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_terms_documents_type_partner ON terms_documents(document_type, partner_id);

ALTER TABLE terms_documents ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read an ACTIVE document (this is the legal text
-- shown before acceptance — not sensitive, needs to be readable pre-acceptance).
CREATE POLICY terms_documents_active_read ON terms_documents FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY terms_documents_staff_all ON terms_documents FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- ===== CANDIDATE_TERMS_ACCEPTANCES =====
-- Append-only evidence record. No UPDATE or DELETE policy is defined for ANY
-- role below — with RLS enabled, the absence of a policy for a command
-- denies it outright for every non-bypassing role. This IS the enforcement
-- of "nothing in the record is ever updated in place" (Spec 19, decision 5).

CREATE TABLE IF NOT EXISTS candidate_terms_acceptances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID NOT NULL REFERENCES auth.users(id), -- = auth.uid() of the accepting candidate
  document_type TEXT NOT NULL CHECK (document_type IN ('platform_terms', 'partner_programme_terms')),
  partner_id    UUID REFERENCES partners(id), -- NULL for platform_terms
  version       TEXT NOT NULL,
  document_hash TEXT NOT NULL, -- copied from terms_documents at acceptance time — the reconstructable "what exactly was accepted"
  accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT
);

-- Normalises NULL partner_id to a sentinel so two platform_terms acceptances
-- at the same version genuinely conflict (Postgres treats NULL <> NULL in a
-- plain UNIQUE constraint, which would silently defeat idempotency here).
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_terms_acceptances_unique
  ON candidate_terms_acceptances (
    candidate_id, document_type,
    COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    version
  );

CREATE INDEX IF NOT EXISTS idx_candidate_terms_acceptances_candidate ON candidate_terms_acceptances(candidate_id);

ALTER TABLE candidate_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_terms_acceptances_own_read ON candidate_terms_acceptances FOR SELECT
  USING (candidate_id = auth.uid());

CREATE POLICY candidate_terms_acceptances_own_insert ON candidate_terms_acceptances FOR INSERT
  WITH CHECK (candidate_id = auth.uid());

CREATE POLICY candidate_terms_acceptances_staff_read ON candidate_terms_acceptances FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- ===== RPC: record_candidate_acceptance =====
-- Atomic multi-row insert (the function body is one implicit transaction).
-- candidate_id is ALWAYS auth.uid() — never client-supplied — so this must be
-- called with the caller's own session (not the service-role key) for
-- auth.uid() to resolve. See app/api/candidate/accept/route.ts.

CREATE OR REPLACE FUNCTION record_candidate_acceptance(
  p_acceptances JSONB, -- [{ "document_type": "...", "partner_id": "..."|null, "version": "...", "document_hash": "..." }]
  p_ip TEXT,
  p_user_agent TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
  candidate UUID := auth.uid();
BEGIN
  IF candidate IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_acceptances)
  LOOP
    INSERT INTO candidate_terms_acceptances
      (candidate_id, document_type, partner_id, version, document_hash, ip_address, user_agent)
    VALUES (
      candidate,
      item ->> 'document_type',
      NULLIF(item ->> 'partner_id', '')::uuid,
      item ->> 'version',
      item ->> 'document_hash',
      p_ip,
      p_user_agent
    )
    ON CONFLICT (
      candidate_id, document_type,
      COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid),
      version
    ) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION record_candidate_acceptance(JSONB, TEXT, TEXT) TO authenticated;

-- Enforcement (candidate_has_outstanding_terms(), the function middleware.ts
-- calls to actually gate requests) is deliberately a SEPARATE migration —
-- see 20260824_002_candidate_acceptance_enforcement.sql.

-- ===== PARTNER-FACING STATUS VIEW =====
-- Status only (booleans), never the hash/body — mirrors the
-- partner_public_branding pattern (filtered, definer-owned view exposing a
-- safe subset of otherwise-restricted tables). Scoped to the querying
-- partner's own entitled roster via candidate_entitlements.granted_by_partner
-- (RLS on candidate_entitlements already restricts that to admin/super_admin
-- + the candidate themself — this view is read through the partners' OWN
-- service-role-backed API route, app/api/partner/candidates route family,
-- same as every other partner roster read in this codebase).
--
-- The join from candidate_entitlements (keyed by portfolio_profiles.id) to
-- candidate_terms_acceptances (keyed by auth.users.id) has to cross
-- portfolio_profiles' own link back to auth.users. That link column is
-- determined dynamically below rather than hardcoded: this migration found
-- portfolio_profiles' OWN committed RLS policies (20260512_001) written
-- against a column called candidate_user_id, while the shipping application
-- code (app/api/redeem/route.ts and others) reads/writes portfolio_profiles
-- using a column called user_id — i.e. the migration history and the live
-- application disagree about the column name, a known drift pattern in this
-- repo (dashboard-applied schema changes not always mirrored in migration
-- files — see CLAUDE.md "Production schema is the source of truth"). Rather
-- than guess and risk this view referencing a column that doesn't exist in
-- production, resolve it from information_schema at migration-apply time.
DO $$
DECLARE
  link_col TEXT;
BEGIN
  SELECT column_name INTO link_col
  FROM information_schema.columns
  WHERE table_name = 'portfolio_profiles' AND column_name IN ('user_id', 'candidate_user_id')
  ORDER BY (column_name = 'user_id') DESC -- prefer user_id: matches the column every shipping app route already reads/writes successfully
  LIMIT 1;

  IF link_col IS NULL THEN
    RAISE EXCEPTION 'portfolio_profiles has neither a user_id nor candidate_user_id column — cannot build partner_candidate_acceptance_status. Check the live schema and adjust this migration.';
  END IF;

  EXECUTE format($v$
    CREATE OR REPLACE VIEW partner_candidate_acceptance_status AS
    SELECT
      ce.granted_by_partner AS partner_id,
      pp.id                 AS candidate_id,
      bool_or(cta.document_type = 'platform_terms') AS platform_terms_accepted,
      bool_or(cta.document_type = 'partner_programme_terms' AND cta.partner_id = ce.granted_by_partner) AS programme_terms_accepted,
      max(cta.accepted_at)  AS last_accepted_at
    FROM candidate_entitlements ce
    JOIN portfolio_profiles pp ON pp.id = ce.candidate_id
    LEFT JOIN candidate_terms_acceptances cta ON cta.candidate_id = pp.%I
    WHERE ce.revoked_at IS NULL
    GROUP BY ce.granted_by_partner, pp.id
  $v$, link_col);
END $$;

GRANT SELECT ON partner_candidate_acceptance_status TO authenticated;

-- ===== PARTNER COMMUNITY CONFIGURATION (Spec 19.3 — schema-ready, unused) =====

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_provider') THEN
    ALTER TABLE partners ADD COLUMN community_provider TEXT; -- e.g. 'circle'; null = no community configured
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_identifier') THEN
    ALTER TABLE partners ADD COLUMN community_identifier TEXT; -- e.g. Circle community slug
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_space_id') THEN
    ALTER TABLE partners ADD COLUMN community_space_id TEXT; -- may vary by cohort; single column for now, revisit if per-cohort spaces are needed
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_credential_ref') THEN
    ALTER TABLE partners ADD COLUMN community_credential_ref TEXT; -- pointer to the encrypted-at-rest token, never the token itself
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_enabled') THEN
    ALTER TABLE partners ADD COLUMN community_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ===== CANDIDATE COMMUNITY PROVISIONING STATE (schema-ready, unused) =====
-- On portfolio_profiles.id (the PK — unambiguous regardless of the
-- user_id/candidate_user_id question above, since ADD COLUMN never needs to
-- reference that link column).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolio_profiles' AND column_name = 'community_member_id') THEN
    ALTER TABLE portfolio_profiles ADD COLUMN community_member_id TEXT; -- external id — resolve by this, never by email (Spec 19 decision 9)
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolio_profiles' AND column_name = 'provisioning_status') THEN
    ALTER TABLE portfolio_profiles ADD COLUMN provisioning_status TEXT NOT NULL DEFAULT 'not_required'
      CHECK (provisioning_status IN ('not_required', 'pending', 'provisioned', 'failed'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolio_profiles' AND column_name = 'provisioning_attempts') THEN
    ALTER TABLE portfolio_profiles ADD COLUMN provisioning_attempts INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolio_profiles' AND column_name = 'last_provisioning_attempt_at') THEN
    ALTER TABLE portfolio_profiles ADD COLUMN last_provisioning_attempt_at TIMESTAMPTZ;
  END IF;
END $$;

-- ===== SEED: current draft legal text, INACTIVE =====
-- version '1.0-draft', is_active = false — fully exercisable end to end
-- (publish endpoint, acceptance screen, RLS) without gating a single real
-- candidate until a real version is explicitly published. Bodies are the
-- working drafts from Spec 19.1 / 19.2 as supplied — including their own
-- ⚠ solicitor-review markers, which are not this migration's to resolve.

INSERT INTO terms_documents (document_type, partner_id, version, body, document_hash, is_active)
SELECT
  'platform_terms',
  NULL,
  '1.0-draft',
  $doc$# Spec 19.1 - Evidentize Platform Terms of Service

**Version:** 1.0-draft
**Status: WORKING DRAFT — NOT FOR PUBLICATION.** Prepared for solicitor review. Sections marked (decision pending) require a decision that has not been taken.
**Applies to:** All candidates on the Evidentize platform, regardless of partner
**Acceptance:** Click-wrap at first login, recorded per Spec 19

## 1. Who we are and what this covers

Evidentize ("we", "us") operates the assessment platform on which you complete workplace simulations, receive AI evaluation, build a portfolio and earn credentials. (Legal entity name to be confirmed — currently Job Simulator AI Inc., a Delaware corporation, with a transition to Evidentize Inc. pending. These terms must name the correct contracting entity before publication.)

You reached this platform through a partner organisation — the body that admitted you to its programme, invited you, and with whom you hold a separate agreement. These terms cover your use of the platform itself. Your programme, your community and any fees you pay are governed by your partner's terms, not these.

Where the two conflict on a matter concerning the platform, these terms apply.

## 2. Eligibility and your account

You must be 18 or over to use the platform.

You must provide accurate information and keep your account secure. Your account is personal to you. You may not share access, submit work produced by another person as your own, or complete an assessment on behalf of anyone else.

You may hold only one account. (Decision pending: confirm whether a candidate may legitimately be enrolled by two partners, which affects this clause and several platform behaviours.)

## 3. What the platform provides

Practice simulations are available to you at no cost. They produce qualitative feedback only — no score, no verdict, no credential, and nothing published to your portfolio.

Assessed simulations require an assessment credit. A credit is consumed when you activate an assessed simulation, at which point that simulation is permanently available to you. One evaluated submission is included per activation; a further attempt requires a further credit.

Credits reach your account either from a code issued by your partner, or by purchase. Credits do not expire once they are in your account. They are personal to you, are not transferable, and have no cash value.

## 4. Payment

Where you pay for credits, you are contracting with your partner, not with us. Your partner is the seller and the merchant of record. Refunds, cancellation rights, billing queries and consumer protections are matters between you and your partner, under their terms.

We provide the platform on which credits are used. We do not hold your payment details.

(Decision pending: Consumer cancellation — where the buyer is a consumer, UK and EU distance-selling rules give a 14-day right to cancel digital content unless expressly waived with acknowledgement of the loss of that right. The waiver belongs in the partner's checkout flow. Confirm the position for each market in scope.)

## 5. Assessment and evaluation

Evaluation is automated. Your submission is assessed by an AI model against a structured rubric. No human reviews your work as part of standard evaluation.

We calibrate our rubrics carefully and we stand behind the process, but we do not warrant that any individual evaluation is free from error, and we do not guarantee any particular outcome. Purchasing or redeeming a credit buys you an assessment. It does not buy you a pass, a credential, or any specific score.

Nothing on this platform is a guarantee of employment, an offer of employment, or a representation that any employer will recognise or act upon your results.

(Decision pending: Appeal route — no mechanism currently exists for a candidate to contest an evaluation. Decide whether one is offered, and if so on what terms, before publication.)

## 6. Your work and our materials

Our materials. The simulations, briefs, task sets, rubrics, evaluation methodology and platform are ours or our licensors'. You may use them to complete your assessments. You may not copy, publish, distribute, sell or share them, use them to train any model, or disclose scenario content to anyone else. This survives the end of your access.

Your work. You retain ownership of the work you submit. You grant us a non-exclusive, worldwide, royalty-free licence to store, process, evaluate and — where you choose to publish it — display it as part of your portfolio. That licence lasts as long as the material remains on the platform.

Your results. Scores, verdicts, feedback and credentials are records we generate. We may retain them as part of the integrity of the credential even after you stop using the platform.

## 7. Your portfolio — please read this clause

This clause requires separate acknowledgement at acceptance.

If you choose to publish evidence to your portfolio, it becomes publicly accessible on the internet, associated with your name, and may be indexed by search engines. It is visible to anyone with the link, including employers.

Publication is your choice. Nothing is published without your action.

Hosting is free and is not time-limited. We intend your portfolio to remain available indefinitely, which is the point of it — evidence you can rely on years later.

You may unpublish any item, or your entire portfolio, at any time from your account. Unpublishing removes it from public view. Copies already taken by third parties, search engines or archives are outside our control.

Your portfolio is not branded with your partner's identity, and it remains yours if your relationship with that partner ends.

## 8. Credentials

Where your result meets the published threshold, a credential is issued through our credentialing provider and is independently verifiable.

We may revoke a credential where we find it was obtained through work that was not your own, through account sharing, or through any breach of clause 2 or 6. Revocation removes the credential and the associated portfolio evidence.

## 9. Acceptable use

You may not: submit work that is not your own; share simulation content; attempt to extract our rubrics, prompts or evaluation logic; interfere with the platform's operation or security; use the platform unlawfully; or harass any person through it.

## 10. Suspension and ending your access

Your partner may suspend your access to the platform under its programme terms. Suspension blocks new activations and access to your account. It does not revoke credentials you have already earned, and it does not remove your published portfolio, which remains publicly accessible.

We may suspend or end your access where you breach these terms, where required by law, or where necessary to protect the platform or its users.

If you leave, or your partner relationship ends, your portfolio and credentials remain yours. Unspent credits remain in your account.

You may close your account at any time. (Decision pending: decide and state what closure does to a published portfolio and to issued credentials.)

## 11. Your data

(Decision pending: this section cannot be finalised without a decision on the data controller arrangement between Evidentize and each partner.)

Subject to that, this section covers: what we collect, why, our lawful basis, who we share it with (our credentialing, email, payment and AI providers), where it is stored (currently the UK region), how long we keep it, and your rights of access, correction, erasure, portability and objection.

Where you ask us to erase your data, we will explain what that means for your credentials and portfolio before acting.

## 12. Availability and liability

We aim to keep the platform available but do not guarantee uninterrupted service. We may change or withdraw features.

(Decision pending: liability cap and exclusions to be drafted by the solicitor.)

## 13. Changes to these terms

We may update these terms. Where we do, we will publish a new version and ask you to accept it at your next login. You will be told in advance where the change is material. Your previous acceptances remain on record.

If you do not accept a new version, you cannot continue to use the platform. Your published portfolio and issued credentials are unaffected.

## 14. Governing law

(Decision pending: to be determined. Cohorts run across multiple countries and the contracting entity is currently US-registered while the platform, data and first partner are UK-based.)

## 15. Contact

(Decision pending: support address and, if required, a data protection contact to be inserted.)
$doc$,
  '', -- computed below
  false
WHERE NOT EXISTS (
  SELECT 1 FROM terms_documents WHERE document_type = 'platform_terms' AND partner_id IS NULL AND version = '1.0-draft'
);

UPDATE terms_documents
SET document_hash = encode(sha256(body::bytea), 'hex')
WHERE document_type = 'platform_terms' AND partner_id IS NULL AND version = '1.0-draft' AND document_hash = '';

INSERT INTO terms_documents (document_type, partner_id, version, body, document_hash, is_active)
SELECT
  'partner_programme_terms',
  p.id,
  '1.0-draft',
  $doc$# Spec 19.2 - Simulation-Based Work Experience Programme — Terms and Undertaking

## Terms of Participation and Undertaking

**Career Bridge Foundation CIC**

**Version:** 1.0
**Status: WORKING DRAFT FOR LEGAL REVIEW — NOT FOR PUBLICATION**

### 1. Who we are

Career Bridge Foundation CIC ("Career Bridge", "we", "us", "our") is a community interest company registered in England and Wales. We run the Simulation-Based Work Experience Programme (the "Programme").

### 2. What these terms are

These terms form an agreement between you and us about your participation in the Programme. They apply from the moment you accept them and for as long as you take part.

You also accept a separate agreement with Evidentize, who operates the assessment platform. That agreement governs the platform, your portfolio and your credentials. These terms govern the Programme.

Where the two documents address the same subject, the Evidentize terms govern the platform and these terms govern the Programme. Neither of us is party to the other's agreement with you.

### 4. What the Programme is

The Programme gives you structured, simulation-based work experience. You complete realistic workplace scenarios, your work is evaluated, and you build a Portfolio of verified evidence to show employers.

It runs across two places: our Community, where induction, orientation, support and peer contact happen; and the Platform, where you complete simulations, receive evaluation, and hold your Portfolio and Credentials.

### 5. What the Programme is not

The Programme is simulation-based. The scenarios are modelled on professional work. They are not work for any employer, and no employer receives, uses or benefits from what you produce.

You are not our employee, worker, apprentice, volunteer or contractor, and nothing in these terms creates any of those relationships. No wage, salary, fee or other payment is due to you.

We do not guarantee employment, an interview, an introduction to any employer, or that any employer will recognise or act upon a Credential.

We do not provide legal, financial, immigration or regulated careers advice.

### 6. Eligibility and admission

You must be 18 or over. Admission is at our discretion following the application and selection process described in Schedule 1. We are not obliged to give reasons for a decision not to admit.

### 7. What is free

Applying to the Programme; access to the Community for the duration of your participation; induction and orientation; creating your Platform account and Portfolio; Practice Simulations, with feedback; publishing your Portfolio, and its continued hosting.

### 8. What is paid, and how

Assessment Credits pay for the AI evaluation and verification of your work. You are not paying for access to work experience, for the Community, for the Platform, or for your Portfolio.

Either we issue you a Sponsor Code, or you buy Credits yourself. Where you buy Credits, you buy them from us — we are the merchant of record.

A Credit is consumed at activation, not submission. Once activated, that simulation is permanently available to you. Credits do not expire once in your account, are personal to you, cannot be transferred or sold, and have no cash value.

### 9. Your undertaking

By joining a Cohort you undertake to: complete at least the number of Assessed Simulations stated in Schedule 1 within the Programme Period; take part in induction and orientation; submit only your own work, produced without assistance from another person and without the use of any artificial intelligence tool other than those provided within the Platform; treat other participants, our staff and our partners with respect; and keep simulation content confidential and not share, publish or distribute it.

Where we issue you a Sponsor Code, it carries a fixed number of Credits and an expiry date. We rely on expiry rather than enforcement — we will not remove you from the Programme for failing to complete it.

### 10. Our Community

Access to the Community is provided as part of the Programme and is granted once you have accepted these terms and the Evidentize terms. Our Community Rules apply in full: no harassment, discrimination or abuse; no spam, recruitment or solicitation; no sharing of simulation content; no disclosure of another participant's personal information; and no unlawful or harmful content.

### 11. Intellectual property

The Programme materials, and the simulations, briefs, task sets, rubrics and evaluation methodology on the Platform, belong to us or to Evidentize. You keep ownership of the work you produce. We claim no rights in your Portfolio and do not brand it.

### 12. Your personal information

(Decision pending: this clause cannot be completed until the controller arrangement between Career Bridge Foundation CIC and Evidentize is settled.)

We are a data controller in respect of the information you give us when applying and while taking part in the Programme. We may report on the Programme's outcomes to funders, partners and regulators in anonymous, aggregate form. We will not use your name, image, words, story or Portfolio in marketing, funding applications or public reporting unless you give us separate, specific, voluntary consent.

### 13. Suspension, removal and leaving

You may leave at any time by telling us. We may suspend or end your participation where you materially breach these terms, where your conduct harms other participants, where you gave materially false information on application, or where required by law.

If you leave or we end your participation: your Credentials remain valid; your published Portfolio remains published; Credits already in your account remain yours; Credits you have not claimed from a Sponsor Code are no longer available; Community access ends.

### 14. Our responsibility to you

We will provide the Programme with reasonable care and skill. We do not exclude or limit our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be excluded. Nothing in these terms affects your statutory rights as a consumer.

### 16. Changes to these terms

We may change these terms. The undertaking in clause 9 and the particulars in Schedule 1 are fixed for the duration of your Cohort and will not be changed part-way through, except to correct an obvious error or where you agree.

### 17. General

These terms and the Evidentize terms are the whole agreement about your participation. Your place in a Cohort is personal to you and cannot be transferred.

(This seeded body is condensed from the full working draft for storage — the complete Spec 19.2 document, including Schedule 1 cohort particulars and all solicitor-review markers, is the authoritative text and should replace this seed before any real version is published.)
$doc$,
  '',
  false
FROM partners p
WHERE p.slug = 'career-bridge-foundation'
  AND NOT EXISTS (
    SELECT 1 FROM terms_documents
    WHERE document_type = 'partner_programme_terms' AND partner_id = p.id AND version = '1.0-draft'
  );

UPDATE terms_documents
SET document_hash = encode(sha256(body::bytea), 'hex')
WHERE document_type = 'partner_programme_terms' AND version = '1.0-draft' AND document_hash = '';
