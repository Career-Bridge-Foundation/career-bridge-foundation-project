type Props = {
  partnerName: string | null
  communityUrl: string
}

/**
 * "A persistent link to the community somewhere in the candidate interface,
 * since a link in a single email is easily lost." No status machine here —
 * a partner's community_url is just a link they've chosen to share, not
 * something the platform provisions or tracks; the caller doesn't even
 * mount this component when no entitling partner has one set.
 */
export function CommunityStatusCard({ partnerName, communityUrl }: Props) {
  return (
    <div className="rounded-lg border border-teal/30 bg-teal/5 p-4">
      <p className="text-sm font-semibold text-navy">Your community</p>
      <p className="mt-1 text-sm text-slate-600">
        {partnerName ? `${partnerName}'s` : 'Your'} community is where induction, support and peer contact happen.
      </p>
      <a
        href={communityUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-semibold text-teal hover:underline"
      >
        Go to the community ↗
      </a>
    </div>
  )
}
