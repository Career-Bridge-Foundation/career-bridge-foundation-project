import { sendEmail } from '@/lib/email/send';
import { resolvePartnerSender } from '@/lib/email/sender';
import { renderInvitationEmail } from '@/lib/email/templates/invitation';

type SendInvitationParams = {
  to: string;
  inviteUrl: string;
  partnerId: string | null;
  partnerName?: string;
  expiresInDays?: number;
  roleLabel?: string;
};

export async function sendInvitationEmail(params: SendInvitationParams) {
  const { to, inviteUrl, partnerId, partnerName, expiresInDays, roleLabel } = params;
  const sender = await resolvePartnerSender(partnerId);
  const displayName = partnerName?.trim() || sender.partnerName || 'Evidentize';

  const html = renderInvitationEmail({
    inviteUrl,
    senderName: displayName,
    expiresInDays,
    roleLabel,
    logoUrl: sender.logoUrl,
    accentColor: sender.accentColor,
  });
  const subject = roleLabel
    ? `You're invited to ${displayName} as a ${roleLabel}`
    : `You're invited to ${displayName}`;

  const result = await sendEmail({
    to,
    from: sender.from,
    subject,
    html,
    ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
  });

  // sendEmail() never rejects on a Resend-side failure (bad/unverified
  // domain, invalid key, etc.) — it resolves with { ok: false, error }. Every
  // call site of this function wraps it in try/catch or .catch() expecting
  // exactly that to signal failure, so a resolved-but-failed result was
  // silently dropped everywhere: no log, no visible error, just a missing
  // email. Throwing here is what makes those existing catch blocks work.
  if (!result.ok) {
    throw new Error(`sendInvitationEmail: ${result.error}`);
  }

  return result;
}
