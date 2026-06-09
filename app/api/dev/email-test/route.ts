import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/send';
import { resolvePartnerSender } from '@/lib/email/sender';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 403 });
  }

  const to = req.nextUrl.searchParams.get('to');
  if (!to) return NextResponse.json({ error: 'missing ?to=' }, { status: 400 });

  const partnerId = req.nextUrl.searchParams.get('partnerId'); // optional
  const sender = await resolvePartnerSender(partnerId);

  const result = await sendEmail({
    to,
    from: sender.from,
    subject: 'Evidentize email plumbing test',
    html: `<p>Resend is wired. From-domain: <strong>${sender.domain}</strong> (fallback: ${sender.isFallback}).</p>`,
  });

  return NextResponse.json({ sender, result });
}
