type SendEmailParams = {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
};

type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const apiKey = (process.env.RESEND_API_KEY ?? '').trim().replace(/^RESEND_API_KEY=/i, '').split(/\s/)[0];
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' };

  const { to, from, subject, html } = params;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        body && typeof body.message === 'string' ? body.message : `Resend responded ${res.status}`;
      return { ok: false, error: message };
    }
    if (!body?.id) return { ok: false, error: 'Resend returned no message id' };

    return { ok: true, id: body.id };
  } catch (err) {
    console.error('[SEND] fetch threw', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
