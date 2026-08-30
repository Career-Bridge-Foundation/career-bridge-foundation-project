import React from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { TermsManager } from './_terms-manager'

export const dynamic = 'force-dynamic'

/**
 * Spec 19 decision 1: two documents, two parties, never merged. This page
 * keeps that separation visible in the UI itself — platform terms and
 * partner programme terms are two distinct sections, never one shared form,
 * so it's structurally impossible to accidentally publish one partner's
 * programme text as if it were the neutral platform document or vice versa.
 *
 * Super-admin only, matching POST /api/admin/terms-documents — partner
 * self-serve publishing is explicitly out of scope (a partner's own admin
 * cannot reach this page at all; middleware blocks non-staff from /admin).
 */
export default async function TermsPage() {
  await requireSuperAdmin()

  const { data: docs } = await supabaseServer
    .from('terms_documents')
    .select('id, document_type, partner_id, version, body, document_hash, published_at, is_active')
    .order('published_at', { ascending: false })

  const { data: partners } = await supabaseServer
    .from('partners')
    .select('id, name, slug')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Terms &amp; programme documents</h1>
        <p className="text-sm mt-1 text-slate-600">
          Publish the Evidentize platform terms and each partner&apos;s programme terms. Two separate
          documents, never merged — publishing a new version supersedes the previous one for candidates
          going forward, but nothing already published is ever edited or removed.
        </p>
      </div>
      <TermsManager docs={docs ?? []} partners={partners ?? []} />
    </div>
  )
}
