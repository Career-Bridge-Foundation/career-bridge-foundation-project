// The canonical (non-partner-subdomain) app host. Public portfolio links
// embedded in permanent candidate-owned text (CV/LinkedIn) must always use
// this host, never a partner subdomain — partner-neutral output per Spec 17
// decision 8. Same fallback constant already inlined at:
//   - middleware.ts (redirects partner-subdomain /portfolio/* traffic here)
//   - app/portfolio/[slug]/ShareButton.tsx (client-side share links)
// This is the third use, hence pulled into a shared helper.
export function getCanonicalPortfolioUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://app.evidentize.io';
  return `${base}/portfolio/${slug}`;
}
