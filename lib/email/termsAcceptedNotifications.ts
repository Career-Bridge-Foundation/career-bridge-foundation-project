import { sendEmail } from '@/lib/email/send'
import { resolvePartnerSender } from '@/lib/email/sender'
import { renderTermsAcceptedEmail } from '@/lib/email/templates/terms-accepted'

type SendTermsAcceptedParams = {
  to: string
  documentType: 'platform_terms' | 'partner_programme_terms'
  partnerId: string | null
  version: string
  acceptedAt: string
}

/**
 * One call per accepted document — platform terms always send from the
 * neutral Evidentize sender (they're Evidentize's document regardless of
 * which partner provisioned the candidate); programme terms send from that
 * partner's own sender via resolvePartnerSender(). Two separate emails, per
 * Spec 19's own stated default (open question 4) — a single email from one
 * sender would misrepresent whichever party didn't send it.
 */
export async function sendTermsAcceptedEmail(params: SendTermsAcceptedParams) {
  const { to, documentType, partnerId, version, acceptedAt } = params

  const sender = await resolvePartnerSender(documentType === 'platform_terms' ? null : partnerId)
  const documentLabel =
    documentType === 'platform_terms'
      ? 'Evidentize Platform Terms of Service'
      : `${sender.partnerName} Programme Terms`

  const html = renderTermsAcceptedEmail({ documentLabel, senderName: sender.partnerName, version, acceptedAt })
  const subject = `Your acceptance of the ${documentLabel}`

  return sendEmail({ to, from: sender.from, subject, html })
}
