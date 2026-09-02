function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}

type TermsAcceptedEmailParams = {
  documentLabel: string // e.g. "Evidentize Platform Terms of Service" or "Career Bridge Programme Terms"
  senderName: string
  version: string
  acceptedAt: string // ISO
}

/**
 * Spec 19 decision 6: the candidate receives an emailed copy of what they
 * accepted, with version and timestamp — the record is only useful as
 * evidence if the candidate also has their own copy of the moment. Two
 * documents from two different parties get two separate emails (see
 * lib/email/termsAcceptedNotifications.ts) rather than one email
 * misrepresenting whichever party didn't send it.
 */
export function renderTermsAcceptedEmail({
  documentLabel,
  senderName,
  version,
  acceptedAt,
}: TermsAcceptedEmailParams): string {
  const label = escapeHtml(documentLabel)
  const name = escapeHtml(senderName)
  const when = new Date(acceptedAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">You accepted the ${label}</h1>
    <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.5;">This confirms your acceptance with ${name}.</p>
    <table style="margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Document</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">${label}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Version</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">${escapeHtml(version)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">Accepted</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">${when}</td></tr>
    </table>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Keep this email for your records. You can review what you accepted at any time from your account.</p>
  </div>`.trim()
}
