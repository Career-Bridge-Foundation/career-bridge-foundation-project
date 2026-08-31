type Props = {
  status: 'pending' | 'provisioned' | 'failed'
  partnerName: string | null
  communityUrl: string | null
}

/**
 * Spec 19.3: "The platform should also surface a persistent link to the
 * community somewhere in the candidate interface, since a link in a single
 * email is easily lost." Renders nothing at all for provisioning_status ===
 * 'not_required' (the caller doesn't even mount this component in that
 * case) — a partner without community configured should produce no visible
 * trace of the feature, not an empty/disabled state.
 */
export function CommunityStatusCard({ status, partnerName, communityUrl }: Props) {
  if (status === 'provisioned' && communityUrl) {
    return (
      <div className="rounded-lg border border-teal/30 bg-teal/5 p-4">
        <p className="text-sm font-semibold text-navy">You're in the community</p>
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

  if (status === 'pending') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-navy">Community access is being set up</p>
        <p className="mt-1 text-sm text-slate-600">
          You'll get an email with a link as soon as it's ready — usually within a few minutes.
        </p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-navy">Community access needs a hand</p>
        <p className="mt-1 text-sm text-slate-600">
          Something went wrong setting up your community access.{partnerName ? ` ${partnerName} has` : ' We\'ve'} been
          notified and will sort it out — no action needed from you.
        </p>
      </div>
    )
  }

  return null
}
