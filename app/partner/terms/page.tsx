import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { TermsManager } from './_terms-manager'

export const dynamic = 'force-dynamic'

const BUCKET = 'partner-terms-documents'
const SIGNED_URL_TTL = 3600 // 1 hour, matches lib/partners/candidateDetail.ts's convention

/**
 * A partner authors and owns their own programme terms here — cohort
 * undertaking, community conduct, non-completion consequences, contact
 * route. Optional: a partner can have none at all, in which case only
 * Evidentize's own platform terms ever apply to their candidates. Also
 * where they set their community invite link (partners.community_url) —
 * a plain link they generate themselves, not something the platform
 * provisions.
 */
export default async function PartnerTermsPage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner/terms')
  }
  const partnerId = ctx.partnerId as string

  const { data: docs, error } = await supabaseServer
    .from('terms_documents')
    .select('id, version, body, document_hash, published_at, is_active, source_storage_path, source_file_type')
    .eq('document_type', 'partner_programme_terms')
    .eq('partner_id', partnerId)
    .order('published_at', { ascending: false })

  const { data: partner } = await supabaseServer
    .from('partners')
    .select('name, community_url')
    .eq('id', partnerId)
    .maybeSingle()

  // Sign every file-sourced version up front — private bucket, short-lived URLs.
  const filePaths = (docs ?? []).map((d) => d.source_storage_path).filter((p): p is string => !!p)
  const signedUrlByPath = new Map<string, string>()
  if (filePaths.length) {
    const { data: signed } = await supabaseServer.storage.from(BUCKET).createSignedUrls(filePaths, SIGNED_URL_TTL)
    for (const s of signed ?? []) if (s.path && s.signedUrl) signedUrlByPath.set(s.path, s.signedUrl)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">Programme terms</h1>
        <p className="text-sm mt-1 text-slate-600">
          Your own cohort terms — the undertaking, community conduct, non-completion consequences, and your
          contact route. Optional: leave this unset and candidates you provision only ever see Evidentize's own
          platform terms.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load this page: <span className="font-mono">{error.message}</span>.
        </div>
      ) : (
        <TermsManager
          docs={(docs ?? []).map((d) => ({
            ...d,
            signedUrl: d.source_storage_path ? signedUrlByPath.get(d.source_storage_path) ?? null : null,
          }))}
          communityUrl={(partner?.community_url as string | null) ?? ''}
        />
      )}
    </div>
  )
}
