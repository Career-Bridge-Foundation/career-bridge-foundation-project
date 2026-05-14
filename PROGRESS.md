# Career Bridge Foundation — Build Progress

**Simulation:** Nexus Bank Startup Account: Product Strategy Simulation
**Last updated:** 2026-04-15

---

## Overall Progress

| Step | Description | Status |
| ---- | ----------- | ------ |
| 1 | Supabase setup — create tables, test connection | Not started |
| 2 | Simulation landing page | **Done** |
| 3 | Prompt screens — step-by-step flow, one prompt per screen | Not started |
| 4 | Submission handling — wire forms to Supabase | Not started |
| 5 | Claude API evaluation endpoint | Not started |
| 6 | Results page — scores, feedback, shareable URL | Not started |
| 7 | Coach dashboard — password-protected, CSV export | Not started |
| 8 | End-to-end test — typed, file upload, URL submissions | Not started |

---

## What Has Been Built

### Infrastructure

- **Next.js 16.2.3** project initialised with App Router and TypeScript
- **Tailwind CSS v4** configured (CSS-first, `@theme inline {}` in `globals.css`)
- **shadcn/ui canary** initialised and components installed
- **Plyr** installed for video playback
- **Brand design tokens** added to `globals.css` (navy, amber, success, warning, danger, surface colours, text colours)

### File Structure Created

```
app/
├── globals.css                        — Tailwind v4 + shadcn tokens + Career Bridge brand tokens
├── layout.tsx                         — Root layout
├── page.tsx                           — Home page: navbar + simulation selector
└── simulate/
    └── [id]/
        └── page.tsx                   — Dynamic simulation landing page (async params, Next.js 16)

components/
├── layout/
│   └── Navbar.tsx                     — Career Bridge logo bar
├── home/
│   └── SimulationSelector.tsx         — Select dropdown + redirect to /simulate/[id]
├── simulation/
│   ├── SimulationHero.tsx             — Title, discipline/company badges, role + time meta
│   ├── VideoPlayer.tsx                — Plyr instance (client-only)
│   ├── VideoPlayerWrapper.tsx         — next/dynamic ssr:false wrapper (required for Plyr + SSR)
│   ├── ScenarioBrief.tsx              — Scenario text rendered as paragraphs
│   └── CandidateGate.tsx             — "Start Simulation" button + name/email dialog
└── ui/
    — button, input, card, separator, label, dialog, badge, select (all shadcn/ui canary)

lib/
├── utils.ts                           — shadcn/ui cn() utility
└── data/
    └── simulations.ts                 — Static seed data for all simulations (replaces Supabase in Step 4)

types/
└── simulation.ts                      — Shared TypeScript types: Simulation, SimulationPrompt, SubmissionType
```

### Pages and Routes

| Route | What it does | Status |
| ----- | ------------ | ------ |
| `/` | Home page — navbar + simulation selector dropdown | Done |
| `/simulate/[id]` | Simulation landing page — hero, video, brief, start gate | Done |
| `/simulate/[id]/prompt/[step]` | Prompt screens (Step 3) | Not started |
| `/results/[token]` | Public shareable results page (Step 6) | Not started |
| `/admin/dashboard` | Password-protected coach dashboard (Step 7) | Not started |
| `/api/evaluate` | Claude API evaluation endpoint (Step 5) | Not started |
| `/api/certifier` | Certifier credential issuance endpoint (Step 6) | Not started |

### Seed Data

- `nexus-bank-pm-v1` — full Nexus Bank PM simulation loaded from `lib/data/simulations.ts`
- All three prompts populated with correct submission types (typed / either / url)
- `videoUrl` set to `null` — video player is hidden until HeyGen video is ready (see SPEC Section 8.3)

---

## Known Decisions and Notes

- **Plyr + SSR:** Plyr accesses `document` at module evaluation time. Fixed with `VideoPlayerWrapper.tsx` which holds `next/dynamic` with `ssr: false`. This must stay as a Client Component — do not move the dynamic import back to a Server Component.
- **Candidate data storage (temporary):** `CandidateGate` stores name and email in `sessionStorage` under the key `cb_candidate`. This is replaced by a Supabase `attempts` row in Step 4.
- **Seed data vs Supabase:** `lib/data/simulations.ts` is the source of truth for simulation content until Step 1 (Supabase) is complete. The `getSimulation(id)` function signature will remain the same — only the implementation changes.
- **Async params (Next.js 16):** All dynamic route pages use `params: Promise<{ id: string }>` with `await props.params`. Do not use the old synchronous `params.id` pattern.
- **`app/page.tsx` home page:** Lists simulations from `SIMULATION_IDS` array. Add new simulation IDs there as they are created.

---

## Next Steps (in order)

### Step 1 — Supabase Setup
- Create `simulations` and `attempts` tables (schema in SPEC Section 7.5)
- Add indexes on `shareable_token`, `candidate_email`, `simulation_id`
- Add environment variables to `.env.local` (see SPEC Section 9, Environment Variables)
- Seed the `simulations` table with the Nexus Bank simulation data from `lib/data/simulations.ts`
- Replace `getSimulation()` in `lib/data/simulations.ts` with a Supabase query

### Step 3 — Prompt Screens
- Route: `app/simulate/[id]/prompt/[step]/page.tsx`
- One prompt per screen, forward-only navigation
- Prompt 1: typed textarea, live word count, 200–400 word guidance, min 50 words to submit
- Prompt 2: typed textarea OR file upload (PDF/Word, max 10MB)
- Prompt 3: typed textarea OR file upload OR URL + required rationale field (min 50 words)
- Progress indicator: "Step X of 3"
- Scenario brief accessible throughout (collapsible)
- Responses stored in `sessionStorage` until Step 4 wires to Supabase

### Step 4 — Submission Handling
- On simulation start: create `attempts` row in Supabase, store attempt ID in session
- On each prompt submit: write response to `attempts.responses` JSONB field
- File uploads: store in Supabase Storage at `/simulation-uploads/[attempt_id]/`
- Extract PDF text with `pdf-parse`, Word text with `mammoth` (server-side only)
- Trigger evaluation (Step 5) after all three prompts are submitted

### Step 5 — Claude API Evaluation
- `POST /api/evaluate` — one call per prompt, never batched
- Model: `claude-sonnet-4-20250514`, temperature 0, max tokens 1000
- Parse and validate JSON response against expected shape (SPEC Section 7.3)
- Store result in `attempts.evaluation_result`
- On invalid JSON: retry once, then show "processing" message and flag for manual review

### Step 6 — Results Page
- Route: `/results/[token]` — publicly accessible, no login
- Generate `shareable_token` (crypto.randomUUID) on completion
- Render per-prompt scores, feedback, overall verdict, summary
- Serve correct results video based on verdict band
- Trigger Certifier API if `overall_percentage >= 55`
- Store `certifier_credential_id` in `attempts` table

### Step 7 — Coach Dashboard
- Route: `/admin/dashboard` — simple password protection (ADMIN_PASSWORD env var)
- Table: all attempts with columns from SPEC Section 7.7
- Sort by `completed_at` descending, expand row for full evaluation breakdown
- CSV export button
- Flag rows where URL fetch failed during evaluation

### Step 8 — End-to-End Test
- Run three full simulations: typed only, file upload, URL submission
- Verify scores are reasonable, credential is issued, shareable URL works

---

## Environment Variables Needed

Create `.env.local` in the project root. This file must never be committed.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CERTIFIER_API_KEY=
ADMIN_PASSWORD=
```
