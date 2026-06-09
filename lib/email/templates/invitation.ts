type InvitationEmailParams = { inviteUrl: string; senderName: string; expiresInDays?: number };

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function renderInvitationEmail({
  inviteUrl,
  senderName,
  expiresInDays,
}: InvitationEmailParams): string {
  const name = escapeHtml(senderName);
  const expiry = expiresInDays
    ? `<p style="margin:0;color:#6b7280;font-size:13px;">This invitation expires in ${expiresInDays} days.</p>`
    : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">You've been invited to ${name}</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">Click below to set up your account and get started.</p>
    <a href="${inviteUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">Accept invitation</a>
    <p style="margin:24px 0 16px;color:#6b7280;font-size:13px;line-height:1.5;">Or paste this link into your browser:<br><a href="${inviteUrl}" style="color:#2563eb;word-break:break-all;">${inviteUrl}</a></p>
    ${expiry}
  </div>`.trim();
}
