// Branded replacement for Supabase's native auth emails (signup confirmation,
// password recovery, magic link, email change, reauthentication), rendered
// by app/api/auth/send-email-hook/route.ts. Supabase's own templates
// (supabase/email-templates/*.html) have no per-recipient context to draw on
// — this file is what makes those emails partner-aware instead.

export type AuthEmailActionType =
  | 'signup'
  | 'recovery'
  | 'magiclink'
  | 'email_change'
  | 'invite'
  | 'reauthentication'
  | string; // Supabase may introduce new action types; fall through to a generic template rather than throw.

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

const SUBJECTS: Partial<Record<AuthEmailActionType, (name: string) => string>> = {
  signup: (name) => `Confirm your ${name} account`,
  recovery: (name) => `Reset your ${name} password`,
  magiclink: (name) => `Your ${name} sign-in link`,
  email_change: (name) => `Confirm your new email for ${name}`,
  invite: (name) => `You've been invited to ${name}`,
  reauthentication: (name) => `Your ${name} verification code`,
};

export function authEmailSubject(actionType: AuthEmailActionType, senderName: string): string {
  const build = SUBJECTS[actionType] ?? ((name: string) => `Action required for your ${name} account`);
  return build(senderName);
}

const COPY: Partial<Record<AuthEmailActionType, { heading: (n: string) => string; body: string; cta: string }>> = {
  signup: {
    heading: (n) => `Confirm your ${n} account`,
    body: 'Click below to confirm your email address and finish setting up your account.',
    cta: 'Confirm email',
  },
  recovery: {
    heading: (n) => `Reset your ${n} password`,
    body: "Click below to choose a new password. If you didn't request this, you can safely ignore this email.",
    cta: 'Reset password',
  },
  magiclink: {
    heading: (n) => `Sign in to ${n}`,
    body: 'Click below to sign in. This link can only be used once.',
    cta: 'Sign in',
  },
  email_change: {
    heading: (n) => `Confirm your new email for ${n}`,
    body: 'Click below to confirm this email address change.',
    cta: 'Confirm new email',
  },
  invite: {
    heading: (n) => `You've been invited to ${n}`,
    body: 'Click below to set up your account.',
    cta: 'Accept invitation',
  },
};
const DEFAULT_COPY = {
  heading: (n: string) => `Action required for your ${n} account`,
  body: 'Click below to continue.',
  cta: 'Continue',
};

type AuthHookEmailParams = {
  actionType: AuthEmailActionType;
  confirmationUrl?: string | null;
  otpCode?: string | null;
  senderName: string;
  logoUrl?: string | null;
  accentColor?: string | null;
};

export function renderAuthHookEmail({
  actionType,
  confirmationUrl,
  otpCode,
  senderName,
  logoUrl,
  accentColor,
}: AuthHookEmailParams): string {
  const name = escapeHtml(senderName);
  const button = accentColor || '#111827';
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${name}" style="max-height:32px;max-width:200px;margin:0 0 20px;display:block;">`
    : '';

  // Reauthentication is a typed-in code, not a link — no CTA button makes sense.
  if (actionType === 'reauthentication' && otpCode) {
    return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      ${logo}
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Your ${name} verification code</h1>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.5;">Enter this code to continue:</p>
      <p style="margin:0 0 20px;font-size:28px;font-weight:700;letter-spacing:0.1em;color:#111827;">${escapeHtml(otpCode)}</p>
      <p style="margin:0;color:#6b7280;font-size:13px;">If you didn't request this, you can ignore this email.</p>
    </div>`.trim();
  }

  const copy = COPY[actionType] ?? DEFAULT_COPY;
  const url = confirmationUrl ?? '#';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    ${logo}
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${copy.heading(name)}</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">${copy.body}</p>
    <a href="${url}" style="display:inline-block;background:${button};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">${copy.cta}</a>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Or paste this link into your browser:<br><a href="${url}" style="color:#2563eb;word-break:break-all;">${url}</a></p>
    ${otpCode ? `<p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Or enter this code: <strong style="color:#111827;">${escapeHtml(otpCode)}</strong></p>` : ''}
  </div>`.trim();
}
