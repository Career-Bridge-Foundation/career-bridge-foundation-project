import { sendEmail } from '@/lib/email/send';
import { resolvePartnerSender } from '@/lib/email/sender';
import { renderMentorAddedEmail } from '@/lib/email/templates/mentor-added';

type SendMentorAddedParams = {
  to: string;
  partnerId: string | null;
  consoleUrl: string;
};

export async function sendMentorAddedEmail(params: SendMentorAddedParams) {
  const { to, partnerId, consoleUrl } = params;
  const sender = await resolvePartnerSender(partnerId);
  const senderName = sender.partnerName;

  const html = renderMentorAddedEmail({ consoleUrl, senderName });

  return sendEmail({
    to,
    from: sender.from,
    subject: `You've been added as a mentor for ${senderName}`,
    html,
  });
}
