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

  const html = renderInvitationEmail({ inviteUrl, senderName: displayName, expiresInDays, roleLabel });
  const subject = roleLabel
    ? `You're invited to ${displayName} as a ${roleLabel}`
    : `You're invited to ${displayName}`;

  return sendEmail({ to, from: sender.from, subject, html });
}
