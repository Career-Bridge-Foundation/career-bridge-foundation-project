@AGENTS.md

# Career Bridge Foundation — Project Guidance for Claude Code

This file is read by Claude Code at session start to apply project conventions automatically.
Maintained by the Career Bridge Foundation team.

## Repository

Career Bridge Portfolio Simulations — AI-evaluated workplace simulations producing verified credentials for candidates aged 16-25. Public repo.

Stack: Next.js 16 (Turbopack/webpack), TypeScript, Tailwind, Supabase (auth/DB/storage), Stripe, Claude API (`claude-3-5-sonnet-20241022`), Certifier (credential issuance), Vercel (Hobby tier, deploys from `landing-page`).

## Commit conventions

- **No `Co-Authored-By: Claude` trailers.** Commits should show only the human author. Do not add any Claude or Anthropic attribution to commit messages.
- Subject line uses conventional prefix: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`
- Summary line is sentence-case, no period at the end
- Body: blank line after subject, then bullet list of changes
- Example:
```
feat: extend simulation bulk import to write prompts and rubrics

- PromptImportSchema added so imported prompts can omit id
- Multi-table writes for simulations + simulation_prompts + rubrics
- Auth check via requireStaff() on POST and PUT
```

## Branching

- Production branch: `landing-page` (deployed by Vercel automatically)
- Feature branches: `feature/<short-description>` (e.g. `feature/bulk-import-prompts-rubric`)
- Fix branches: `fix/<short-description>` for small targeted fixes that aren't features
- Chore branches: `chore/<short-description>` for housekeeping (tooling, configs, .gitignore work)
- Open a Pull Request into `landing-page`. Vercel auto-builds a preview deployment from any pushed branch.
- Squash-and-merge is the preferred merge strategy. Strip any `Co-Authored-By` lines from the squashed commit message before confirming the merge.

## Working on files

- **Always create a `.bak` backup** of any file before non-trivial edits, e.g. `cp app/api/evaluate/route.ts app/api/evaluate/route.ts.bak`. `.bak` files are gitignored.
- Review code changes before testing.
- Test manually rather than via automated scripts (no project test framework configured yet).
- Local-test → commit → push → verify on Vercel deployment. Never push without local verification first.
- When working on a feature branch, verify the Vercel **preview** build goes green before opening a PR.

## Prompt format for Claude Code

- Prompts should be complete, copy-pasteable blocks.
- When a prompt contains code blocks, use a four-backtick outer fence so inner three-backtick blocks render correctly.
- Explicit instructions over implicit assumptions. List the exact files to edit and the exact changes.

## Slack messages

- Slack uses single-asterisk for bold (`*bold*`), not double-asterisk Markdown.
- Daily standup format: what was built, what's next, blockers.
- Same-day unblocking expectation for the dev team.

## Database

- **Production schema is the source of truth.** The git migration files do not always match production (early schema work was done via Supabase Dashboard SQL Editor). Always verify schema via Dashboard before designing migrations.
- When making schema changes, prefer Dashboard SQL for ad-hoc fixes and migration files only when the change is part of a feature being shipped.
- Backup tables (e.g. `<table>_backup_<reason>_<yyyymmdd>`) are acceptable for risky operations; restore by SELECT INTO from the backup.

## Database-touching code

- Multi-table writes are not atomic by default. If you can't easily wrap in a Postgres RPC, do the operations in order of dependency, document the gap with a top-of-file comment, and report per-row failures so retry is meaningful.
- The `simulations` table has no `prompts` or `time_remaining` columns — prompts live in `simulation_prompts`, rubrics live in `rubrics`. Any code referencing them as columns on `simulations` is wrong.

## Brand

- Navy `#003359`, blue `#006FAD`, teal `#4DC5D2`, white `#FFFFFF`, light grey `#F3F3F3`
- Font: Inter (loaded via Google Fonts HTML link tag, not Next.js font system)
- Logos: `logo.png` (icon), `logo-colour.png` (horizontal colour), `logo-white.png` (horizontal white)

## Product vocabulary

- "Evidence" (not "Artefacts") is the candidate-facing label for portfolio outputs
- "Verdict bands" (Distinction / Merit / Pass / Fail) preferred over raw percentages on results pages
- Simulations use **fictional company names** (e.g. Vitara Health, Nexus Bank) so candidates can't research real company data
