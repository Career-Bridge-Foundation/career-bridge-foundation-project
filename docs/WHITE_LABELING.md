# White-labeling (Spec 05.4)

How a partner organisation gets its own branded, subdomained instance of the
platform. Presentation only — branding never gates access; authorization is
always session-based (`requirePartner()` / `requireMentor()`), independent of
which host a request arrives on.

## Resolution flow

1. **`middleware.ts`** reads the request `Host` header and calls
   `subdomainFromHost()` (`lib/partners/branding.ts`). Any client-supplied
   `x-partner-*` headers are stripped first (anti-spoof) before fresh ones
   are set.
2. If the host is `{subdomain}.{ROOT_DOMAIN}` and `{subdomain}` isn't a
   reserved label (`app`, `www`, `api`, `admin`, ...), `resolvePartnerBranding()`
   fetches that partner's branding from the anon-readable `partner_public_branding`
   view (no service-role key at the edge) and sets `x-partner-id`,
   `x-partner-name`, `x-partner-logo-*`, `x-partner-primary`, `x-partner-secondary`
   headers. Any failure (DB down, unknown subdomain, apex domain) leaves no
   headers set — the request falls through to neutral branding. This path
   never throws and never redirects.
3. **`app/(branded)/layout.tsx`** (public/candidate routes) and
   **`app/partner/layout.tsx`** / **`app/mentor/layout.tsx`** (consoles) read
   those headers (or, for the consoles, the authenticated partner's row
   directly — see note below) and:
   - override `--color-navy` / `--color-teal` CSS custom properties inline,
     so every `bg-navy` / `text-teal` Tailwind utility re-themes with zero
     per-component changes
   - provide the resolved branding via `BrandingProvider` / `useBranding()`
     for logo swapping (`Header`, `Footer`, auth pages, simulation runner, etc.)
   - (public routes only) override page `<title>` / Open Graph text via
     `generateMetadata`
4. **`app/icon.tsx`** independently reads `x-partner-logo-icon` to serve a
   per-subdomain browser tab icon, re-fetching and re-encoding the partner's
   uploaded icon as a data URI (fails closed to the default Evidentize icon).

**Console note:** `app/partner/layout.tsx` and `app/mentor/layout.tsx`
resolve branding by the *authenticated* `partnerId` (a DB read), not the
`x-partner-*` headers — a partner admin logging in via the shared app domain
still sees their own saved branding, not just visitors on their subdomain.

## `partners` table — who sets what

| Field(s) | Set by |
|---|---|
| `name`, `slug`, `contact_email`, `status` | Admin, at partner creation (`POST /api/admin/partner-invites`) |
| `subdomain` | Admin only (`app/admin/partners/_subdomain-editor.tsx` → `PATCH /api/admin/partners/[partnerId]`) — deliberately not self-service, a bad/offensive/reserved value is hard to walk back once shared |
| `primary_color`, `secondary_color` | Partner self-service (`/partner/branding`) |
| `logo_url_icon`, `logo_url_on_light`, `logo_url_on_dark` | Partner self-service (`/partner/branding`, upload via `/api/partner/branding/logo`) |
| `email_sender_name`, `email_sender_domain` | Admin only (`app/admin/partners/_sender-editor.tsx` → same `PATCH` endpoint) — the domain must still be verified by hand in Resend (SPF/DKIM/DMARC) before it actually delivers; this UI only stores the value |
| `custom_domain` | Nowhere yet — see "Out of scope" |

## Adding a new partner (runbook)

1. `POST /api/admin/partner-invites` with `{ orgName, adminEmail }` — creates
   the `partners` row (`status: approved`) and emails the first admin an
   invite link.
2. In **Admin → Partners**, assign a `subdomain`. It resolves immediately —
   wildcard DNS (`*.{ROOT_DOMAIN}`) is already live in Vercel.
3. The partner signs in and visits **Partner Console → Branding** to set
   their colors and upload their three logo slots.
4. (Optional) If the partner needs email to send from their own domain,
   an admin sets `email_sender_name` / `email_sender_domain` in the same
   Partners table, then verifies that domain's SPF/DKIM records in the
   Resend dashboard by hand. Until verified, sends silently fall back to the
   neutral `Evidentize <noreply@email.evidentize.io>` sender.

## Email branding

Two separate systems, both now partner-aware:

1. **Application-sent transactional email** (partner/mentor invites) — `lib/email/invitations.ts` / `lib/email/mentor-notifications.ts` call `resolvePartnerSender()` (`lib/email/sender.ts`), which resolves the partner's `email_sender_name`/`email_sender_domain` (falling back to the neutral Evidentize sender), plus `logo_url_on_light`, `primary_color`, and `contact_email` (used as reply-to). Links point at the partner's subdomain when one is assigned.
2. **Supabase's native auth emails** (signup confirmation, password recovery, magic link, email change, reauthentication) — these are normally one unbranded, project-wide template with no per-recipient context available. Replaced via a Supabase **Send Email Hook**: `app/api/auth/send-email-hook/route.ts` receives the event instead of Supabase sending its own email, resolves the same partner branding, and renders it through `lib/email/templates/auth-hook.ts`.
   - **Partner resolution for a hook-fired email**: first checks `user.user_metadata.partner_id`, which `app/(branded)/auth/signup/page.tsx` sets from `useBranding()?.id` at signup time (so a candidate who signs up on a partner's subdomain gets that partner's branding on every future auth email too, since metadata persists on the `auth.users` row) — falling back to `user_roles.partner_id` for partner/mentor staff accounts (created via `admin.createUser()`, which never carries signup metadata).
   - **Security**: the endpoint is authenticated purely by Standard Webhooks HMAC signature (`webhook-id`/`webhook-timestamp`/`webhook-signature` headers, verified against `SUPABASE_AUTH_HOOK_SECRET` before the body is even parsed) — there's no user session on this call, Supabase calls it server-to-server.
   - **Rollout is manual and must be staged carefully**: deploy the endpoint first, generate the signing secret in Authentication → Hooks → Send Email hook, set `SUPABASE_AUTH_HOOK_SECRET` in Vercel, uncomment/enable the mirrored `[auth.hook.send_email]` block in `supabase/config.toml`, THEN flip the Dashboard toggle on. If the hook ever errors, Supabase does not fall back to its own template — the auth action still completes but the email silently isn't sent — so do one real test signup immediately after enabling.
   - `app/(branded)/auth/callback/route.ts` already handles verifying whichever link type the hook generates (`signup`/`recovery`/`magiclink`/`email_change`) via `verifyOtp({ token_hash, type })`.

## Out of scope (deliberately deferred, not attempted)

- **Custom/BYO domains.** `partners.custom_domain` has real values seeded
  for two partners but no verification (TXT/CNAME) or Vercel Domains API
  integration exists — `subdomainFromHost()` only ever resolves
  `*.{ROOT_DOMAIN}`, never a custom domain.
- **Certifier-issued credential emails.** Sent by the external Certifier.io
  API under one global API key/group; not this codebase's templates.
- **Tenant-scoped data routing.** The subdomain only ever drives
  presentation (colors, logo, icon, page title). `/partner` and `/mentor`
  console access and data scoping are — correctly — entirely session-based
  via `requirePartner()` / `requireMentor()`, independent of host.
