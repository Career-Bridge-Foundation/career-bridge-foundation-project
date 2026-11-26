import React from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { PartnersTabs } from './_partners-tabs'

export const dynamic = 'force-dynamic'

/**
 * Platform terms (Spec 19) lives as a tab here — the one document type
 * super-admin still publishes. Partner programme terms and community
 * config both moved to the partner's own dashboard (app/partner/terms).
 */
export default async function PartnersPage() {
  // Super-admin only — partner-role grants access to an org's entire
  // candidate dataset, so bootstrapping a new org is a high-privilege op.
  await requireSuperAdmin()

  const { data: partners, error: partnersError } = await supabaseServer
    .from('partners')
    .select('id, name, slug, status, contact_email, subdomain, email_sender_name, email_sender_domain, created_at')
    .order('created_at', { ascending: false })

  const { data: termsDocs, error: termsError } = await supabaseServer
    .from('terms_documents')
    .select('id, document_type, partner_id, version, body, document_hash, published_at, is_active')
    .eq('document_type', 'platform_terms')
    .order('published_at', { ascending: false })

  // Spec 20 — each partner's active discipline range (empty = unrestricted).
  const { data: rangeRows, error: rangeError } = await supabaseServer
    .from('partner_disciplines')
    .select('partner_id, discipline')
    .is('revoked_at', null)

  const rangeByPartner = new Map<string, string[]>()
  for (const r of rangeRows ?? []) {
    const list = rangeByPartner.get(r.partner_id as string) ?? []
    list.push(r.discipline as string)
    rangeByPartner.set(r.partner_id as string, list)
  }
  const partnersWithRange = (partners ?? []).map((p) => ({ ...p, disciplines: rangeByPartner.get(p.id) ?? [] }))

  const error = partnersError ?? termsError ?? rangeError

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Partners</h1>
        <p className="text-sm mt-1 text-slate-600">
          Organisations and the Evidentize platform terms.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load this page: <span className="font-mono">{error.message}</span>.
        </div>
      ) : (
        <PartnersTabs partners={partnersWithRange} termsDocs={termsDocs ?? []} />
      )}
    </div>
  )
}
