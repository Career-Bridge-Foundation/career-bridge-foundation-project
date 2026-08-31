// Explicitly supported community providers (Spec 19.3). Circle is the only
// one with an actual planned integration — the admin-credential + cohort
// space-id shape on the partners table is modeled specifically on Circle's
// Admin API v2 and doesn't generalize as-is (Discourse needs an API key AND
// a separate API username; Discord has no real "space" concept and uses bot
// tokens; Slack differs again). A free-text provider field implied any of
// these already worked, which wasn't true. Add an entry here — and adapt the
// stored fields/integration code to match that provider's actual shape —
// only once a second provider is genuinely being built, not before.
export const SUPPORTED_COMMUNITY_PROVIDERS = [
  { value: 'circle', label: 'Circle' },
] as const

export type CommunityProvider = (typeof SUPPORTED_COMMUNITY_PROVIDERS)[number]['value']

export function isSupportedCommunityProvider(value: string): value is CommunityProvider {
  return SUPPORTED_COMMUNITY_PROVIDERS.some((p) => p.value === value)
}
