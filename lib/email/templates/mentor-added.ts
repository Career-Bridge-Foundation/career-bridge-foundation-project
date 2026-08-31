type MentorAddedEmailParams = {
  consoleUrl: string;
  senderName: string;
  logoUrl?: string | null;
  accentColor?: string | null;
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function renderMentorAddedEmail({
  consoleUrl,
  senderName,
  logoUrl,
  accentColor,
}: MentorAddedEmailParams): string {
  const name = escapeHtml(senderName);
  const button = accentColor || '#111827';
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${name}" style="max-height:32px;max-width:200px;margin:0 0 20px;display:block;">`
    : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    ${logo}
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">You've been added as a mentor for ${name}</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">${name} has added you as a mentor. Open your mentor console to see the candidates and disciplines assigned to you.</p>
    <a href="${consoleUrl}" style="display:inline-block;background:${button};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">Go to your mentor console</a>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Or paste this link into your browser:<br><a href="${consoleUrl}" style="color:#2563eb;word-break:break-all;">${consoleUrl}</a></p>
  </div>`.trim();
}
