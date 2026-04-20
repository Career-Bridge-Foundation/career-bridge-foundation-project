# Persistence Audit — Career Bridge Foundation
## Date: 2026-04-20

---

## 1. localStorage Usage Map

| # | File Path | Key Name | Data Shape | Usage | Dependent Component |
|---|-----------|----------|------------|-------|---------------------|
| 1 | `hooks/useSimulation.ts` | `"sim-product-strategy"` | `{ currentStep: number, responses: Record<number, StepResponse>, attachedUrls: string[] }` — StepResponse: `{ text?, file?: { name, size }\|null, url?, rationale?, mode?: "typed"\|"upload" }` | Read on mount (restore state), Write every 30 s (auto-save) | `app/simulate/[id]/page.tsx` |
| 2 | `hooks/useEvaluation.ts` | `"evaluation-result-{simulationId}"` e.g. `"evaluation-result-product-strategy"` | `{ overallScore: number, maxScore: number, percentage: number, verdict: string, verdictDescription: string, credentialIssued: boolean, tasks: EvaluationTask[] }` — EvaluationTask: `{ taskId, title, score, maxScore, criteria: EvaluationCriterion[], summary }` — EvaluationCriterion: `{ name, score: 1\|2\|3, level: "Weak"\|"Competent"\|"Strong", feedback }` | Write after `POST /api/evaluate` resolves, Read on results page mount (with 60 s polling fallback) | `hooks/useEvaluation.ts` (write), `app/simulate/[id]/results/page.tsx` (read) |

### Notes on file uploads
Actual `File` objects (binary) are held in React state only (`uploadedFiles: File[]` inside `useSimulation`). They are **never written to localStorage** — only metadata `{ name, size }` is stored. Files are lost on page refresh before submission. This is a separate migration concern (Supabase Storage bucket).

---

## 2. Existing Supabase Tables

**Status: No custom tables exist.**

The Supabase project is configured and reachable (URL and anon key confirmed in `.env.local`). The only active Supabase functionality is **Auth** — session management via `@supabase/ssr` in `middleware.ts`.

- `lib/supabase/client.ts` — browser client factory (no table queries)
- `lib/supabase/server.ts` — server client factory (no table queries)
- `middleware.ts` — calls `supabase.auth.getUser()` to refresh session tokens

There is no `supabase/migrations/` directory, no `.sql` files anywhere in the project, and no database type definitions in `types/`.

---

## 3. Gap Analysis

### Data in localStorage with NO corresponding Supabase table

| localStorage Key | Missing Table | Impact |
|------------------|---------------|--------|
| `"sim-product-strategy"` | No `simulation_sessions` or `simulation_responses` table | Progress lost if localStorage cleared; no cross-device sync; no audit trail |
| `"evaluation-result-{id}"` | No `evaluation_results` table | Results lost if localStorage cleared; credentials can't be verified server-side; no history |

### Supabase tables that exist but are not used by the app

None — no custom tables exist yet.

### Missing infrastructure (beyond tables)

| Gap | Details |
|-----|---------|
| No Supabase Storage bucket | File uploads (PDF, DOCX, etc.) are memory-only; lost on refresh before submission |
| No user profile table | `auth.users` exists but no `profiles` table for full_name, user_type, etc. (currently only stored in Supabase Auth user metadata) |
| No credential issuance record | `credentialIssued: boolean` lives in localStorage; no server record of credentials earned |
| No Stripe → user link | Stripe webhook has a `// TODO: connect to Supabase` comment; paid access is not enforced |

---

## 4. Recommended Tables

### `simulation_sessions`
Links an authenticated user to a simulation attempt. Parent record for all other data.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users.id`, NOT NULL |
| `simulation_slug` | `text` | NOT NULL (e.g. `"product-strategy"`) |
| `current_step` | `integer` | NOT NULL, default 0 |
| `attached_urls` | `text[]` | NOT NULL, default `'{}'` |
| `status` | `text` | `"in_progress"` \| `"submitted"` \| `"evaluated"`, default `"in_progress"` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

RLS: users can only read/write their own rows (`user_id = auth.uid()`).

---

### `simulation_responses`
One row per task per session. Child of `simulation_sessions`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `session_id` | `uuid` | FK → `simulation_sessions.id` ON DELETE CASCADE, NOT NULL |
| `task_index` | `integer` | NOT NULL (0–4) |
| `response_text` | `text` | nullable |
| `response_url` | `text` | nullable |
| `rationale` | `text` | nullable |
| `mode` | `text` | `"typed"` \| `"upload"` \| null |
| `file_name` | `text` | nullable (metadata only) |
| `file_size` | `integer` | nullable (bytes) |
| `file_storage_path` | `text` | nullable (Supabase Storage path if uploaded) |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

Unique constraint: `(session_id, task_index)` — one response per task per session.
RLS: inherit via session ownership (`session_id` → `simulation_sessions.user_id = auth.uid()`).

---

### `evaluation_results`
Full evaluation output from Claude. One row per session. Child of `simulation_sessions`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `session_id` | `uuid` | FK → `simulation_sessions.id` ON DELETE CASCADE, UNIQUE, NOT NULL |
| `overall_score` | `integer` | NOT NULL |
| `max_score` | `integer` | NOT NULL |
| `percentage` | `numeric(5,2)` | NOT NULL |
| `verdict` | `text` | NOT NULL |
| `verdict_description` | `text` | NOT NULL |
| `credential_issued` | `boolean` | NOT NULL, default false |
| `tasks_json` | `jsonb` | NOT NULL (full `EvaluationTask[]` array) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

RLS: users can only read their own rows.

---

### `profiles` *(recommended addition)*
Extends `auth.users` with app-specific fields. Currently full_name and user_type are only in Supabase Auth user metadata.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, FK → `auth.users.id` ON DELETE CASCADE |
| `full_name` | `text` | nullable |
| `user_type` | `text` | `"candidate"` \| `"coach_trainer"` \| `"institution"` \| `"admin"`, default `"candidate"` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Auto-populated via a Supabase Auth trigger on `INSERT` to `auth.users`.

---

## 5. Recommended Migration Order

Dependencies flow top-to-bottom — each step depends on the previous.

1. **Create `profiles` table + Auth trigger**
   - No app-level dependencies; self-contained
   - Unblocks user-specific data queries in all subsequent steps

2. **Create `simulation_sessions` table**
   - Depends on: `auth.users` (via profiles or direct FK)
   - Migrate `useSimulation.ts` to upsert session on every auto-save

3. **Create `simulation_responses` table**
   - Depends on: `simulation_sessions`
   - Migrate `useSimulation.ts` to upsert one response row per task on save

4. **Create `evaluation_results` table**
   - Depends on: `simulation_sessions`
   - Migrate `app/api/evaluate/route.ts` to INSERT result after Claude responds
   - Migrate `hooks/useEvaluation.ts` to read from Supabase instead of localStorage
   - Migrate `app/simulate/[id]/results/page.tsx` to query Supabase (remove polling loop)

5. **Set up Supabase Storage bucket for file uploads** *(lower priority)*
   - Create `simulation-uploads` bucket with per-user path policy
   - Update upload flow in `app/simulate/[id]/page.tsx` to upload on file select
   - Store returned `file_storage_path` in `simulation_responses.file_storage_path`

6. **Wire Stripe webhook to Supabase** *(separate concern)*
   - `app/api/stripe/webhook/route.ts` has `// TODO: connect to Supabase`
   - Add `stripe_customer_id` and `access_tier` to `profiles` table
   - Update webhook to set `access_tier` on payment success

---

## 6. localStorage Keys to Remove After Migration

Once Supabase persistence is confirmed working, remove these localStorage calls:

| Key | Files to Update |
|-----|----------------|
| `"sim-product-strategy"` | `hooks/useSimulation.ts` |
| `"evaluation-result-{simulationId}"` | `hooks/useEvaluation.ts` |

Keep localStorage as a **write-through cache** during the transition period to avoid breaking the results page if the Supabase read fails.
