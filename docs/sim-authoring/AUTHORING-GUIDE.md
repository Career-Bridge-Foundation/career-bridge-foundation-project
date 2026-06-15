# Simulation authoring guide (Spec 08 — Option B: bulk JSON import)

Author CTI (and other) simulations at volume via **`POST /api/admin/simulations/import`** (admin/staff session). One JSON body writes **metadata + prompts + the full rubric** per sim, batchable. Confirmed against prod by the Spec 08 audit.

Files in this folder:
- **`vitara-cti-reference.json`** — the live `threat-intelligence-at-vitara-health` sim as a complete, valid import object. **Known-good** (the sim Oladele scored a Distinction on) → use as the reference shape **and** as a re-importable backup.
- **`cti-sim-template.json`** — a blank fillable skeleton (one sim; the `_instructions` key is ignored on import).

## The contract (what the endpoint writes)

`{ "simulations": [ <row>, ... ] }` — each row processed independently; failures reported in the response `failed[]`. **Multi-table, non-atomic but recoverable** (delete-then-insert for prompts + rubric → re-POST a failed sim to replace partial state).

| Block | Target table | Write strategy |
|-------|-------------|----------------|
| metadata + gated content | `simulations` | **upsert by `slug`** |
| `prompts[]` | `simulation_prompts` | delete-by-`simulation_id` then insert |
| `rubric` | `rubrics` | delete-by-`simulation_id` then insert (`version=1`, `is_active=true`) |

### Metadata fields (all map to real prod columns)
`slug` (upsert key; lowercase/numbers/hyphens, 2–60) · `title` (≤120) · `company` (≤80) · `industry` (≤60) · `difficulty` (**exactly** `Foundation`\|`Practitioner`\|`Advanced`) · `time` (≤40) · `type` (optional) · `description` (optional, ≤280; catalog card) · `discipline` · `video_url` (URL or `""`) · `status` (`draft`\|`pending_review`\|`published`\|`archived`; **`published`** to appear in `simulations_catalog`/the grid) · `display_order` (set per sim; default 0) · **`sim_role`, `brief_short`, `brief_full`, `video_transcript`** (the gated IP the candidate/mentor see).

> ⚠️ **Do NOT add a row-level `time_remaining` field** — there is no such prod column (stale-migration artifact). Per-task timing lives on `prompts[].timeRemainingMinutes`.

### Prompts (`prompts[]` → `simulation_prompts`)
`type` (`typed`\|`url`\|`either`) · `title` (≤200) · `question` (≤2000) · `guidance` (0–20 bullets, ≤200 each) · `minWords` (0–5000) · `timeRemainingMinutes` (optional, 1–180). **Omit `id`** (auto-UUID). Array order = task order (`display_order` auto).

### Rubric (`rubric` → `rubrics`)
| Field | Role |
|-------|------|
| **`systemPrompt`** | **THE ENGINE.** `/api/evaluate` feeds **only** `system_prompt` + `model` to the model. The 5 tasks, the 3 criteria/task (Weak/Competent/Strong descriptors), scoring (1–3 per criterion → max 45), and the band thresholds **must be embedded in this prose**. (Vitara's is ~7,531 chars.) |
| `maxScore` | int ≥1 (45 for the 5×3×3 scheme) |
| `verdictBands` | array of `{ min, max, label, credential }`. **Use exactly:** `Distinction` · `Pass with Merit` · `Pass` · `Borderline` · `Did Not Pass`. |
| `criteria`, `scoringScale` | **required** (NOT NULL columns) but **NOT read by eval** — reference/display only |
| `model` | default `claude-sonnet-4-6` |
| `outputInstructions` | optional / `null` |

## The verdict-vocabulary rule (issue #49) — important
The rubric speaks **Vocabulary B** (`Pass with Merit`); everything stored/downstream speaks **Vocabulary A** (`Merit`). `/api/evaluate` bridges via `toVerdictBand("Pass with Merit") → "Merit"` before storing. So:
- Author bands with **`Pass with Merit`** (matches the reference + the mapping). It stores as `Merit` → **qualifies for the credential** (`{Distinction, Merit, Pass}`).
- Other labels pass through unchanged. **Don't invent a label** outside the five above, or it won't bridge to the credential and will rank as unknown.

## How a sim flows once imported (so you know it works)
1. `status: published` → appears in `simulations_catalog` → the discipline grid (`/simulations/cyber-security`).
2. Card → `/simulations/cyber-security/<slug>` → the player (`simulate/[id]/page.tsx`).
3. Candidate completes tasks → `/api/evaluate` reads the **active rubric by slug** (`is_active=true`) → scores against `systemPrompt` → writes `evaluation_results` (verdict via `toVerdictBand`).
4. Results page → "Claim credential" (verdict ∈ {Distinction, Merit, Pass}) → Certifier → portfolio.

> CTI (cyber-security) has a working take-route. The other 6 disciplines do **not** yet (issue #60) — publishing a sim in those disciplines makes it visible but unreachable until #60 is fixed.

## Gotchas
- **Re-import = replace** (upsert by slug + delete-then-insert) → editing a sim = re-POST the whole row. No prompt/rubric versioning via import (the per-sim rubric endpoint that versions is **broken + not for authoring** — issue #61).
- **`systemPrompt` carries the real logic** — `criteria`/`verdictBands` columns are cosmetic to the scorer. Get the prose right.
- Validate locally against `SimulationImportSchema` (`lib/schemas/simulation.ts`) before POSTing a big batch.

## Related issues
- **#60** — only cyber-security + product-management have take-routes (scale blocker, not launch).
- **#61** — `PUT …/[slug]/rubric` broken + redundant (don't use for authoring).
- **#49** — verdict-vocabulary split (handled by `toVerdictBand`; tidy-up).
