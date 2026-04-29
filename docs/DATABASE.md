# Database

_Last updated: 25 April 2026_

Schema source of truth: `supabase/migrations/`. Two migration files exist:

- `20260420_001_create_all_tables.sql` — tables 1–9, RLS, indexes, triggers
- `20260421_002_create_purchases_table.sql` — `purchases` table, RLS, indexes

All tables are in the `public` schema. RLS is enabled on every table. All write operations in API routes that need to bypass RLS use a Supabase admin client constructed with `SUPABASE_SERVICE_ROLE_KEY`.

> **Coach tables note:** `coaches`, `coach_candidates`, `simulation_assignments`, and `coach_notes` are defined in the migration and have full RLS policies, but no API routes or pages currently read from or write to them (except `coaches` which is written by the Stripe webhook on a coach-plan purchase). The coach feature is schema-ready but the application layer is unbuilt.

---

## Service role usage

The following API routes construct a Supabase admin client using `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS entirely for the listed operations:

- **`app/api/stripe/webhook/route.ts`** — INSERT `purchases`; UPDATE `profiles` (user_type); INSERT/UPDATE `coaches`
- **`app/api/purchases/consume/route.ts`** — SELECT + UPDATE `purchases` (incrementing `simulations_used`)
- **`app/api/certifier/issue/route.ts`** — SELECT `evaluation_results`; SELECT `profiles` (full_name); `auth.admin.getUserById` (email lookup); SELECT + upsert `credential_issuances`

All other routes use the user-scoped server client and rely on RLS.

---

## DB triggers

Two functions are defined and attached as triggers:

```sql
-- Auto-creates a profiles row on new user signup
public.handle_new_user()
  AFTER INSERT ON auth.users → INSERT INTO public.profiles

-- Updates updated_at column on row update
public.update_updated_at()
  BEFORE UPDATE ON: profiles, simulation_sessions, coaches, coach_notes
```

> **Tables without `updated_at`:** `evaluation_results`, `simulation_responses`, `coach_candidates`, `simulation_assignments`, and `credential_issuances` have no `updated_at` column and no update trigger. Do not add `updated_at` to these tables expecting auto-population — it would require a new migration to add the column and a new trigger attachment.

---

## Adding new migrations

**Naming convention:** `YYYYMMDD_NNN_description.sql` — matching the existing files:
- `20260420_001_create_all_tables.sql`
- `20260421_002_create_purchases_table.sql`

Use a zero-padded three-digit sequence number. Use underscores, no spaces. Keep the description short and lowercase.

**RLS:** Include `ENABLE ROW LEVEL SECURITY` and all `CREATE POLICY` statements in the same file as the `CREATE TABLE`. Both existing migrations follow this pattern — table definition, then RLS block, then indexes.

**Applying migrations:** _Needs confirmation — the repo has no Supabase CLI config (`supabase/config.toml`) or CI pipeline for `supabase db push`. Current practice is likely manual execution via the Supabase SQL editor. Confirm with the team before documenting this definitively._

---

## Tables

---

### 1. `profiles`

Extends `auth.users` with application-specific fields. One row per user, auto-created by the `on_auth_user_created` trigger.

```sql
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  user_type   TEXT NOT NULL DEFAULT 'candidate'
                CHECK (user_type IN ('candidate', 'coach', 'admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Mirrors `auth.users.id` — not generated, set on insert |
| `full_name` | TEXT | Sourced from `auth.users.raw_user_meta_data->>'full_name'` at signup |
| `user_type` | TEXT | `'candidate'` (default), `'coach'`, `'admin'` |
| `avatar_url` | TEXT | Unused in current UI |
| `created_at` | TIMESTAMPTZ | Set at insert |
| `updated_at` | TIMESTAMPTZ | Maintained by `update_updated_at` trigger |

**RLS policies:**
```sql
"Users can view own profile"   — SELECT WHERE auth.uid() = id
"Users can update own profile" — UPDATE WHERE auth.uid() = id
```
No INSERT policy — the trigger uses `SECURITY DEFINER` and bypasses RLS.

**Indexes:** None beyond the PK.

**Trigger:** `update_profiles_updated_at` — BEFORE UPDATE, sets `updated_at = now()`.

**Used by:**
- `app/api/stripe/webhook/route.ts` — UPDATE `user_type = 'coach'` on coach-plan purchase (admin client)
- `app/api/certifier/issue/route.ts` — SELECT `full_name` to populate Certifier recipient name (admin client)
- `app/simulate/[id]/results/page.tsx` — SELECT `full_name` to populate `CredentialCard` recipient name (browser client)

---

### 2. `simulation_sessions`

One row per user per simulation slug. Tracks progress state through the simulation lifecycle.

```sql
CREATE TABLE public.simulation_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug  TEXT        NOT NULL,
  discipline       TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, simulation_slug)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Referenced by `simulation_responses`, `evaluation_results` |
| `user_id` | UUID FK → `auth.users` | |
| `simulation_slug` | TEXT | e.g. `'product-strategy'` |
| `discipline` | TEXT | e.g. `'Product Management'` |
| `status` | TEXT | Lifecycle: `in_progress` → `submitted` → `evaluated` |
| `started_at` | TIMESTAMPTZ | |
| `submitted_at` | TIMESTAMPTZ | Set by `markSubmitted()` in `useSimulation` |
| `updated_at` | TIMESTAMPTZ | Maintained by trigger |

**Unique constraint:** `(user_id, simulation_slug)` — one active session per user per simulation.

**RLS policies:**
```sql
"Users can view own sessions"    — SELECT WHERE auth.uid() = user_id
"Users can insert own sessions"  — INSERT WHERE auth.uid() = user_id
"Users can update own sessions"  — UPDATE WHERE auth.uid() = user_id
"Coaches can view candidate sessions" — SELECT via coach_candidates join (accepted candidates only)
```

**Indexes:**
```sql
idx_simulation_sessions_user ON (user_id)
idx_simulation_sessions_slug ON (simulation_slug)
```

**Trigger:** `update_simulation_sessions_updated_at` — BEFORE UPDATE.

**Used by:**
- `hooks/useSimulation.ts` — SELECT existing `in_progress` session on mount; upsert on first save (conflict: `user_id, simulation_slug`); UPDATE `submitted_at` and `status = 'submitted'` via `markSubmitted()`
- `app/api/evaluate/route.ts` — UPDATE `status = 'evaluated'` after successful evaluation

---

### 3. `simulation_responses`

One row per task per session. Stores the candidate's typed response, any file URLs, and any link URLs for each task.

```sql
CREATE TABLE public.simulation_responses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_number    INTEGER     NOT NULL CHECK (task_number >= 1 AND task_number <= 5),
  response_text  TEXT,
  file_urls      TEXT[],
  link_urls      TEXT[],
  saved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, task_number)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID FK → `simulation_sessions` | CASCADE delete |
| `user_id` | UUID FK → `auth.users` | Denormalised for RLS |
| `task_number` | INTEGER | 1–5; 1-indexed |
| `response_text` | TEXT | The candidate's typed answer |
| `file_urls` | TEXT[] | Uploaded file URLs (feature exists in schema, upload UI not fully built) |
| `link_urls` | TEXT[] | External links attached by candidate |
| `saved_at` | TIMESTAMPTZ | Updated on each save |

**Unique constraint:** `(session_id, task_number)` — one row per task per session; upserted on save.

**RLS policies:**
```sql
"Users can view own responses"      — SELECT WHERE auth.uid() = user_id
"Users can insert own responses"    — INSERT WHERE auth.uid() = user_id
"Users can update own responses"    — UPDATE WHERE auth.uid() = user_id
"Coaches can view candidate responses" — SELECT via coach_candidates join
```

**Indexes:**
```sql
idx_simulation_responses_session ON (session_id)
idx_simulation_responses_user    ON (user_id)
```

**Used by:**
- `hooks/useSimulation.ts` — SELECT all responses for existing session on mount; upsert per task on debounced save (conflict: `session_id, task_number`)

---

### 4. `evaluation_results`

Full Claude evaluation output. One row per session. Written after evaluation completes; read by the results page and the certifier route.

```sql
CREATE TABLE public.evaluation_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug  TEXT        NOT NULL,
  verdict_band     TEXT        NOT NULL
                     CHECK (verdict_band IN ('Distinction', 'Merit', 'Pass', 'Borderline', 'Did Not Pass')),
  overall_score    NUMERIC(5,2),
  task_scores      JSONB       NOT NULL,
  criteria_scores  JSONB       NOT NULL,
  feedback_text    TEXT,
  raw_evaluation   JSONB       NOT NULL,
  evaluated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID FK → `simulation_sessions` | Unique — one evaluation per session |
| `user_id` | UUID FK → `auth.users` | Denormalised for RLS and certifier ownership check |
| `simulation_slug` | TEXT | e.g. `'product-strategy'` |
| `verdict_band` | TEXT | DB stores: `Distinction`, `Merit`, `Pass`, `Borderline`, `Did Not Pass`. Claude returns `"Pass with Merit"` which `toVerdictBand()` maps to `"Merit"` before writing. |
| `overall_score` | NUMERIC(5,2) | Out of 45 for a 5-task simulation |
| `task_scores` | JSONB | Array of `{taskId, title, score, maxScore, summary}` objects |
| `criteria_scores` | JSONB | Array of `{taskId, name, score, level, feedback}` objects |
| `feedback_text` | TEXT | Claude's one-sentence verdict description |
| `raw_evaluation` | JSONB | Full JSON response from Claude, stored verbatim |
| `evaluated_at` | TIMESTAMPTZ | |

**RLS policies:**
```sql
"Users can view own results"    — SELECT WHERE auth.uid() = user_id
"Users can insert own results"  — INSERT WHERE auth.uid() = user_id
"Coaches can view candidate results" — SELECT via coach_candidates join
```

> **Known bug — missing UPDATE policy:** `app/api/evaluate/route.ts` uses the **user-scoped server client** (not the admin client) for its upsert. The upsert has `onConflict: "session_id"`, so on a duplicate session it attempts an UPDATE. There is no UPDATE RLS policy, so the UPDATE is silently blocked. The route wraps the DB write in `try/catch` and continues on failure, meaning the candidate receives their result but the DB row is not updated. Re-evaluating an already-evaluated session will appear to succeed from the client but produce no DB change. Fix: either add an UPDATE policy (`USING (auth.uid() = user_id)`) or switch the upsert to use the admin client.

**Indexes:**
```sql
idx_evaluation_results_session ON (session_id)
idx_evaluation_results_user    ON (user_id)
```

**Used by:**
- `app/api/evaluate/route.ts` — upsert after Claude evaluation (conflict: `session_id`); uses **user-scoped server client** (see bug note above)
- `app/api/certifier/issue/route.ts` — SELECT `verdict_band`, `simulation_slug`, `user_id` by `session_id` (admin client)
- `hooks/useEvaluation.ts` — SELECT full row by `session_id` to render results page
- `app/simulate/[id]/results/page.tsx` — via `loadEvaluationResultFromSupabase()`

---

### 5. `coaches`

One row per coach user. Created by the Stripe webhook when a `'coach'` price-type purchase completes.

```sql
CREATE TABLE public.coaches (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_name  TEXT,
  max_seats          INTEGER     NOT NULL DEFAULT 10,
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `auth.users` | UNIQUE — one coach record per user |
| `organisation_name` | TEXT | Coach's employer or institution; not yet exposed in UI |
| `max_seats` | INTEGER | Default seat count for coach plans. Not yet enforced in code — no application logic checks this limit |
| `stripe_customer_id` | TEXT | Stripe customer ID set on coach purchase; used to associate future invoices or plan changes with the correct Stripe account |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Maintained by `update_coaches_updated_at` trigger |

**RLS policies:**
```sql
"Coaches can view own record"   — SELECT WHERE auth.uid() = user_id
"Coaches can update own record" — UPDATE WHERE auth.uid() = user_id
```

**Indexes:** `idx_coaches_user ON (user_id)`

**Trigger:** `update_coaches_updated_at` — BEFORE UPDATE.

**Used by:**
- `app/api/stripe/webhook/route.ts` — INSERT on coach purchase; UPDATE `stripe_customer_id` if already exists (admin client)
- Referenced by RLS join policies on `coach_candidates`, `simulation_assignments`, `coach_notes`, `credential_issuances`

---

### 6. `coach_candidates`

Invite-based relationship between a coach and a candidate. `candidate_user_id` is null until the invite is accepted.

```sql
CREATE TABLE public.coach_candidates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  candidate_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_email        TEXT        NOT NULL,
  invite_token        TEXT        NOT NULL UNIQUE,
  invite_status       TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (invite_status IN ('pending', 'accepted', 'revoked')),
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at         TIMESTAMPTZ
);
```

**RLS policies:**
```sql
"Coaches can manage own candidates" — ALL WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
```

**Indexes:**
```sql
idx_coach_candidates_coach     ON (coach_id)
idx_coach_candidates_candidate ON (candidate_user_id)
idx_coach_candidates_token     ON (invite_token)
```

**Used by:** No active API routes or pages. Schema only — coach invite flow is unbuilt.

---

### 7. `simulation_assignments`

Coach assigns a specific simulation to a candidate.

```sql
CREATE TABLE public.simulation_assignments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  candidate_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id       TEXT        NOT NULL,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, candidate_user_id, simulation_id)
);
```

**RLS policies:**
```sql
"Coaches can manage own assignments"  — ALL WHERE coach_id IN (...)
"Candidates can view own assignments" — SELECT WHERE auth.uid() = candidate_user_id
```

**Indexes:**
```sql
idx_simulation_assignments_coach     ON (coach_id)
idx_simulation_assignments_candidate ON (candidate_user_id)
```

**Used by:** No active API routes or pages. Schema only.

---

### 8. `coach_notes`

Private coach notes per candidate per simulation. `shared_with_candidate` controls whether the candidate can read the note.

```sql
CREATE TABLE public.coach_notes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id              UUID        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  candidate_user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id         TEXT        NOT NULL,
  note_content          TEXT,
  shared_with_candidate BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, candidate_user_id, simulation_id)
);
```

**RLS policies:**
```sql
"Coaches can manage own notes"    — ALL WHERE coach_id IN (...)
"Candidates can view shared notes" — SELECT WHERE auth.uid() = candidate_user_id AND shared_with_candidate = true
```

**Indexes:**
```sql
idx_coach_notes_coach     ON (coach_id)
idx_coach_notes_candidate ON (candidate_user_id)
```

**Trigger:** `update_coach_notes_updated_at` — BEFORE UPDATE.

**Used by:** No active API routes or pages. Schema only.

---

### 9. `credential_issuances`

Tracks the Certifier credential issued per candidate per simulation. The unique constraint prevents duplicate issuances; the route uses upsert for idempotency.

```sql
CREATE TABLE public.credential_issuances (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id                 UUID        REFERENCES public.coaches(id) ON DELETE SET NULL,
  simulation_id            TEXT        NOT NULL,
  certifier_credential_id  TEXT,
  certifier_credential_url TEXT,
  issued_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                   TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'issued', 'failed')),
  UNIQUE(candidate_user_id, simulation_id)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `candidate_user_id` | UUID FK → `auth.users` | |
| `coach_id` | UUID FK → `coaches` | Nullable; reserved for coach-issued credentials |
| `simulation_id` | TEXT | Equals `simulation_slug` (e.g. `'product-strategy'`) |
| `certifier_credential_id` | TEXT | Certifier's internal credential UUID (`publicId`); used to call `/issue` and `/send` |
| `certifier_credential_url` | TEXT | `https://credsverse.com/credentials/{publicId}` — constructed in the route when Certifier doesn't return a URL directly |
| `issued_at` | TIMESTAMPTZ | Set at initial insert; not updated on upsert |
| `status` | TEXT | `pending` → `issued` or `failed` |

**RLS policies:**
```sql
"Candidates can view own credentials"        — SELECT WHERE auth.uid() = candidate_user_id
"Coaches can view own candidate credentials" — SELECT WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
"Coaches can insert credentials"             — INSERT WHERE coach_id IN (...)
```
> Note: The candidate-facing claim flow uses the **admin client** (service role key) for all writes to `credential_issuances`, bypassing RLS entirely. The candidate SELECT policy is used only by the browser client on the results page for the idempotency read-back on load.

**Indexes:**
```sql
idx_credential_issuances_candidate ON (candidate_user_id)
idx_credential_issuances_coach     ON (coach_id)
```

**Used by:**
- `app/api/certifier/issue/route.ts` — SELECT for idempotency check; upsert with `status = 'issued'` or `status = 'failed'` (admin client)
- `app/simulate/[id]/results/page.tsx` — SELECT `certifier_credential_url`, `status`, `issued_at` on page load to restore `CredentialCard` for returning users (browser client)

---

### 10. `purchases`

One row per completed Stripe payment. Written by the webhook handler; read by the credit-check and credit-consumption logic.

```sql
CREATE TABLE public.purchases (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_checkout_session_id  TEXT        NOT NULL UNIQUE,
  stripe_customer_id          TEXT,
  price_type                  TEXT        NOT NULL
                                CHECK (price_type IN ('single', 'bundle', 'portfolio', 'coach')),
  amount_paid                 INTEGER     NOT NULL, -- in pence (GBP)
  currency                    TEXT        NOT NULL DEFAULT 'gbp',
  simulation_credits          INTEGER     NOT NULL DEFAULT 1,
  simulations_used            INTEGER     NOT NULL DEFAULT 0,
  status                      TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'expired', 'refunded')),
  purchased_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ           -- null = never expires
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `auth.users` | |
| `stripe_checkout_session_id` | TEXT UNIQUE | Prevents duplicate webhook processing |
| `stripe_customer_id` | TEXT | Stripe customer ID; may be null |
| `price_type` | TEXT | `single` (1 credit), `bundle` (3), `portfolio` (see pricing.ts), `coach` |
| `amount_paid` | INTEGER | In pence — e.g. £49 = 4900 |
| `currency` | TEXT | Always `'gbp'` currently |
| `simulation_credits` | INTEGER | Total credits granted by this purchase |
| `simulations_used` | INTEGER | Incremented by `/api/purchases/consume` on each submission |
| `status` | TEXT | `active` is the only state currently set by code |
| `expires_at` | TIMESTAMPTZ | Null = no expiry |

**RLS policies:**
```sql
"Users can view own purchases" — SELECT WHERE auth.uid() = user_id
```
No INSERT or UPDATE RLS policy — all writes use the admin client (service role key).

**Indexes:**
```sql
idx_purchases_user           ON (user_id)
idx_purchases_stripe_session ON (stripe_checkout_session_id)
idx_purchases_status         ON (status)
```

**Used by:**
- `app/api/stripe/webhook/route.ts` — INSERT on `checkout.session.completed` (admin client)
- `app/api/purchases/consume/route.ts` — SELECT oldest active purchase with remaining credits; UPDATE `simulations_used + 1` (admin client)
- `lib/access-control.ts` — SELECT all active purchases to compute `remainingCredits` (browser client, RLS-protected)
- `app/simulate/[id]/page.tsx` — via `checkSimulationAccess()` from `lib/access-control.ts`

---

## Phase 1 Pending — Portfolio tables

The following tables are defined in [`/docs/CareerBridge_Portfolio_Phase1_Spec.md`](./CareerBridge_Portfolio_Phase1_Spec.md) (section 3) and will be added in a new migration during the Phase 1 sprint. They do not exist in the database yet.

---

### `portfolio_profiles` _(pending)_

One row per candidate. Auto-created after first simulation evaluation completes. Holds the candidate's public portfolio identity.

Key columns: `user_id` (UNIQUE FK), `slug` (UNIQUE, URL-safe), `headline`, `bio` (max 500 chars), `location`, `linkedin_url`, `external_links` (JSONB array), `is_public` (default true), `private_access_token`.

RLS: public SELECT on `is_public = true`; full access for owner.

---

### `portfolio_evidence` _(pending)_

Files and links uploaded by the candidate against a specific simulation. Supports images, PDFs, documents, and external links. Has `is_visible` and `sort_order` for candidate control.

RLS: public SELECT requires `is_visible = true` AND the parent `portfolio_profiles.is_public = true` (join to prevent privacy leak).

---

### `portfolio_simulation_visibility` _(pending)_

Per-simulation visibility toggles. Columns: `show_on_portfolio` (default true), `show_scores` (default true), `show_feedback` (default false). Rows only needed when candidate deviates from defaults.

RLS: public SELECT only when parent portfolio is public.

---

### Storage bucket: `portfolio-evidence` _(pending)_

Public bucket. File path structure: `portfolio-evidence/{user_id}/{filename}`. File URLs are permanently accessible once issued — setting `is_visible = false` hides the file from the portfolio page but does not revoke the URL.

---

_See [API_ROUTES.md](./API_ROUTES.md) for how each route interacts with these tables. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system overview._
