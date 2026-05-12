# Career Bridge Foundation — Phase 1A Migration Spec

**Portfolio Tables Migration**

**Version 0.2 — DRAFT for Victor's review**
**Date: 12 May 2026**
**Status: Working draft — review and approve before execution**
**Owner: Victor Sonde**
**Supersedes: v0.1 (12 May 2026)**
**Changes from v0.1:** Corrected column name references after schema verification in Claude Code. The existing `profiles` table uses `id` (not `user_id`) as PK/FK to `auth.users`. The existing `evaluation_results` table uses `user_id` (not `candidate_user_id`). Both the trigger function and backfill script have been updated to use the correct column names. New portfolio tables retain `candidate_user_id` naming for semantic clarity and consistency with `credential_issuances`.
**Related documents:**
- `docs/CareerBridge_Portfolio_Phase1_Spec.md` (source spec)
- `docs/DATABASE.md` (current schema)
- `docs/CareerBridge_Framework_Alignment.md` v0.2 (framework metadata for later phases)

---

## Purpose

Create the four pending portfolio tables defined in the Phase 1 portfolio spec, plus the storage bucket, RLS policies, indexes, triggers, and a backfill script for existing candidates with completed simulations.

This migration is **Phase 1A** — the foundation layer. Subsequent phases (1B refactor, 1C dashboard, 1D artefacts, 1E bio/social) all depend on this being in place.

After Phase 1A ships, the portfolio system enters a **dual-state period**: the existing portfolio code continues to read from `simulation_sessions` / `evaluation_results` / `credential_issuances` for backwards compatibility, while the new `portfolio_profiles` row exists for every candidate and is ready to be the canonical data source once Phase 1B refactors the read path.

---

## What this migration creates

### Database objects

1. **`portfolio_profiles` table** — one row per candidate, candidate-controlled metadata (slug, bio, social links, is_public, settings)
2. **`portfolio_evidence` table** — files and links uploaded by candidates against a specific simulation
3. **`portfolio_simulation_visibility` table** — per-simulation visibility toggles (show_on_portfolio, show_scores, show_feedback) — sparse, only rows for non-default values
4. **Storage bucket: `portfolio-evidence`** — Supabase storage for uploaded files

### Supporting objects

- RLS policies on all three tables (defence-in-depth: middleware gates writes at the application layer, RLS prevents leakage at the database layer)
- Indexes for the query patterns: lookup by slug, lookup by candidate_user_id, lookup by simulation_slug
- `updated_at` triggers reusing the existing `update_updated_at()` function
- Auto-creation trigger on `evaluation_results` insert to create `portfolio_profiles` row for new candidates

### Backfill script

A one-time SQL script that creates `portfolio_profiles` rows for all candidates who have at least one `evaluation_results` row but no existing `portfolio_profiles` row. Run after the migration applies.

---

## Design decisions locked in

These reflect Victor's decisions on 12 May 2026 and shape the spec:

| Decision | Choice | Rationale |
|---|---|---|
| Simulation reference type | `simulation_slug TEXT` | Match existing convention (simulation_sessions, evaluation_results use TEXT slugs) |
| Portfolio auto-creation timing | On first `evaluation_results` insert per candidate | Per the original Phase 1 spec |
| Default `is_public` on auto-creation | `true` | Per the Phase 1 spec — public by default, candidate can hide later |
| Backfill scope | All candidates with completed simulations | Migrate everyone at once for consistency |
| Slug source for portfolio URL | Derived from candidate name + collision suffix | Per Phase 1 spec slug generation rules |
| Candidate user-ID column name in new portfolio tables | `candidate_user_id` | Matches `credential_issuances` convention; semantically clear (vs e.g. a coach user_id); the trigger function maps `NEW.user_id` from `evaluation_results` to `candidate_user_id` on insert |

### Existing schema inconsistency (documented technical debt)

Schema verification on 12 May 2026 surfaced an existing inconsistency in the production schema:

- `evaluation_results.user_id` (no `candidate_` prefix)
- `credential_issuances.candidate_user_id` (with prefix)
- `profiles.id` (PK + FK to `auth.users(id)` — no separate `user_id` column)

This migration does NOT fix the existing inconsistency. The new portfolio tables use `candidate_user_id` to match `credential_issuances`. The trigger function reads `NEW.user_id` from `evaluation_results` and writes it to `candidate_user_id` in `portfolio_profiles` — a one-line mapping. The inconsistency remains as documented technical debt to be addressed in a future column-rename migration (low priority).

---

## Schema definitions

### Table 1: `portfolio_profiles`

One row per candidate. The candidate's professional portfolio metadata.

```sql
CREATE TABLE public.portfolio_profiles (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                TEXT         NOT NULL UNIQUE,
  display_name        TEXT         NOT NULL,
  bio                 TEXT,
  social_links        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_public           BOOLEAN      NOT NULL DEFAULT true,
  show_default_scores BOOLEAN      NOT NULL DEFAULT true,
  show_default_feedback BOOLEAN    NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(candidate_user_id)
);
```

**Column notes:**

- `id` — surrogate PK, UUID for consistency with other tables in this schema
- `candidate_user_id` — FK to auth.users with CASCADE on delete (if the user account is deleted, the portfolio goes with it; this is correct behaviour for GDPR right-to-erasure)
- `slug` — the URL-safe identifier that appears in `/portfolio/[slug]`. Globally unique. Generated from display_name + numeric suffix if collisions. Examples: `victor-sonde`, `victor-sonde-2`, `j-smith-47`
- `display_name` — the name shown on the portfolio header. Editable by candidate. Initial value from auth.users metadata
- `bio` — nullable, free text. Soft limit of ~500 chars enforced at the application layer, not the DB
- `social_links` — JSONB array of `{platform, url, label}` objects. Empty array by default. Application layer validates URL format
- `is_public` — when false, the portfolio is hidden from public URLs. Default true per Phase 1 spec
- `show_default_scores` / `show_default_feedback` — global defaults for scenarios that don't have a row in `portfolio_simulation_visibility`. Per-simulation overrides live in that sparse table
- `UNIQUE(candidate_user_id)` — exactly one portfolio per candidate

**Anticipated JSONB shape for `social_links`:**

```json
[
  {"platform": "linkedin", "url": "https://linkedin.com/in/victor-sonde", "label": "LinkedIn"},
  {"platform": "github", "url": "https://github.com/victorsonde", "label": "GitHub"},
  {"platform": "twitter", "url": "https://twitter.com/victorsonde", "label": "Twitter"}
]
```

The application layer validates platform values from a whitelist (linkedin, github, twitter, mastodon, bluesky, instagram, youtube, personal_website, other) and enforces URL format.

### Table 2: `portfolio_evidence`

Files and external links uploaded by a candidate against a specific simulation. Many-to-one with `portfolio_profiles`.

```sql
CREATE TABLE public.portfolio_evidence (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug     TEXT         NOT NULL,
  evidence_type       TEXT         NOT NULL CHECK (evidence_type IN ('file', 'url')),
  file_path           TEXT,
  external_url        TEXT,
  title               TEXT         NOT NULL,
  description         TEXT,
  mime_type           TEXT,
  file_size_bytes     BIGINT,
  is_visible          BOOLEAN      NOT NULL DEFAULT true,
  sort_order          INTEGER      NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT evidence_file_or_url CHECK (
    (evidence_type = 'file' AND file_path IS NOT NULL AND external_url IS NULL)
    OR
    (evidence_type = 'url' AND external_url IS NOT NULL AND file_path IS NULL)
  )
);
```

**Column notes:**

- `candidate_user_id` — owner. Same CASCADE behaviour as portfolio_profiles
- `simulation_slug` — TEXT to match the existing convention. The simulation this evidence relates to
- `evidence_type` — discriminator. Either `file` (uploaded to storage bucket) or `url` (external link)
- `file_path` — when `evidence_type = 'file'`, the path within the `portfolio-evidence` Supabase storage bucket. Format: `{candidate_user_id}/{evidence_id}.{ext}`
- `external_url` — when `evidence_type = 'url'`, the external link URL
- `title` — required. What the candidate calls this piece of evidence (e.g. "Q3 product strategy deck")
- `description` — optional context for the evidence
- `mime_type` — set by application when uploading files. Used for icon/preview rendering
- `file_size_bytes` — set by application. Used for soft enforcement of upload limits (e.g. 25MB per file)
- `is_visible` — candidate can hide an artefact from public portfolio without deleting it
- `sort_order` — candidate-controlled ordering within a simulation
- `evidence_file_or_url` constraint — ensures exactly one of `file_path` / `external_url` is set, matching the `evidence_type`

**Note on URL persistence:** Per the Phase 1 spec — *"File URLs are permanently accessible once issued. Setting `is_visible = false` hides the file from the portfolio page but does not revoke the URL."* This is documented as a known limitation. Hard revocation requires moving files out of the public bucket, which is a v2 feature.

### Table 3: `portfolio_simulation_visibility`

Per-simulation visibility overrides. **Sparse table** — only rows for candidates who have deviated from the defaults in `portfolio_profiles`. Most candidates will have zero rows here.

```sql
CREATE TABLE public.portfolio_simulation_visibility (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug     TEXT         NOT NULL,
  show_on_portfolio   BOOLEAN      NOT NULL DEFAULT true,
  show_scores         BOOLEAN      NOT NULL DEFAULT true,
  show_feedback       BOOLEAN      NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(candidate_user_id, simulation_slug)
);
```

**Column notes:**

- `UNIQUE(candidate_user_id, simulation_slug)` — at most one override row per candidate per simulation
- All three boolean columns have defaults that match the global defaults in `portfolio_profiles`, so an inserted row with all defaults is harmless
- Application reads: for each completed simulation, check this table; if no row exists, fall back to global defaults from `portfolio_profiles`
- Rows are created only when a candidate explicitly toggles a per-simulation setting in the dashboard

### Storage bucket: `portfolio-evidence`

Created via Supabase storage API (separate from SQL migration). Public bucket. File path structure: `{candidate_user_id}/{evidence_id}.{ext}`.

```sql
-- Storage bucket setup (run via Supabase admin client, not as part of SQL migration)
-- See storage bucket setup section below
```

Bucket configuration:
- **Public:** Yes (allows public file URLs for portfolio rendering)
- **File size limit:** 25 MB per file (enforced at upload via application)
- **Allowed MIME types:** images (jpeg, png, gif, webp), PDFs, common document types (docx, pptx, xlsx, txt, csv, md)
- **RLS policies:** Owner-only INSERT/UPDATE/DELETE; public SELECT on visible evidence

---

## Indexes

Indexes are written into the same migration file as the table definitions, immediately after the `CREATE TABLE` statements.

```sql
-- portfolio_profiles indexes
CREATE INDEX idx_portfolio_profiles_candidate_user_id ON public.portfolio_profiles(candidate_user_id);
CREATE INDEX idx_portfolio_profiles_slug ON public.portfolio_profiles(slug);
CREATE INDEX idx_portfolio_profiles_is_public ON public.portfolio_profiles(is_public) WHERE is_public = true;

-- portfolio_evidence indexes
CREATE INDEX idx_portfolio_evidence_candidate_user_id ON public.portfolio_evidence(candidate_user_id);
CREATE INDEX idx_portfolio_evidence_simulation_slug ON public.portfolio_evidence(simulation_slug);
CREATE INDEX idx_portfolio_evidence_candidate_simulation
  ON public.portfolio_evidence(candidate_user_id, simulation_slug);
CREATE INDEX idx_portfolio_evidence_visible
  ON public.portfolio_evidence(candidate_user_id, is_visible)
  WHERE is_visible = true;

-- portfolio_simulation_visibility indexes
CREATE INDEX idx_portfolio_simulation_visibility_candidate
  ON public.portfolio_simulation_visibility(candidate_user_id);
```

**Index rationale:**

- Slug lookup powers the public portfolio URL fetch (`/portfolio/[slug]` → `WHERE slug = $1`). Must be fast — used on every public portfolio view
- `candidate_user_id` lookups power the candidate's own dashboard
- Composite `(candidate_user_id, simulation_slug)` powers the per-simulation evidence join during portfolio rendering
- Partial index on `is_public = true` keeps the public-portfolio listing query lean
- Partial index on `is_visible = true` keeps evidence retrieval lean

---

## Row-Level Security policies

All three new tables have RLS enabled. Policies are defence-in-depth: the application middleware authenticates requests, but RLS prevents accidental leakage if a code path uses a user-scoped Supabase client incorrectly.

### `portfolio_profiles` RLS

```sql
ALTER TABLE public.portfolio_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read profiles where is_public is true
CREATE POLICY "portfolio_profiles_public_read"
  ON public.portfolio_profiles
  FOR SELECT
  USING (is_public = true);

-- Owner can read their own profile regardless of is_public
CREATE POLICY "portfolio_profiles_owner_read"
  ON public.portfolio_profiles
  FOR SELECT
  USING (auth.uid() = candidate_user_id);

-- Owner can update their own profile
CREATE POLICY "portfolio_profiles_owner_update"
  ON public.portfolio_profiles
  FOR UPDATE
  USING (auth.uid() = candidate_user_id);

-- Inserts only via service role (auto-creation trigger uses SECURITY DEFINER)
-- No INSERT policy for end users — application handles this through service role client

-- Deletes only via CASCADE from auth.users (no policy needed)
```

### `portfolio_evidence` RLS

```sql
ALTER TABLE public.portfolio_evidence ENABLE ROW LEVEL SECURITY;

-- Public can read visible evidence where parent profile is public
-- This is a privacy-critical join: hide evidence if parent portfolio is private
CREATE POLICY "portfolio_evidence_public_read"
  ON public.portfolio_evidence
  FOR SELECT
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM public.portfolio_profiles pp
      WHERE pp.candidate_user_id = portfolio_evidence.candidate_user_id
      AND pp.is_public = true
    )
  );

-- Owner can read all their own evidence (visible or not)
CREATE POLICY "portfolio_evidence_owner_read"
  ON public.portfolio_evidence
  FOR SELECT
  USING (auth.uid() = candidate_user_id);

-- Owner can insert their own evidence
CREATE POLICY "portfolio_evidence_owner_insert"
  ON public.portfolio_evidence
  FOR INSERT
  WITH CHECK (auth.uid() = candidate_user_id);

-- Owner can update their own evidence
CREATE POLICY "portfolio_evidence_owner_update"
  ON public.portfolio_evidence
  FOR UPDATE
  USING (auth.uid() = candidate_user_id);

-- Owner can delete their own evidence
CREATE POLICY "portfolio_evidence_owner_delete"
  ON public.portfolio_evidence
  FOR DELETE
  USING (auth.uid() = candidate_user_id);
```

### `portfolio_simulation_visibility` RLS

```sql
ALTER TABLE public.portfolio_simulation_visibility ENABLE ROW LEVEL SECURITY;

-- Public can read visibility rows where the parent profile is public
-- Required because the public portfolio rendering needs to check per-simulation overrides
CREATE POLICY "portfolio_simulation_visibility_public_read"
  ON public.portfolio_simulation_visibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolio_profiles pp
      WHERE pp.candidate_user_id = portfolio_simulation_visibility.candidate_user_id
      AND pp.is_public = true
    )
  );

-- Owner can read all their own visibility rows
CREATE POLICY "portfolio_simulation_visibility_owner_read"
  ON public.portfolio_simulation_visibility
  FOR SELECT
  USING (auth.uid() = candidate_user_id);

-- Owner can insert/update/delete their own visibility rows
CREATE POLICY "portfolio_simulation_visibility_owner_insert"
  ON public.portfolio_simulation_visibility
  FOR INSERT
  WITH CHECK (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_simulation_visibility_owner_update"
  ON public.portfolio_simulation_visibility
  FOR UPDATE
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_simulation_visibility_owner_delete"
  ON public.portfolio_simulation_visibility
  FOR DELETE
  USING (auth.uid() = candidate_user_id);
```

### RLS policy summary table

| Table | Public SELECT | Owner SELECT | Owner INSERT | Owner UPDATE | Owner DELETE |
|---|---|---|---|---|---|
| `portfolio_profiles` | When `is_public = true` | Always (their own) | Service role only (via trigger) | Yes | CASCADE only |
| `portfolio_evidence` | When `is_visible = true` AND parent is public | Always (their own) | Yes | Yes | Yes |
| `portfolio_simulation_visibility` | When parent is public | Always (their own) | Yes | Yes | Yes |

---

## Triggers

### `updated_at` triggers

Reuse the existing `update_updated_at()` function (defined in `20260420_001_create_all_tables.sql`).

```sql
CREATE TRIGGER trg_portfolio_profiles_updated_at
  BEFORE UPDATE ON public.portfolio_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_portfolio_evidence_updated_at
  BEFORE UPDATE ON public.portfolio_evidence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_portfolio_simulation_visibility_updated_at
  BEFORE UPDATE ON public.portfolio_simulation_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

**Note:** Per the existing schema, there are two functionally-identical trigger functions (`public.update_updated_at()` and `set_updated_at()`). We reuse the older `public.update_updated_at()` for consistency with the original portfolio-adjacent tables (`profiles`, `evaluation_results`, `simulation_sessions`). The newer `set_updated_at()` was added in `20260508_001_create_simulations_and_admins.sql` and is used by the `simulations` table. Both functions can be consolidated in a future migration but it's harmless as-is. **Verified 12 May 2026 (Claude Code schema check).**

### Auto-creation trigger: portfolio_profile on first simulation completion

The trickiest piece in this migration. Creates a `portfolio_profiles` row for a candidate the first time they have an `evaluation_results` row inserted.

```sql
-- Function: create portfolio profile for a candidate if they don't have one
-- Note: evaluation_results uses NEW.user_id (existing schema). The new
-- portfolio_profiles table uses candidate_user_id (for consistency with
-- credential_issuances). The function maps between these.
-- The existing profiles table uses id as PK + FK to auth.users(id).
CREATE OR REPLACE FUNCTION public.ensure_portfolio_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_display_name TEXT;
  v_slug TEXT;
  v_slug_base TEXT;
  v_slug_suffix INTEGER := 0;
BEGIN
  -- Check if profile already exists (note: portfolio_profiles uses candidate_user_id;
  -- the source row's user is in NEW.user_id from evaluation_results)
  IF EXISTS (
    SELECT 1 FROM public.portfolio_profiles
    WHERE candidate_user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get display name from the existing profiles table (linked via id, not user_id)
  SELECT full_name INTO v_display_name
  FROM public.profiles
  WHERE id = NEW.user_id
  LIMIT 1;

  -- Fallback if no display name found
  IF v_display_name IS NULL OR v_display_name = '' THEN
    v_display_name := 'Career Bridge Candidate';
  END IF;

  -- Generate slug base from display name
  v_slug_base := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := trim(both '-' from v_slug_base);

  -- Fallback if slug base is empty
  IF v_slug_base = '' THEN
    v_slug_base := 'candidate-' || substring(NEW.user_id::text, 1, 8);
  END IF;

  -- Find a unique slug (try base, then base-2, base-3, etc.)
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.portfolio_profiles WHERE slug = v_slug) LOOP
    v_slug_suffix := v_slug_suffix + 1;
    v_slug := v_slug_base || '-' || v_slug_suffix;

    -- Safety: prevent infinite loop in pathological cases
    IF v_slug_suffix > 9999 THEN
      v_slug := v_slug_base || '-' || substring(NEW.user_id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  -- Insert the portfolio_profile (mapping NEW.user_id from evaluation_results
  -- to candidate_user_id in portfolio_profiles)
  INSERT INTO public.portfolio_profiles (
    candidate_user_id,
    slug,
    display_name,
    is_public,
    show_default_scores,
    show_default_feedback
  ) VALUES (
    NEW.user_id,
    v_slug,
    v_display_name,
    true,
    true,
    false
  );

  RETURN NEW;
END;
$$;

-- Trigger: fire on evaluation_results insert
CREATE TRIGGER trg_ensure_portfolio_profile
  AFTER INSERT ON public.evaluation_results
  FOR EACH ROW EXECUTE FUNCTION public.ensure_portfolio_profile();
```

**Function design notes:**

- `SECURITY DEFINER` — runs with elevated privileges so it can INSERT into `portfolio_profiles` regardless of which user-scoped client triggered the original `evaluation_results` insert
- `IF EXISTS ... RETURN NEW` — idempotent. If the profile already exists, do nothing. Safe to re-run
- Slug generation matches the Phase 1 spec rules: lowercase, hyphenated, derived from display_name with numeric suffix for collisions
- The slug collision loop has a safety cap of 9999 attempts. Beyond that, the slug falls back to including the candidate UUID prefix. In practice this branch should never execute
- Fallback display_name `"Career Bridge Candidate"` covers the edge case where `profiles.full_name` is empty. Candidate can edit later via dashboard
- **Column mapping:** The function reads `NEW.user_id` from the `evaluation_results` trigger row and writes it to `candidate_user_id` in `portfolio_profiles`. The existing `profiles` table is joined via `id` (not `user_id`). These column-name choices reflect the existing schema as verified on 12 May 2026.

**Verified existing schema (no changes assumed):**

- `profiles.id` = PK + FK to `auth.users(id)`. There is no `user_id` column on `profiles`.
- `evaluation_results.user_id` = the candidate's user ID (no `candidate_` prefix).
- `credential_issuances.candidate_user_id` = the candidate's user ID (with `candidate_` prefix).
- `public.update_updated_at()` = the trigger function used by all `updated_at` columns.

---

## Storage bucket setup

Supabase storage buckets are not created via SQL — they're created via the Supabase admin API. This means the bucket setup is a separate step from the SQL migration.

Two options for execution:

**Option A: Manual creation via Supabase Dashboard** (recommended for first run)

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `portfolio-evidence`
4. Public bucket: **Yes**
5. File size limit: 25 MB
6. Allowed MIME types: leave default for now; enforce at application layer
7. Click "Create bucket"

Then run the storage RLS policies via SQL:

```sql
-- Storage RLS policies for portfolio-evidence bucket
-- Owner can upload to their own folder
CREATE POLICY "portfolio_evidence_owner_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can update files in their own folder
CREATE POLICY "portfolio_evidence_owner_update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can delete files in their own folder
CREATE POLICY "portfolio_evidence_owner_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public can read all files in the bucket (public bucket)
CREATE POLICY "portfolio_evidence_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'portfolio-evidence');
```

**Option B: Programmatic creation via admin script**

A short TypeScript script using the Supabase admin client. Useful if you want bucket creation to be reproducible across dev/staging/production. Defer to Phase 1D when the artefact upload feature is built; for now, manual creation in dev is fine.

---

## Backfill script

After the migration is applied, run this one-time script to create `portfolio_profiles` rows for all existing candidates with completed simulations.

```sql
-- Backfill script: create portfolio_profiles for candidates with existing evaluation_results
-- Run ONCE after the main migration. Idempotent — safe to re-run.
-- Note: evaluation_results uses user_id (existing schema). portfolio_profiles uses
-- candidate_user_id (new convention). The script maps between these.
-- The existing profiles table is joined via id (not user_id).

DO $$
DECLARE
  v_candidate RECORD;
  v_display_name TEXT;
  v_slug TEXT;
  v_slug_base TEXT;
  v_slug_suffix INTEGER;
  v_inserted_count INTEGER := 0;
BEGIN
  FOR v_candidate IN
    SELECT DISTINCT er.user_id AS candidate_user_id
    FROM public.evaluation_results er
    LEFT JOIN public.portfolio_profiles pp ON pp.candidate_user_id = er.user_id
    WHERE pp.id IS NULL
  LOOP
    -- Get display name from profiles table (linked via id)
    SELECT full_name INTO v_display_name
    FROM public.profiles
    WHERE id = v_candidate.candidate_user_id
    LIMIT 1;

    IF v_display_name IS NULL OR v_display_name = '' THEN
      v_display_name := 'Career Bridge Candidate';
    END IF;

    -- Generate slug base
    v_slug_base := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(both '-' from v_slug_base);

    IF v_slug_base = '' THEN
      v_slug_base := 'candidate-' || substring(v_candidate.candidate_user_id::text, 1, 8);
    END IF;

    -- Find unique slug
    v_slug := v_slug_base;
    v_slug_suffix := 0;
    WHILE EXISTS (SELECT 1 FROM public.portfolio_profiles WHERE slug = v_slug) LOOP
      v_slug_suffix := v_slug_suffix + 1;
      v_slug := v_slug_base || '-' || v_slug_suffix;
      IF v_slug_suffix > 9999 THEN
        v_slug := v_slug_base || '-' || substring(v_candidate.candidate_user_id::text, 1, 8);
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.portfolio_profiles (
      candidate_user_id,
      slug,
      display_name,
      is_public,
      show_default_scores,
      show_default_feedback
    ) VALUES (
      v_candidate.candidate_user_id,
      v_slug,
      v_display_name,
      true,
      true,
      false
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % portfolio_profiles created', v_inserted_count;
END;
$$ LANGUAGE plpgsql;
```

**Backfill notes:**

- Idempotent: only processes candidates without an existing `portfolio_profiles` row
- Safe to re-run if it fails partway through
- Emits a NOTICE with the count of inserted rows for verification
- Uses the same slug generation logic as the auto-creation trigger to ensure consistency

**Operational guidance:**

1. Run the main migration first (Phase 1A)
2. Verify the schema is in place by querying `\d portfolio_profiles` etc.
3. Run the backfill script as a separate transaction
4. Verify by counting: `SELECT COUNT(*) FROM portfolio_profiles;` should equal the count of distinct `candidate_user_id` in `evaluation_results`
5. Spot-check 3-5 candidate slugs by viewing `/portfolio/[slug]` URLs — at this stage the Phase 1A migration is done but the read-path refactor (Phase 1B) hasn't happened yet, so the public portfolio still renders from the old data path. The new `portfolio_profiles` rows exist but aren't yet being read

---

## Rollback plan

If the migration fails partway through, or if a critical bug is discovered after it applies, here's how to roll back.

### Soft rollback (preferred)

Most "rollbacks" of a successful migration are actually forward-fixes, not reverts. If the schema is correctly applied but something downstream breaks:

1. Don't drop the new tables
2. Identify the specific issue (RLS policy, trigger, column type)
3. Write a follow-up migration to fix it
4. Run the follow-up migration

This is safer than dropping and recreating, especially after backfill has run.

### Hard rollback (only if absolutely necessary)

Run this only if the migration applied incorrectly and forward-fixes won't work.

```sql
-- WARNING: This drops all portfolio_profiles, portfolio_evidence, and
-- portfolio_simulation_visibility data, and removes the auto-creation trigger.
-- Only run if you're certain you need to revert the migration.

BEGIN;

DROP TRIGGER IF EXISTS trg_ensure_portfolio_profile ON public.evaluation_results;
DROP FUNCTION IF EXISTS public.ensure_portfolio_profile();

DROP TRIGGER IF EXISTS trg_portfolio_simulation_visibility_updated_at ON public.portfolio_simulation_visibility;
DROP TRIGGER IF EXISTS trg_portfolio_evidence_updated_at ON public.portfolio_evidence;
DROP TRIGGER IF EXISTS trg_portfolio_profiles_updated_at ON public.portfolio_profiles;

DROP TABLE IF EXISTS public.portfolio_simulation_visibility;
DROP TABLE IF EXISTS public.portfolio_evidence;
DROP TABLE IF EXISTS public.portfolio_profiles;

-- Drop the storage policies (RLS on storage.objects)
DROP POLICY IF EXISTS "portfolio_evidence_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_evidence_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_evidence_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_evidence_public_read" ON storage.objects;

-- Storage bucket deletion is done via Supabase Dashboard, not SQL.

COMMIT;
```

**Important:** Hard rollback destroys data. Files uploaded to the storage bucket are NOT removed by the SQL above — they need to be deleted via the Supabase Dashboard or admin API separately.

### Best practice: test in a dev branch first

Supabase supports database branching. Before running this migration against your production database:

1. Create a Supabase branch from production
2. Apply the migration against the branch
3. Run the backfill
4. Verify schema, count of backfilled rows, slug uniqueness
5. Smoke-test the public portfolio (it should still render correctly via the old path because Phase 1B hasn't refactored yet)
6. Only after validation, merge the branch to production

If you don't have Supabase branching set up, the equivalent is: run against a local dev Supabase instance first, then staging, then production. **Never run a 4-table migration directly against production on first execution.**

---

## File structure

The migration will produce one new SQL file:

```
supabase/migrations/20260512_001_create_portfolio_tables.sql
```

This filename follows the existing convention (`20260508_001_create_simulations_and_admins.sql`, `20260508_002_activity_log_and_auth.sql`). Today's date prefix is `20260512`, sequence number `001`.

The single file contains, in this order:

1. The four `CREATE TABLE` statements (portfolio_profiles, portfolio_evidence, portfolio_simulation_visibility)
2. Indexes
3. RLS enable + policies
4. Triggers (updated_at triggers, auto-creation trigger, plus the SECURITY DEFINER function)
5. Storage policies (the four CREATE POLICY statements for storage.objects)

The backfill script is **NOT** in the migration file. It's a separate one-time script that runs after the migration applies. Reason: migrations should be deterministic and idempotent on schema; backfills should be explicit and reviewable separately.

Backfill file:

```
supabase/migrations/20260512_002_backfill_portfolio_profiles.sql
```

Or, alternatively, run as a one-off via the Supabase SQL editor or psql, without committing as a migration. **Recommend** committing it as a migration for reproducibility across environments.

---

## Documentation updates

After this migration is applied, update `docs/DATABASE.md` to:

1. Move the four "Phase 1 Pending — Portfolio tables" entries out of the Pending section and into the main Tables section
2. Document each table's columns, indexes, RLS, triggers
3. Add the new migration to the migrations table
4. Update the "DB triggers" section to mention `ensure_portfolio_profile()` and the auto-creation trigger
5. Add a note about the operational gotcha: portfolio file URLs are permanently accessible once issued

These doc updates should be made in the same commit as the migration to keep documentation and schema in sync.

---

## Acceptance criteria

This migration is considered complete and successful when all of the following are true:

- [ ] All four tables (`portfolio_profiles`, `portfolio_evidence`, `portfolio_simulation_visibility`) exist in the database
- [ ] Storage bucket `portfolio-evidence` exists and is public
- [ ] All RLS policies are enabled and tested (public read works, owner write works, cross-user write fails)
- [ ] `updated_at` triggers fire correctly on UPDATE
- [ ] Auto-creation trigger fires on `evaluation_results` INSERT (test by manually inserting an evaluation_result and confirming the portfolio_profiles row appears)
- [ ] Backfill script runs without errors and creates the expected number of rows (compare against `SELECT COUNT(DISTINCT candidate_user_id) FROM evaluation_results`)
- [ ] Existing portfolio URLs still render correctly (because Phase 1B hasn't refactored the read path yet, this is a side-by-side validation)
- [ ] `docs/DATABASE.md` is updated to reflect the new schema
- [ ] Migration file committed to git on the `landing-page` branch and pushed to GitHub

---

## What this migration does NOT do

To set expectations on scope clearly — this migration is intentionally **only the schema layer**. It does NOT:

- Modify any application code (portfolio rendering, fetch functions, API routes) — that's Phase 1B
- Build the candidate dashboard — that's Phase 1C
- Build the artefact upload UI — that's Phase 1D
- Build the bio/social links UI — that's Phase 1E
- Add framework alignment metadata to scenarios — separate work tied to the framework alignment doc
- Backfill `portfolio_evidence` or `portfolio_simulation_visibility` — these start empty; candidates populate them as they use new features

After Phase 1A:

- Every existing candidate has a `portfolio_profiles` row with auto-generated slug
- The new tables exist and are queryable
- Every new candidate who completes a simulation gets a portfolio_profile auto-created via trigger
- The existing public portfolio (at `/portfolio/[slug]` URLs derived from the old path) continues to render unchanged
- No candidate-facing feature has changed yet

---

## Claude Code execution prompt

When you're ready to execute this migration, paste this prompt into Claude Code:

```
I'm implementing Phase 1A of the portfolio architecture migration.
The full specification lives at /docs/CareerBridge_Portfolio_Phase1A_Migration_Spec.md.

Before doing anything else:
1. Read the spec file in full
2. Confirm you understand what's being asked
3. Do not make assumptions outside the spec

Then create exactly two new files, in this order:

File 1: supabase/migrations/20260512_001_create_portfolio_tables.sql
  Contents per the spec, in this exact order:
  - CREATE TABLE portfolio_profiles
  - CREATE TABLE portfolio_evidence (with the CHECK constraint exactly as written)
  - CREATE TABLE portfolio_simulation_visibility
  - All indexes (in the order listed in the spec)
  - ALTER TABLE ... ENABLE ROW LEVEL SECURITY for each
  - All RLS policies for each table (in the order listed)
  - updated_at triggers
  - ensure_portfolio_profile() function (the SECURITY DEFINER one)
  - Auto-creation trigger on evaluation_results
  - Storage RLS policies on storage.objects (the four CREATE POLICY statements)

File 2: supabase/migrations/20260512_002_backfill_portfolio_profiles.sql
  Contents per the spec — the DO block that backfills portfolio_profiles
  for existing candidates with evaluation_results.

After creating the files:
- Do NOT run the migrations
- Do NOT apply anything to the database
- Do NOT modify docs/DATABASE.md yet
- Show me a diff of the files you've created

I will review the files before deciding whether to apply them. If anything in the spec
is unclear or contradicts existing code patterns, raise it before generating SQL.

Reference: the existing migrations 20260420_001_create_all_tables.sql and
20260508_001_create_simulations_and_admins.sql are the canonical pattern for how
CREATE TABLE / RLS / indexes are structured. Match their style.
```

This prompt:

- Pins Claude Code to file generation only, no execution
- References the spec file as the source of truth
- Forbids assumption-making outside the spec
- Asks for a diff for review before any further action
- Names the existing migrations as the style reference

After Claude Code generates the files, you review them line-by-line. Only after you've satisfied yourself the SQL matches this spec do you run them.

---

## Next phases (preview, not in scope for Phase 1A)

After Phase 1A is implemented and validated:

**Phase 1B — Refactor existing portfolio code**
- Update `getPortfolioBySlug()` to read from `portfolio_profiles` joined with `evaluation_results`, `simulation_responses`, `credential_issuances`
- Add visibility logic (check `portfolio_simulation_visibility` for per-simulation overrides, fall back to global defaults)
- Verify the public portfolio at `/portfolio/[slug]` renders identically to before
- Cutover plan: change reads while writes continue to old + new paths until validation

**Phase 1C — Candidate dashboard**
- New route `/dashboard/portfolio`
- Header editor (display_name, bio, social_links)
- Visibility controls per simulation
- Soft-nudge banner for new candidates

**Phase 1D — Artefact upload**
- Evidence manager UI on dashboard
- File upload to `portfolio-evidence` storage bucket
- External link uploads
- Sort order, visibility per artefact
- Display on simulation cards in public portfolio

**Phase 1E — Bio + social links display**
- Render bio + social links on portfolio header
- Validation, character limits, URL validation

Each phase will have its own spec document, drafted after the preceding phase is validated. Don't try to do them in parallel — sequence is the safety mechanism.

---

## Open questions for Victor

1. **`profiles.full_name` column existence:** ✅ **RESOLVED** (12 May 2026 schema verification). The column exists and is the correct source for display name. Function uses it via `SELECT full_name FROM public.profiles WHERE id = NEW.user_id`.

2. **Display name source of truth:** is `profiles.full_name` always populated when a candidate signs up? If not, the fallback `"Career Bridge Candidate"` handles it, but you might want a better default (e.g. extract from `auth.users.email`).

3. **Slug collision behaviour:** the spec allows numeric suffixes (`john-smith`, `john-smith-2`). Are you happy with this UX, or do you want a different pattern (e.g. middle initials, random suffix)?

4. **Storage bucket creation timing:** create the bucket manually now, or defer until Phase 1D when artefact upload UI is built? Recommend creating now so it's in place when needed.

5. **Backfill timing:** apply the migration and run the backfill in the same maintenance window, or as separate operations? Recommend same window so the system is in a consistent state quickly.

6. **Existing candidates with multiple `evaluation_results`:** the auto-creation trigger handles this correctly (idempotent), but worth confirming — are there candidates in your current data who have multiple completed simulations? If yes, the backfill creates exactly one portfolio per candidate as designed.

7. **Sheffield Hallam cohort timing:** when is the July intake date specifically? The migration should ideally be in place several weeks before, so Phase 1B-1E can build on it without rush.

---

## Document maintenance

- This spec is version 0.2, draft. Lock to 1.0 after Victor reviews and approves.
- Any changes to the migration after lock should be documented as a follow-up migration, not by editing this spec retroactively.
- Spec file lives at `docs/CareerBridge_Portfolio_Phase1A_Migration_Spec.md` once approved.

---

## Change log

- **v0.1 (12 May 2026):** Initial draft. Assumed `profiles.user_id` and `evaluation_results.candidate_user_id` column names.
- **v0.2 (12 May 2026):** Corrected after schema verification in Claude Code. Real column names in existing schema: `profiles.id` (no separate user_id column), `evaluation_results.user_id` (no candidate_ prefix), `credential_issuances.candidate_user_id` (with prefix). Trigger function and backfill script updated to use correct column references. New portfolio tables retain `candidate_user_id` (matches `credential_issuances`); trigger function maps `NEW.user_id` from `evaluation_results` to `candidate_user_id` on insert. Documented existing schema inconsistency as technical debt for a future column-rename migration. **Additional verification 12 May 2026:** confirmed no competing triggers on `evaluation_results`; confirmed `EXECUTE FUNCTION public.update_updated_at()` is the established trigger syntax (with schema qualification); confirmed `gen_random_uuid()` works without explicit CREATE EXTENSION (Supabase preinstalls pgcrypto); confirmed `portfolio-evidence` will be the first Supabase storage bucket in the project.

---

**End of draft v0.2.**
