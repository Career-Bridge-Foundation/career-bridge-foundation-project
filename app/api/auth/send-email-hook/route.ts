import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { resolvePartnerSender } from '@/lib/email/sender';
import { sendEmail } from '@/lib/email/send';
import { renderAuthHookEmail, authEmailSubject } from '@/lib/email/templates/auth-hook';

export const runtime = 'nodejs';

// Requests older than this are rejected even with a valid signature — caps
// the window a captured/replayed payload could be reused in.
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Supabase Auth "Send Email" hook — replaces Supabase's own (single,
 * unbranded, project-wide) auth emails with our own partner-branded send for
 * every auth email type: signup confirmation, password recovery, magic
 * link, email change, reauthentication. See lib/email/templates/auth-hook.ts
 * for the rendering, docs/WHITE_LABELING.md for the full design.
 *
 * Authenticated purely by Standard Webhooks HMAC signature (server-to-server
 * call from Supabase, no user session) — verify BEFORE parsing the body.
 * On any failure here Supabase does not fall back to its own email; the auth
 * action still completes but the user gets no email, so this endpoint must
 * be deployed and smoke-tested BEFORE the hook is switched on in the
 * Supabase Dashboard (Authentication -> Hooks -> Send Email hook).
 */
function verifySignature(payload: string, id: string, timestamp: string, signatureHeader: string, secret: string): boolean {
  const secretBytes = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // webhook-signature can carry multiple space-separated "v1,<base64sig>" values.
  const candidates = signatureHeader
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter((v): v is string => Boolean(v));

  return candidates.some((candidate) => {
    try {
      const a = Buffer.from(candidate, 'base64');
      const b = Buffer.from(expected, 'base64');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

function hookError(httpCode: number, message: string) {
  // Shape Supabase's Auth Hooks expect on failure.
  return NextResponse.json({ error: { http_code: httpCode, message } }, { status: httpCode });
}

type HookPayload = {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
    email_action_type: string;
  };
};

async function resolvePartnerIdForUser(userId: string, metadata: Record<string, unknown>): Promise<string | null> {
  const fromMetadata = typeof metadata.partner_id === 'string' ? metadata.partner_id : null;
  if (fromMetadata) return fromMetadata;

  // Metadata only carries partner_id for accounts created through the
  // branded signup form. Partner/mentor staff accounts (admin.createUser())
  // never get that metadata, so fall back to their role row.
  const { data } = await supabaseServer
    .from('user_roles')
    .select('partner_id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.partner_id as string | null) ?? null;
}

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error('[send-email-hook] SUPABASE_AUTH_HOOK_SECRET is not set');
    return hookError(500, 'hook not configured');
  }

  const payload = await request.text();
  const id = request.headers.get('webhook-id');
  const timestamp = request.headers.get('webhook-timestamp');
  const signature = request.headers.get('webhook-signature');

  if (!id || !timestamp || !signature) {
    return hookError(401, 'missing webhook signature headers');
  }

  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    return hookError(401, 'stale webhook timestamp');
  }

  if (!verifySignature(payload, id, timestamp, signature, secret)) {
    return hookError(401, 'invalid webhook signature');
  }

  let body: HookPayload;
  try {
    body = JSON.parse(payload);
  } catch {
    return hookError(400, 'invalid JSON body');
  }

  const user = body?.user;
  const emailData = body?.email_data;
  if (!user?.email || !emailData?.email_action_type) {
    return hookError(400, 'malformed hook payload');
  }

  try {
    const metadata = user.user_metadata ?? {};
    const partnerId = await resolvePartnerIdForUser(user.id, metadata);
    const sender = await resolvePartnerSender(partnerId);

    const actionType = emailData.email_action_type;
    const siteUrl = emailData.redirect_to || emailData.site_url || '';
    const confirmationUrl = emailData.token_hash
      ? `${siteUrl}/auth/callback?token_hash=${emailData.token_hash}&type=${actionType}`
      : null;

    const html = renderAuthHookEmail({
      actionType,
      confirmationUrl,
      otpCode: emailData.token ?? null,
      senderName: sender.partnerName,
      logoUrl: sender.logoUrl,
      accentColor: sender.accentColor,
    });

    const result = await sendEmail({
      to: user.email,
      from: sender.from,
      subject: authEmailSubject(actionType, sender.partnerName),
      html,
      ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
    });

    if (!result.ok) {
      console.error('[send-email-hook] send failed', actionType, result.error);
      return hookError(500, 'email send failed');
    }

    return NextResponse.json({});
  } catch (err) {
    console.error('[send-email-hook] unexpected error', err);
    return hookError(500, 'internal error');
  }
}
