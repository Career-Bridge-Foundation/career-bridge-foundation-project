import React from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { PartnersTabs } from './_partners-tabs'

export const dynamic = 'force-dynamic'

/**
 * Terms (Spec 19) and Community provisioning (Spec 19.3) config both live as
 * tabs here rather than separate top-level admin sections — both are
 * per-partner concerns (a partner's own programme terms, a partner's own
 * community settings), so they belong under Partners, not beside it.
 */
export default async function PartnersPage() {
  // Super-admin only — partner-role grants access to an org's entire
  // candidate dataset, so bootstrapping a new org is a high-privilege op.
  await requireSuperAdmin()

  const { data: partners, error: partnersError } = await supabaseServer
    .from('partners')
    .select(
      'id, name, slug, status, contact_email, created_at, community_provider, community_url, community_space_id, community_enabled, community_credential_last4'
    )
    .order('created_at', { ascending: false })

  const { data: termsDocs, error: termsError } = await supabaseServer
    .from('terms_documents')
    .select('id, document_type, partner_id, version, body, document_hash, published_at, is_active')
    .order('published_at', { ascending: false })

  const error = partnersError ?? termsError

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Partners</h1>
        <p className="text-sm mt-1 text-slate-600">
          Organisations, their programme terms, and their community integration.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load this page: <span className="font-mono">{error.message}</span>. If this mentions a
          missing column, a migration for Terms or Community config likely hasn&apos;t been applied yet.
        </div>
      ) : (
        <PartnersTabs partners={partners ?? []} termsDocs={termsDocs ?? []} />
      )}
    </div>
  )
}
