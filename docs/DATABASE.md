# Database

_Last updated: 11 May 2026_

Schema source of truth: `supabase/migrations/`. Migration files:

- `20260420_001_create_all_tables.sql` — tables 1–9, RLS, indexes, triggers
- `20260421_002_create_purchases_table.sql` — `purchases` table, RLS, indexes
- `20260425_003_add_evaluation_results_update_policy.sql` — UPDATE policy on `evaluation_results`
- `20260508_001_create_simulations_and_admins.sql` — `admins` and `simulations` (CMS) tables, `is_admin()`, RLS
- `20260508_002_activity_log_and_auth.sql` — `simulation_activity` table; replaces `is_admin()` to use `auth.email()`

All tables are in the `public` schema. RLS is enabled on every table. All write operations in API routes that need to bypass RLS use a Supabase admin client constructed with `SUPABASE_SERVICE_ROLE_KEY`.

> **Coach tables note:** `coaches`, `coach_candidates`, `simulation_assignments`, and `coach_notes` are defined in the migration and have full RLS policies, but no API routes or pages currently read from or write to them (except `coaches` which is written by the Stripe webhook on a coach-plan purchase). The coach feature is schema-ready but the application layer is unbuilt.

---

## Service role usage

The following API routes construct a Supabase admin client using `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS entirely for the listed operations:

- **`app/api/stripe/webhook/route.ts`** — INSERT `purchases`; UPDATE `profiles` (user_type); INSERT/UPDATE `coaches`
- **`app/api/purchases/consume/route.ts`** — SELECT + UPDATE `purchases` (incrementing `simulations_used`)
- **`app/api/certifier/issue/route.ts`** — SELECT `evaluation_results`; SELECT `profiles` (full_name); `auth.admin.getUserById` (email lookup); SELECT + upsert `credential_issuances`
- **`app/api/admin/simulations/**/route.ts`** (all admin CMS routes) — full read/write on `simulations` and `simulation_activity`. Authorisation is enforced one layer above the DB by `middleware.ts`, which gates every `/admin` and `/api/admin` request against the `ADMIN_EMAILS` env var. The `is_admin()` SQL function and admin RLS policies on `simulations` / `simulation_activity` are defence-in-depth — they would matter only if a non-admin code path ever used a user-scoped client to write to these tables.

All other routes use the user-scoped server client and rely on RLS.

---

## DB triggers

Three functions are defined and attached as triggers:

```sql
-- Auto-creates a profiles row on new user signup
public.handle_new_user()
  AFTER INSERT ON auth.users → INSERT INTO public.profiles

-- Updates updated_at column on row update (original)
public.update_updated_at()
  BEFORE UPDATE ON: profiles, simulation_sessions, coaches, coach_notes

-- Updates updated_at column on row update (added with CMS schema)
public.set_updated_at()
  BEFORE UPDATE ON: simulations
```

> **Two trigger functions doing the same thing:** `update_updated_at()` and `set_updated_at()` are functionally identical — the latter was introduced in `20260508_001` rather than reusing the existing function. Either function could maintain `updated_at` on any table. Worth consolidating in a future migration but harmless as-is.

> **Tables without `updated_at`:** `evaluation_results`, `simulation_responses`, `coach_candidates`, `simulation_assignments`, `credential_issuances`, and `simulation_activity` have no `updated_at` column and no update trigger. Do not add `updated_at` to these tables expecting auto-population — it would require a new migration to add the column and a new trigger attachment.

---

## Adding new migrations

**Naming convention:** `YYYYMMDD_NNN_description.sql` — matching the existing files:
- `20260420_001_create_all_tables.sql`
- `20260421_002_create_purchases_table.sql`

| Migration | Date applied | Method | Status |
|-----------|--------------|--------|--------|
| 20260420_001_create_all_tables | (historical) | SQL Editor (incremental scripts) | Schema present, file is partial reconstruction |
| 20260421_002_create_purchases_table | (historical) | SQL Editor (incremental scripts) | Schema present, file is partial reconstruction |
| 20260425_003_add_evaluation_results_update_policy | 2026-04-29 | SQL Editor | Applied and verified |
| 20260508_001_create_simulations_and_admins | 2026-05-08 | SQL Editor | Applied |
| 20260508_002_activity_log_and_auth | 2026-05-08 | SQL Editor | Applied |

> **Sequence-number convention drift:** The original three migrations used a single global sequence (`001` → `002` → `003`). The 8 May 2026 pair restarted at `001` within the date prefix. Both schemes sort correctly because the date prefix dominates, but mixing them makes the "next number" ambiguous. Pick one before the next migration: either continue the global sequence (`004`, `005`…) or commit to per-date sequences. Document the choice here.

Use a zero-padded three-digit sequence number. Use underscores, no spaces. Keep the description short and lowercase.

**RLS:** Include `ENABLE ROW LEVEL SECURITY` and all `CREATE POLICY` statements in the same file as the `CREATE TABLE`. Both existing migrations follow this pattern — table definition, then RLS block, then indexes.

**Applying migrations:** Migrations are currently applied manually via the Supabase SQL Editor. The Supabase CLI is installed and linked to the project (Pro tier) as of 29 April 2026, but `supabase db push` is not yet the application mechanism because the existing schema was built incrementally via 30+ ad-hoc SQL Editor scripts rather than tracked migrations. Schema reconciliation (using `supabase db pull` to baseline a clean migration history) is a planned future task. Until then: paste new migration SQL into a new SQL Editor query, run it, and commit the migration file to `supabase/migrations/` as documentation. Project linking details (project ref, region) live in `supabase/config.toml` and the local `.env.local`.

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

> **Known bug — missing UPDATE policy [RESOLVED 29 April 2026]:** `app/api/evaluate/route.ts` uses the **user-scoped server client** (not the admin client) for its upsert. The upsert has `onConflict: "session_id"`, so on a duplicate session it attempts an UPDATE. There is no UPDATE RLS policy, so the UPDATE is silently blocked. The route wraps the DB write in `try/catch` and continues on failure, meaning the candidate receives their result but the DB row is not updated. Re-evaluating an already-evaluated session will appear to succeed from the client but produce no DB change. Fix: either add an UPDATE policy (`USING (auth.uid() = user_id)`) or switch the upsert to use the admin client.
>
> **Resolution applied:** Migration `20260425_003_add_evaluation_results_update_policy.sql` took the first path — added the UPDATE RLS policy. Re-evaluations now correctly overwrite the previous row. Verified via `pg_policies` query against production immediately after applying. The `try/catch` pattern in `app/api/evaluate/route.ts` is unchanged and remains a latent risk for *other* silent-failure bugs of this shape — flagged for future audit.

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

## Admin / CMS schema

Added 8 May 2026 to support the in-app admin CMS for managing simulation content. Three tables plus an `is_admin()` SQL helper.

> **Naming collision:** the table `simulations` here is **not** the same as `simulation_sessions` (table 2) or `simulation_responses` (table 3). It is a new top-level table holding the *content of each simulation* (brief, prompts, etc.) — the published catalog that candidates browse. Until 8 May 2026 this content lived in code (`lib/simulations/*.ts` or similar). The admin CMS migrates that content into the database. Routes like `/api/admin/simulations` read and write this table; runtime reads use `getSimulations()` / `getSimBySlug()` in `lib/data.ts`.

---

### 11. `admins`

Allow-list of admin email addresses. Read by the `is_admin()` SQL function.

```sql
CREATE TABLE admins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | TEXT UNIQUE | Matched against `auth.email()` by `is_admin()` |
| `created_at` | TIMESTAMPTZ | |

**RLS:** RLS not explicitly enabled on this table by the migration. Only the service role and the `is_admin()` SQL function (`SECURITY DEFINER`) read it; no user-scoped reads happen in the application.

**Used by:**
- `is_admin()` SQL function — reads `email = auth.email()` to authorise writes against `simulations` and `simulation_activity` under their RLS policies
- No application code reads or writes this table. Admins are seeded manually via the SQL Editor (see commented `INSERT` at the bottom of `20260508_002_activity_log_and_auth.sql`).

> **Two parallel admin authorisation systems:** The application gate in `middleware.ts` uses the `ADMIN_EMAILS` env var, not this table. The `admins` table is consulted only by RLS policies on `simulations` / `simulation_activity`. Both must list the same emails for the system to behave consistently; there is no code that keeps them in sync. If you add or remove an admin, update **both** the env var **and** the `admins` table.

---

### 12. `simulations` (CMS content)

The published simulation catalog. One row per simulation slug. Public read; admin write.

```sql
CREATE TABLE simulations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        NOT NULL UNIQUE,
  title             TEXT,
  company           TEXT,
  industry          TEXT,
  type              TEXT,
  difficulty        TEXT        CHECK (difficulty IN ('Foundation','Practitioner','Advanced')),
  time              TEXT,
  description       TEXT,
  display_order     INT,
  sim_role          TEXT,
  brief_short       TEXT,
  brief_full        TEXT,
  video_transcript  TEXT,
  time_remaining    INT[],
  prompts           JSONB       DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Referenced by `simulation_activity.simulation_id` |
| `slug` | TEXT UNIQUE | URL-safe identifier — e.g. `'product-strategy'`. Validated by `SimulationMetadataSchema` (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 2–60 chars) |
| `title` / `company` / `industry` / `type` / `time` | TEXT | Catalog metadata. Length limits enforced at the Zod layer (`lib/schemas/simulation.ts`), not the DB |
| `difficulty` | TEXT | DB CHECK constrains to `Foundation` / `Practitioner` / `Advanced` |
| `description` | TEXT | Max 280 chars enforced by Zod |
| `display_order` | INT | Determines order on the public listing; assigned automatically on create (max + 1) and rewritten by the reorder endpoint |
| `sim_role` | TEXT | The role description shown to candidates inside the simulation |
| `brief_short` / `brief_full` | TEXT | Two views of the simulation brief |
| `video_transcript` | TEXT | Optional video transcript |
| `time_remaining` | INT[] | Per-prompt time budgets (seconds); array length must match `prompts.length` (Zod-enforced) |
| `prompts` | JSONB | Array of `{id, type, title, question, guidance, minWords}`. IDs are 1-indexed and re-sequenced server-side by the content PATCH route |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` maintained by `set_updated_at` trigger |

**Indexes:** `idx_simulations_display_order ON (display_order)`

**RLS:**
```sql
"public_select" — SELECT  USING (true)
"admin_write"   — ALL     USING (is_admin())  WITH CHECK (is_admin())
```
Anyone can read; only admins (per `admins` table via `is_admin()`) can write. In practice admin routes use the service role and bypass RLS — the policy is the second line of defence.

**Trigger:** `trg_set_updated_at` — BEFORE UPDATE, sets `updated_at = now()` via `set_updated_at()`.

**Used by:**
- `lib/data.ts` — `getSimulations()` and `getSimBySlug()` via `supabaseServer` (RLS-safe under `public_select`)
- All `app/api/admin/simulations/**/route.ts` routes — full CRUD via service role
- `app/admin/page.tsx` and admin list/detail/content pages — read via `getSimulations()` / `getSimBySlug()`
- Public listing and `app/simulations/[slug]/page.tsx` — read via `getSimBySlug()`

---

### 13. `simulation_activity`

Audit log of every admin write to a simulation. One row per `created` / `updated_metadata` / `updated_content` / `deleted` event. Read by the activity timeline on the simulation edit page.

```sql
CREATE TABLE simulation_activity (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id  UUID        REFERENCES simulations(id) ON DELETE CASCADE,
  user_email     TEXT        NOT NULL,
  action         TEXT        NOT NULL
                   CHECK (action IN ('created','updated_metadata','updated_content','deleted')),
  diff           JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `simulation_id` | UUID FK → `simulations(id)` | CASCADE on simulation delete — a `deleted` activity row is removed along with the simulation it describes. If you need a durable deletion record, switch to `ON DELETE SET NULL` and store the slug in `diff`. |
| `user_email` | TEXT | Resolved server-side from the request's Supabase session (`'unknown'` if unresolved) |
| `action` | TEXT | One of four lifecycle events |
| `diff` | JSONB | Shape varies by action: `created` → none; `updated_metadata` → `{before, after}`; `updated_content` → `{promptCount}`; `deleted` → `{title, slug}` |
| `created_at` | TIMESTAMPTZ | |

**Indexes:**
```sql
idx_activity_simulation_id ON (simulation_id)
idx_activity_created_at    ON (created_at DESC)
```

**RLS:**
```sql
"admin_all_activity" — ALL  USING (is_admin())  WITH CHECK (is_admin())
```
No public read; only admins. Service-role writes from the admin routes bypass this.

**Used by:**
- `lib/supabase/log-activity.ts` — fire-and-forget INSERT after each successful admin mutation. Never throws — a logging failure does not break the response.
- `app/api/admin/simulations/[slug]/activity/route.ts` — SELECT last 50 rows for a given simulation
- `app/admin/simulations/[slug]/page.tsx` — renders the activity timeline tab

---

### `is_admin()` — RLS helper

```sql
CREATE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM admins WHERE email = auth.email());
$$;
```

Used in the `admin_write` policy on `simulations` and `admin_all_activity` policy on `simulation_activity`. `SECURITY DEFINER` lets the function read `admins` regardless of the caller's privileges. The current definition (from `20260508_002`) uses `auth.email()`; the prior definition (from `20260508_001`) read `request.jwt.claims->>'email'` manually and was replaced because `auth.email()` is the canonical Supabase helper.

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
