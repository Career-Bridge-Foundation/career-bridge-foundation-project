import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Platform Terms of Service',
}

// Always serve the currently active version — a new version is published from
// the admin terms manager without a deploy.
export const dynamic = 'force-dynamic'

/**
 * Public, read-only copy of the active Evidentize platform terms
 * (terms_documents, document_type = 'platform_terms', is_active = true).
 * Linked from the Terms & Conditions checkboxes in AssessmentPackModal.
 * Read with the service-role client because terms_documents RLS only lets
 * authenticated users read, and the terms must be readable before sign-in.
 * Exempted from the role and acceptance redirects in middleware.ts.
 */
export default async function PlatformTermsPage() {
  const { data: terms } = await supabaseServer
    .from('terms_documents')
    .select('version, body, published_at')
    .eq('document_type', 'platform_terms')
    .eq('is_active', true)
    .maybeSingle()

  const publishedAt = terms?.published_at
    ? new Date(terms.published_at as string).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <main className="flex-1 px-6 py-16 pt-28">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-bold text-navy mb-1">Platform Terms of Service</h1>
          {terms ? (
            <>
              <p className="text-sm text-slate-500 mb-6">
                Version {terms.version as string}
                {publishedAt && <> · Effective {publishedAt}</>}
              </p>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {terms.body as string}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              The terms of service are not available right now. Please try again later.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
