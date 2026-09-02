function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}

/**
 * Spec 19 notifications table: "New document version published → Candidates
 * holding an older version → Advance notice that acceptance will be
 * requested." Sent once per affected candidate when an admin publishes a
 * new active version superseding one they already accepted — the gate
 * itself only re-prompts at their next request (Spec 19 decision 5), this
 * is just the heads-up.
 */
export function renderTermsVersionPublishedEmail({
  documentLabel,
  senderName,
}: {
  documentLabel: string
  senderName: string
}): string {
  const label = escapeHtml(documentLabel)
  const name = escapeHtml(senderName)

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">A new version of the ${label} is available</h1>
    <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.5;">
      ${name} has published an updated version. You'll be asked to review and accept it the next time you sign in — nothing changes for you until then, and your current session isn't affected.
    </p>
  </div>`.trim()
}
