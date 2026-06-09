import { sendEmail } from '@/lib/email/send';
import { resolvePartnerSender } from '@/lib/email/sender';
import { renderInvitationEmail } from '@/lib/email/templates/invitation';

type SendInvitationParams = {
  to: string;
  inviteUrl: string;
  partnerId: string | null;
  partnerName?: string;
  expiresInDays?: number;
};

export async function sendInvitationEmail(params: SendInvitationParams) {
  const { to, inviteUrl, partnerId, partnerName, expiresInDays } = params;
  const sender = await resolvePartnerSender(partnerId);
  const displayName = partnerName?.trim() || sender.partnerName || 'Evidentize';

  const html = renderInvitationEmail({ inviteUrl, senderName: displayName, expiresInDays });

  return sendEmail({ to, from: sender.from, subject: `You're invited to ${displayName}`, html });
}
