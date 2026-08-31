import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses RLS — never import this in client components
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const NEUTRAL_DOMAIN = 'email.evidentize.io';
const NEUTRAL_FROM_NAME = 'Evidentize';
const DEFAULT_LOCAL_PART = 'noreply';

type ResolvedSender = {
  from: string; // "Career Bridge <noreply@email.careerbridgefoundation.com>"
  domain: string;
  isFallback: boolean;
  partnerName: string; // the partner's real brand name — independent of email channel
  replyTo: string | null; // the partner's contact email, when known
  logoUrl: string | null; // logo_url_on_light — safe on the white template background
  accentColor: string | null; // primary_color
};

function buildFrom(name: string, domain: string): string {
  return `${name} <${DEFAULT_LOCAL_PART}@${domain}>`;
}

function neutral(partnerName: string = NEUTRAL_FROM_NAME): ResolvedSender {
  return {
    from: buildFrom(NEUTRAL_FROM_NAME, NEUTRAL_DOMAIN),
    domain: NEUTRAL_DOMAIN,
    isFallback: true,
    partnerName,
    replyTo: null,
    logoUrl: null,
    accentColor: null,
  };
}

export async function resolvePartnerSender(partnerId: string | null): Promise<ResolvedSender> {
  if (!partnerId) return neutral();

  const { data, error } = await adminClient
    .from('partners')
    .select('name, email_sender_name, email_sender_domain, contact_email, logo_url_on_light, primary_color')
    .eq('id', partnerId)
    .single();

  if (error || !data) return neutral();

  // The partner's real brand name — used regardless of email-domain config.
  const senderName =
    data.email_sender_name?.trim() || data.name?.trim() || NEUTRAL_FROM_NAME;
  const replyTo = data.contact_email?.trim() || null;
  const logoUrl = data.logo_url_on_light ?? null;
  const accentColor = data.primary_color ?? null;

  // Row exists but no sending domain configured: neutral email channel for
  // deliverability, but carry the real partner name/branding.
  if (!data.email_sender_domain) {
    return { ...neutral(senderName), replyTo, logoUrl, accentColor };
  }

  return {
    from: buildFrom(senderName, data.email_sender_domain),
    domain: data.email_sender_domain,
    isFallback: false,
    partnerName: senderName,
    replyTo,
    logoUrl,
    accentColor,
  };
}
