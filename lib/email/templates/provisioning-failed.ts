function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}

/**
 * Spec 19: "Provisioning terminally failed → Partner-admin → Names the
 * candidate; manual action required." Also: "A cluster of terminal failures
 * in a short window most likely means the community subscription has
 * lapsed or the token has been rotated, not a code fault... the alert
 * should say so rather than reporting a generic integration error." This
 * copy says so plainly rather than leaving the partner to guess.
 */
export function renderProvisioningFailedEmail({
  candidateName,
}: {
  candidateName: string
}): string {
  const name = escapeHtml(candidateName)

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Community provisioning needs your attention</h1>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">
      We couldn't automatically add <strong>${name}</strong> to your community. Their acceptance and platform
      access are unaffected — this only concerns their community access.
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">
      If this is happening for several candidates around the same time, the most likely cause is your community
      subscription lapsing or your API token being rotated — not a platform fault. Worth checking that first.
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
      You can add them manually in your community and mark it done from your partner console — that's a
      permanent option, not a temporary workaround.
    </p>
  </div>`.trim()
}
