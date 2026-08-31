'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useBranding } from '@/components/branding/BrandingProvider'
import { createClient } from '@/lib/supabase/client'
import { TermsChecklist, type ChecklistDoc } from '@/components/terms/TermsChecklist'

type PreviewData = {
  token: string
  docs: ChecklistDoc[]
  communityUrl: string | null
  partnerName: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'no_token' }
  | { kind: 'needs_auth'; token: string }
  | { kind: 'preview'; data: PreviewData }
  | { kind: 'redeeming' }
  | { kind: 'success'; disciplines: string[] }
  | { kind: 'already' }
  | { kind: 'expired' }
  | { kind: 'wrong_account' }
  | { kind: 'invalid' }
  | { kind: 'error' }

// Human label for a discipline slug (e.g. "cyber-security" -> "Cyber Security").
function disciplineLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function RedeemInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const branding = useBranding()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [previewChecked, setPreviewChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!token) {
        setState({ kind: 'no_token' })
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Unauthenticated: show what this candidate is about to accept (and
        // their partner's community link, if any) BEFORE they create an
        // account — see GET /api/redeem/preview. The actual acceptance
        // write still happens right after auth completes, in POST
        // /api/redeem — this is a preview, not the record itself.
        try {
          const res = await fetch(`/api/redeem/preview?token=${encodeURIComponent(token)}`)
          const data = await res.json().catch(() => ({}))
          if (cancelled) return

          if (res.ok && Array.isArray(data.docs) && data.docs.length > 0) {
            setState({
              kind: 'preview',
              data: {
                token,
                docs: data.docs,
                communityUrl: data.community_url ?? null,
                partnerName: data.partner_name ?? null,
              },
            })
          } else if (res.status === 409) {
            setState({ kind: 'already' })
          } else if (res.status === 410) {
            setState({ kind: 'expired' })
          } else if (res.status === 400 || res.status === 404) {
            setState({ kind: 'invalid' })
          } else {
            // Nothing outstanding to preview (or preview failed) — fall back
            // to the plain invite screen; POST /api/redeem still runs the
            // full acceptance check server-side regardless.
            setState({ kind: 'needs_auth', token })
          }
        } catch {
          if (!cancelled) setState({ kind: 'needs_auth', token })
        }
        return
      }

      // Logged in — attempt redemption.
      if (!cancelled) setState({ kind: 'redeeming' })
      try {
        const res = await fetch('/api/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (res.ok) {
          setState({ kind: 'success', disciplines: data.disciplines ?? [] })
        } else if (res.status === 409) {
          setState({ kind: 'already' })
        } else if (res.status === 410) {
          setState({ kind: 'expired' })
        } else if (res.status === 403 && typeof data?.error === 'string' && data.error.includes('your account')) {
          setState({ kind: 'wrong_account' })
        } else if (res.status === 400 || res.status === 404 || res.status === 403) {
          setState({ kind: 'invalid' })
        } else {
          setState({ kind: 'error' })
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [token])

  // Token-preserving auth links. The redeem URL (with token) is the return
  // destination, URL-encoded so its own ?token= survives as part of `next`.
  const returnTo = token ? `/redeem?token=${encodeURIComponent(token)}` : '/redeem'
  const signupHref = `/auth/signup?next=${encodeURIComponent(returnTo)}`
  const loginHref = `/auth/login?next=${encodeURIComponent(returnTo)}`

  const isPreview = state.kind === 'preview'

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <main className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
        <div className={`w-full ${isPreview ? 'max-w-2xl' : 'max-w-[460px]'}`}>
          <div className={`bg-white rounded-2xl border border-border-light shadow-lg p-8 md:p-10 ${isPreview ? '' : 'text-center'}`}>
            <div className={`flex ${isPreview ? '' : 'justify-center'} mb-4`}>
              <img
                src={branding?.logo_url_on_light ?? "/evidentize-logo-colour.png"}
                alt={branding?.name ?? "Evidentize"}
                className="h-10 w-auto"
              />
            </div>

            {state.kind === 'loading' && (
              <p className="text-sm text-gray-500 py-6 text-center">Checking your invitation…</p>
            )}

            {state.kind === 'redeeming' && (
              <p className="text-sm text-gray-500 py-6 text-center">Activating your access…</p>
            )}

            {state.kind === 'preview' && (
              <>
                <h1 className="text-2xl font-bold text-navy mb-2">Before you create your account</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  Review what you're accepting below — you'll create your account next.
                </p>

                <TermsChecklist docs={state.data.docs} onAllCheckedChange={setPreviewChecked} />

                {state.data.communityUrl && (
                  <div className="mt-6 rounded-lg border border-teal/30 bg-teal/5 p-4">
                    <p className="text-sm font-semibold text-navy">Your community</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Once you're set up, {state.data.partnerName ? `${state.data.partnerName}'s` : 'your'} community is
                      where induction, support and peer contact happen — you'll be able to join once your account is created.
                    </p>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3">
                  <Link
                    href={previewChecked ? signupHref : '#'}
                    aria-disabled={!previewChecked}
                    onClick={(e) => { if (!previewChecked) e.preventDefault() }}
                    className={`block w-full rounded-lg text-sm font-semibold py-3 text-center ${
                      previewChecked
                        ? 'bg-navy text-white hover:opacity-90'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Create your account
                  </Link>
                  <Link
                    href={previewChecked ? loginHref : '#'}
                    aria-disabled={!previewChecked}
                    onClick={(e) => { if (!previewChecked) e.preventDefault() }}
                    className={`block w-full rounded-lg border text-sm font-semibold py-3 text-center ${
                      previewChecked
                        ? 'border-border-light text-navy hover:bg-gray-50'
                        : 'border-slate-200 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    I already have an account — sign in
                  </Link>
                </div>
              </>
            )}

            {state.kind === 'needs_auth' && (
              <>
                <h1 className="text-2xl font-bold text-navy mb-2">You&rsquo;ve been invited</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-8">
                  You have an invitation to claim simulation access. Create your account
                  to get started, or sign in if you already have one.
                </p>
                <Link
                  href={signupHref}
                  className="block w-full rounded-lg bg-navy text-white text-sm font-semibold py-3 mb-3 hover:opacity-90"
                >
                  Create your account
                </Link>
                <Link
                  href={loginHref}
                  className="block w-full rounded-lg border border-border-light text-navy text-sm font-semibold py-3 hover:bg-gray-50"
                >
                  Sign in
                </Link>
              </>
            )}

            {state.kind === 'success' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <CheckCircle size={48} className="text-teal" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Access granted</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  You now have access to{' '}
                  <span className="font-medium text-navy">
                    {state.disciplines.map(disciplineLabel).join(', ') || 'your simulations'}
                  </span>
                  . Start building your portfolio.
                </p>
                <Link
                  href={state.disciplines.length === 1 ? `/simulations/${state.disciplines[0]}` : '/simulations'}
                  className="block w-full rounded-lg bg-navy text-white text-sm font-semibold py-3 hover:opacity-90"
                >
                  Go to simulations
                </Link>
              </>
            )}

            {state.kind === 'already' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <CheckCircle size={48} className="text-teal" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Already redeemed</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  This invitation has already been claimed — you already have access.
                </p>
                <Link
                  href="/simulations"
                  className="block w-full rounded-lg bg-navy text-white text-sm font-semibold py-3 hover:opacity-90"
                >
                  Go to simulations
                </Link>
              </>
            )}

            {state.kind === 'wrong_account' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <AlertCircle size={48} className="text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Wrong account</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This invitation was sent to a different email address. Please sign in
                  with the email the invitation was sent to, then open the link again.
                </p>
              </>
            )}

            {state.kind === 'expired' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <AlertCircle size={48} className="text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Invitation expired</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This invitation link has expired. Please contact the organisation that
                  invited you for a new one.
                </p>
              </>
            )}

            {(state.kind === 'invalid' || state.kind === 'no_token') && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <AlertCircle size={48} className="text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Invalid link</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This redemption link is invalid or incomplete. Please check the link
                  or contact the organisation that invited you.
                </p>
              </>
            )}

            {state.kind === 'error' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <AlertCircle size={48} className="text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Something went wrong</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  We couldn&rsquo;t process your invitation just now. Please try again in
                  a moment.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function RedeemPage() {
  return (
    <Suspense fallback={null}>
      <RedeemInner />
    </Suspense>
  )
}
