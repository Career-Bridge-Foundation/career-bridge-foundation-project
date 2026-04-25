# Career Bridge Portfolios — Phase 1 Spec (MVP Sprint)

**Version 1.0 — 25 April 2026**
**Status: Locked. Ready for implementation.**

---

## 1. Purpose

Every Career Bridge candidate gets a public, shareable portfolio page on the internet — automatically, the moment they complete their first simulation.

The portfolio is the candidate's **professional home page**. One URL they share everywhere — CV, LinkedIn, email signature, recruiter messages. It is theirs to own, edit, and share. Career Bridge is the infrastructure underneath, not the protagonist on the page.

A portfolio contains:

- Who they are — name, headline, bio, location
- What they've proven — verified simulations with AI evaluation, verdict bands, and Certifier credentials
- What they've made — uploaded evidence per simulation (images, PDFs, documents, external links)
- Where else to find them — curated external links to LinkedIn, GitHub, personal site, blog, etc.

The model is "link in bio" — frictionless, candidate-authored, infinitely shareable.

---

## 2. Phase 1 Scope

This document defines what ships in the MVP sprint. Everything outside this list is post-MVP and lives in the original portfolio spec.

**In scope (Phase 1):**

1. Database migration — four tables + storage bucket + RLS policies
2. Auto-create portfolio profile on first simulation completion
3. Public portfolio page at `/portfolio/[slug]`
4. Evidence upload component (images, PDFs, documents, external links)
5. Portfolio dashboard for candidates to manage headline, bio, links, evidence, visibility
6. OG image generation for social share previews

**Out of scope (post-MVP):**

- Cohort pages
- Coach branding and custom domains
- Vercel API automation for domain provisioning
- Private portfolios with access tokens (column exists in DB but feature unbuilt)
- Employer search / browse interface

---

## 3. Data Model

### 3.1 New tables

#### `portfolio_profiles`

The candidate's portfolio identity. One row per user. Auto-created on first simulation completion.

```sql
CREATE TABLE public.portfolio_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT,
  bio TEXT CHECK (char_length(bio) <= 500),
  location TEXT,
  linkedin_url TEXT,
  external_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  private_access_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public portfolios are viewable by anyone"
  ON public.portfolio_profiles
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can manage own portfolio"
  ON public.portfolio_profiles
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_portfolio_profiles_slug ON public.portfolio_profiles(slug);
CREATE INDEX idx_portfolio_profiles_user ON public.portfolio_profiles(user_id);
```

**Field notes:**

- `slug` — URL-safe identifier. Generated from candidate name; collision-resolved with 4-character random suffix (see Section 4).
- `headline` — Short positioning line under name. Empty by default. Candidate-authored.
- `bio` — Longer about-me. Hard cap at 500 characters at the database level.
- `linkedin_url` — Kept as a first-class column (not in `external_links`) because LinkedIn gets a dedicated icon in the page header.
- `external_links` — JSONB array of `{label, url}` objects. Capped at 6 items in the UI; database has no hard cap. Example: `[{"label": "GitHub", "url": "https://github.com/janedoe"}, {"label": "Substack", "url": "https://janedoe.substack.com"}]`.
- `is_public` — When `false`, the portfolio is only accessible via `private_access_token`. MVP creates portfolios as `true` by default.
- `private_access_token` — Reserved for post-MVP private portfolio feature. Column exists; feature unbuilt.

#### `portfolio_evidence`

Files and links attached by the candidate to specific simulations.

```sql
CREATE TABLE public.portfolio_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id TEXT NOT NULL,
  session_id UUID REFERENCES public.simulation_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('image', 'pdf', 'document', 'link')),
  file_url TEXT,
  external_url TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_evidence ENABLE ROW LEVEL SECURITY;

-- Public SELECT requires both the evidence to be visible AND the parent
-- portfolio to be public. This prevents evidence leaking when a candidate
-- has set their portfolio to private.
CREATE POLICY "Public evidence on public portfolios is viewable"
  ON public.portfolio_evidence
  FOR SELECT
  USING (
    is_visible = true
    AND user_id IN (
      SELECT user_id FROM public.portfolio_profiles WHERE is_public = true
    )
  );

CREATE POLICY "Users can manage own evidence"
  ON public.portfolio_evidence
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_portfolio_evidence_user ON public.portfolio_evidence(user_id);
CREATE INDEX idx_portfolio_evidence_simulation ON public.portfolio_evidence(simulation_id);
```

**Field notes:**

- Either `file_url` (for uploaded files) or `external_url` (for link-type evidence) is populated, never both.
- `evidence_type = 'link'` corresponds to `external_url` populated and `file_url` null. All other types use `file_url`.
- `sort_order` lets candidates manually reorder evidence within a simulation.
- Public SELECT policy joins to `portfolio_profiles` to prevent the privacy leak where evidence is publicly readable even if the parent portfolio is private.

#### `portfolio_simulation_visibility`

Per-simulation visibility toggles. Lets candidates hide individual simulation results from their portfolio without losing the data.

```sql
CREATE TABLE public.portfolio_simulation_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id TEXT NOT NULL,
  show_on_portfolio BOOLEAN NOT NULL DEFAULT true,
  show_scores BOOLEAN NOT NULL DEFAULT true,
  show_feedback BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, simulation_id)
);

ALTER TABLE public.portfolio_simulation_visibility ENABLE ROW LEVEL SECURITY;

-- Public SELECT requires the parent portfolio to be public.
CREATE POLICY "Public visibility settings on public portfolios are readable"
  ON public.portfolio_simulation_visibility
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM public.portfolio_profiles WHERE is_public = true
    )
  );

CREATE POLICY "Users can manage own visibility"
  ON public.portfolio_simulation_visibility
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_portfolio_simulation_visibility_user ON public.portfolio_simulation_visibility(user_id);
```

**Field notes:**

- Default behaviour for a candidate who hasn't touched these settings: simulation IS shown, scores ARE shown, feedback is NOT shown. This means rows only need to be created when the candidate changes a default.
- A simulation that has no row in this table is treated as `(true, true, false)` — visible, scores shown, feedback hidden — at the application layer.

### 3.2 Storage bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-evidence', 'portfolio-evidence', true);

CREATE POLICY "Users can upload own evidence"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own evidence"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own evidence"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can view evidence"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'portfolio-evidence');
```

**File path structure:** `portfolio-evidence/{user_id}/{filename}`

**Privacy posture (documented):** The bucket is public. Anyone with a file URL can view that file forever. Setting `is_visible = false` on `portfolio_evidence` removes the file from the portfolio page but does NOT revoke its URL. This is acceptable for MVP — file URLs are treated like LinkedIn images: shareable, not secret. Signed URLs are a post-MVP option if revocation becomes important.

---

## 4. Slug Generation

Slugs are URL-safe identifiers like `jane-doe` or `jane-doe-7k2p`. Generated from the candidate's display name on first simulation completion. Stable for the lifetime of the portfolio.

### Algorithm

1. Take the candidate's full name from `auth.users.user_metadata.full_name` (fallback to `email` local part if unavailable).
2. Slugify:
   - Lowercase
   - Transliterate accented characters (`José` → `jose`)
   - Strip apostrophes, quotes, and other punctuation (`O'Connor` → `oconnor`)
   - Replace whitespace and underscores with hyphens
   - Strip any non-alphanumeric, non-hyphen characters
   - Collapse consecutive hyphens
   - Trim leading/trailing hyphens
   - Truncate to 45 characters (leaves room for collision suffix)
3. Attempt insert into `portfolio_profiles` with this slug.
4. On unique constraint violation, append `-` + 4 random lowercase alphanumeric characters (`-7k2p`) and retry.
5. Retry up to 3 times. If still failing, log error and use a slug derived from the user's UUID (`u-` + first 8 chars of UUID).

### Stability

Slugs do NOT update if the candidate changes their name. Once issued, the slug is permanent unless the candidate explicitly customises it (post-MVP feature). This prevents broken share links.

### Customisation (post-MVP)

The schema supports candidate-customisable slugs via standard UPDATE. A "claim your custom URL" feature is post-MVP and not built in this sprint.

---

## 5. Auto-Creation Logic

### When

Immediately after a simulation evaluation completes successfully, before returning the result to the candidate.

### Where

In the evaluation API route (`app/api/evaluate/route.ts` or wherever evaluation completion is handled). NOT a database trigger, NOT a Stripe webhook.

### How

```typescript
// Pseudocode — actual implementation in route.ts after evaluation success

async function ensurePortfolioProfile(userId: string): Promise<void> {
  // Check if profile already exists
  const { data: existing } = await supabase
    .from('portfolio_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  // Get candidate's display name
  const { data: user } = await supabase.auth.admin.getUserById(userId);
  const fullName = user?.user_metadata?.full_name
    ?? user?.email?.split('@')[0]
    ?? 'candidate';

  // Generate slug with collision retry
  const slug = await generateUniqueSlug(fullName);

  // Insert profile
  await supabase
    .from('portfolio_profiles')
    .insert({
      user_id: userId,
      slug,
      // headline, bio, location, linkedin_url all default to null
      // external_links defaults to []
      // is_public defaults to true
    });
}
```

### Failure handling

The portfolio creation is wrapped in `try/catch`. A failure here MUST NOT block the candidate from receiving their evaluation result. On failure:

- Log the error with full context (`user_id`, simulation ID, timestamp, error message)
- Continue returning the evaluation result to the client
- A nightly backfill job (post-MVP) reconciles any users with completed simulations but no portfolio profile

---

## 6. Public Portfolio Page

### Route

`/portfolio/[slug]`

### Rendering

Server-side rendered (Next.js App Router server component). Cache strategy: revalidate on candidate edit (using `revalidatePath` after dashboard mutations).

### Data fetched

In a single render pass:

1. `portfolio_profiles` row by slug (with `is_public = true` filter — handled by RLS)
2. Candidate display name from `profiles` table or `auth.users.user_metadata`, joined via `user_id`
3. All `evaluation_results` for this user
4. All `credential_issuances` for this user
5. All `portfolio_evidence` for this user (with `is_visible = true` filter — handled by RLS)
6. All `portfolio_simulation_visibility` rows for this user

If `portfolio_profiles` row not found OR `is_public = false`: return Next.js 404.

### Page structure

```
┌────────────────────────────────────────────────┐
│  HEADER                                        │
│    [Candidate Name]              [LinkedIn 🔗]│
│    [Headline if set]                           │
│    📍 [Location if set]                        │
│                                                │
│    [Bio if set]                                │
│                                                │
│    🔗 [External Link 1]  🔗 [External Link 2] │
│    🔗 [External Link 3]  ... up to 6           │
├────────────────────────────────────────────────┤
│  STATS BAR                                     │
│    Simulations: X · Credentials: X · Disciplines: X
├────────────────────────────────────────────────┤
│  SIMULATION CARDS                              │
│    [Card per visible simulation]               │
│      Title, Discipline, Verdict Band, Date     │
│      [View Credential] button                  │
│      Expandable: scores, feedback (if shown)   │
│      Evidence section: thumbnails + links      │
├────────────────────────────────────────────────┤
│  FOOTER                                        │
│    Powered by Career Bridge Foundation         │
└────────────────────────────────────────────────┘
```

### Verdict band rule for cards

If a candidate has multiple completions of the same simulation, the card displays the **highest verdict band ever achieved**, with the date of the achieving completion. Computed at render time from `evaluation_results`. No caching required for MVP volumes.

### Verdict band ordering (for "highest" comparison)

`Distinction > Merit > Pass > Borderline > Did Not Pass`

### Empty states

- No completed simulations: page shouldn't exist (portfolio is auto-created only on first completion). Defensive: show "This candidate hasn't published any work yet."
- No headline: name is the only text in that area.
- No bio: section is omitted entirely.
- No external links: row is omitted entirely.

---

## 7. Evidence Upload Component

### Where

Two surfaces:

1. On the simulation results page (`app/simulate/[id]/results/page.tsx`), below the credential card. Section titled "Add evidence to your portfolio."
2. On the portfolio dashboard (`app/dashboard/portfolio`), per-simulation editing.

### Supported types

| Type | File extensions / Format | Max size |
|---|---|---|
| Image | PNG, JPG, JPEG, WebP | 5 MB |
| PDF | PDF | 10 MB |
| Document | DOCX, PPTX | 10 MB |
| Link | URL string (validated) | — |

### Per-item metadata

- **Title** (required, max 100 chars)
- **Description** (optional, max 300 chars)
- **Visibility** (defaults to `true`)
- **Sort order** (auto-assigned, draggable to reorder)

### Upload flow

1. Candidate selects file or pastes URL
2. For files: upload to Supabase Storage at `portfolio-evidence/{user_id}/{uuid}-{original_filename}`
3. Insert row in `portfolio_evidence` with the resulting `file_url` (or `external_url` for links)
4. UI updates optimistically; on failure, show error and revert

---

## 8. Portfolio Dashboard

### Route

`/dashboard/portfolio` (authenticated only)

### Sections

**Header editor**
- Edit headline (text input, no character limit shown but DB caps at... nothing on headline currently — recommend adding 100 char cap at input level for UX)
- Edit bio (textarea, character counter showing X / 500)
- Edit location
- Edit LinkedIn URL (validated as URL)
- Edit external links — list editor with add/remove/reorder. Each item has label + URL. Cap at 6.

**Visibility controls**
- Master toggle: portfolio public / private (private behaviour deferred — UI shows toggle but private mode is post-MVP)
- Per-simulation toggles — list of completed simulations, each with three toggles (show on portfolio / show scores / show feedback)

**Evidence manager**
- Grouped by simulation
- Each evidence item: thumbnail/icon, title, description, visibility toggle, delete button
- Add evidence button per simulation

**Soft nudge banner**
- Shown above the dashboard when headline OR bio is empty
- Copy: "Add a headline so recruiters know what role you're aiming for. Candidates with complete portfolios get more views."
- Dismissable but reappears on next session if still empty

---

## 9. OG Image Generation (Share Previews)

### Why

When a portfolio URL is shared on LinkedIn, Twitter, or Slack, the link preview card determines whether anyone clicks. A generic Career Bridge thumbnail kills sharing. A branded card showing the candidate's name and verdict bands drives engagement.

### How

Next.js OG image generation via `app/portfolio/[slug]/opengraph-image.tsx`. Generated dynamically per slug, cached by Vercel at the edge.

### Image content

```
┌───────────────────────────────────────────────┐
│                                               │
│   [Candidate Name]                            │
│   [Headline if set]                           │
│                                               │
│   Distinction · Merit · Merit · Pass         │
│   (verdict bands as colored chips)            │
│                                               │
│   Career Bridge Verified Portfolio            │
│   careerbridgefoundation.com/portfolio/slug   │
│                                               │
└───────────────────────────────────────────────┘
```

### Specifications

- 1200 × 630 px (LinkedIn / Twitter standard)
- Career Bridge brand colours (Navy #003359, Teal #4DC5D2)
- Inter font
- Verdict chips colour-coded matching the portfolio page

### Meta tags

In the portfolio page metadata:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const profile = await getPortfolioProfile(params.slug);
  return {
    title: `${profile.fullName} — Career Bridge Portfolio`,
    description: profile.headline ?? `${profile.fullName}'s verified Career Bridge portfolio`,
    openGraph: {
      images: [`/portfolio/${params.slug}/opengraph-image`],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`/portfolio/${params.slug}/opengraph-image`],
    },
  };
}
```

---

## 10. Build Sequence

| Step | What | Owner |
|---|---|---|
| 1A | Run database migration in Supabase SQL editor | Dev (migration file from this spec) |
| 1B | Verify with manual inserts: create test portfolio, evidence, visibility rows | Dev |
| 1C | Confirm RLS by querying as anon and as owner | Dev |
| 2 | Implement `generateUniqueSlug` utility with collision retry | Dev |
| 3 | Implement `ensurePortfolioProfile` and call it from evaluation API route | Dev |
| 4 | Build public portfolio page `/portfolio/[slug]` (read-only) | Victor (vibe code) |
| 5 | Build evidence upload component, wire into results page | Dev |
| 6 | Build portfolio dashboard `/dashboard/portfolio` | Victor (vibe code) + Dev (storage) |
| 7 | Build OG image route `/portfolio/[slug]/opengraph-image` | Victor (vibe code) |
| 8 | End-to-end test: complete simulation → portfolio created → evidence uploaded → public page renders → share preview works | Victor + Dev |

Steps 1A–1C must complete before any other step starts. After that, steps 2–7 can run in parallel where capacity allows.

---

## 11. Key Design Decisions (Locked)

1. Portfolio is auto-created on first simulation completion. No setup wizard.
2. Headline and bio default to empty. Soft nudge in dashboard prompts candidate to fill them.
3. "Career Bridge Verified" never appears in candidate-facing default copy. Verification is shown by the credentials and verdict bands, not asserted in candidate's voice.
4. LinkedIn URL kept as a first-class column; everything else is in the `external_links` JSONB array.
5. External links capped at 6 in the UI; database has no hard cap.
6. Slug generated from name; collisions resolved with 4-character random suffix. Slugs are stable for the lifetime of the portfolio.
7. Storage bucket is public. Documented as "shareable not secret." Signed URLs are post-MVP.
8. Evidence RLS join to `portfolio_profiles` to prevent privacy leaks when portfolio is private.
9. Auto-creation lives in the evaluation API route, not a database trigger. Failure does not block the candidate's result.
10. Verdict band on portfolio cards = highest ever achieved per simulation.
11. OG image generation is included in MVP. A portfolio nobody shares is wasted infrastructure.

---

## 12. Out of Scope (Post-MVP)

These are intentionally deferred. Do NOT build them in Phase 1:

- Cohort pages (`/cohort/[slug]`)
- Coach branding fields (logo, programme name) on `coaches` table
- Custom domain detection middleware
- DNS verification UI
- Vercel API integration for automated domain provisioning
- Private portfolio access tokens (column reserved, feature unbuilt)
- Coach dashboard view of candidate portfolio completeness
- Slug customisation by candidate
- Employer search / browse interface
- Nightly backfill job for missing portfolio profiles

---

## 13. Glossary

- **Portfolio profile** — the candidate's portfolio identity record. One per user.
- **Evidence** — files or links attached by the candidate to a specific simulation.
- **Verdict band** — the qualitative rating from evaluation: Distinction, Merit, Pass, Borderline, Did Not Pass.
- **Slug** — the URL-safe identifier in the portfolio's public URL.
- **OG image** — Open Graph image used as the link preview thumbnail on social platforms.

---

**End of Phase 1 specification.**
