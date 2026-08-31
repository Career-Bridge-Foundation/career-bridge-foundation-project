import React from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { CommunityManager } from './_community-manager'

export const dynamic = 'force-dynamic'

/**
 * Spec 19.3 config layer — a partner's community integration is a nullable
 * attribute, absent by default (decision 8). This is where an admin sets it;
 * nothing here calls Circle or any provider's API — this only ever writes
 * the DB values the (not-yet-built) provisioning worker will later read.
 */
export default async function CommunityPage() {
  await requireSuperAdmin()

  const { data: partners, error } = await supabaseServer
    .from('partners')
    .select('id, name, community_provider, community_url, community_space_id, community_enabled, community_credential_last4')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Community provisioning</h1>
        <p className="text-sm mt-1 text-slate-600">
          Configure a partner's community integration (Spec 19.3). Absent by default — a partner with nothing
          configured here simply has no provisioning step. No provider API is called from this page; this only
          stores what a future automated worker (or the manual fallback already in the partner console) reads.
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load partners: <span className="font-mono">{error.message}</span>. If this mentions a
          missing column, the migration for this page (
          <span className="font-mono">20260831_001_community_provisioning_config.sql</span>) likely hasn&apos;t
          been applied to the database yet.
        </div>
      ) : (
        <CommunityManager partners={partners ?? []} />
      )}
    </div>
  )
}
