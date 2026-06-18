'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useBranding } from '@/components/branding/BrandingProvider'
import { createClient } from '@/lib/supabase/client'

type State =
  | { kind: 'loading' }
  | { kind: 'no_token' }
  | { kind: 'needs_auth'; token: string }
  | { kind: 'accepting' }
  | { kind: 'success'; role: string }
  | { kind: 'already' }
  | { kind: 'expired' }
  | { kind: 'wrong_account' }
  | { kind: 'cross_org' }
  | { kind: 'invalid' }
  | { kind: 'error' }

function AcceptInviteInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const branding = useBranding()
  const [state, setState] = useState<State>({ kind: 'loading' })

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
        if (!cancelled) setState({ kind: 'needs_auth', token })
        return
      }

      // Logged in — attempt acceptance.
      if (!cancelled) setState({ kind: 'accepting' })
      try {
        const res = await fetch('/api/partner/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (res.ok) {
          setState({ kind: 'success', role: typeof data?.role === 'string' ? data.role : 'partner' })
        } else if (res.status === 409) {
          // Two distinct 409s: already-accepted vs cross-org hijack.
          if (typeof data?.error === 'string' && data.error.includes('already accepted')) {
            setState({ kind: 'already' })
          } else {
            setState({ kind: 'cross_org' })
          }
        } else if (res.status === 410) {
          setState({ kind: 'expired' })
        } else if (res.status === 403) {
          setState({ kind: 'wrong_account' })
        } else if (res.status === 400 || res.status === 404) {
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

  // Token-preserving auth links. The accept URL (with token) is the return
  // destination, URL-encoded so its own ?token= survives as part of `next`.
  const returnTo = token ? `/accept-invite?token=${encodeURIComponent(token)}` : '/accept-invite'
  const signupHref = `/auth/signup?next=${encodeURIComponent(returnTo)}`
  const loginHref = `/auth/login?next=${encodeURIComponent(returnTo)}`

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <main className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
        <div className="w-full max-w-[460px]">
          <div className="bg-white rounded-2xl border border-border-light shadow-lg p-8 md:p-10 text-center">
            <div className="flex justify-center mb-4">
              <img
                src={branding?.logo_url_on_light ?? '/evidentize-logo-colour.png'}
                alt={branding?.name ?? 'Evidentize'}
                className="h-10 w-auto"
              />
            </div>

            {state.kind === 'loading' && (
              <p className="text-sm text-gray-500 py-6">Checking your invitation…</p>
            )}

            {state.kind === 'accepting' && (
              <p className="text-sm text-gray-500 py-6">Setting up your access…</p>
            )}

            {state.kind === 'needs_auth' && (
              <>
                <h1 className="text-2xl font-bold text-navy mb-2">You&rsquo;ve been invited</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-8">
                  You&rsquo;ve been invited to join an organisation. Create your
                  account to accept, or sign in if you already have one.
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
                <h1 className="text-2xl font-bold text-navy mb-2">You&rsquo;re all set</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  {state.role === 'mentor'
                    ? 'Your mentor access is active — you can now see the candidates and disciplines assigned to you.'
                    : 'Your admin access is active. You can now manage your organisation’s candidates, mentors, and team.'}
                </p>
                <Link
                  href={state.role === 'mentor' ? '/mentor' : '/partner'}
                  className="block w-full rounded-lg bg-navy text-white text-sm font-semibold py-3 hover:opacity-90"
                >
                  {state.role === 'mentor' ? 'Go to your mentor console' : 'Go to your console'}
                </Link>
              </>
            )}

            {state.kind === 'already' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <CheckCircle size={48} className="text-teal" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Already accepted</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  This invitation has already been accepted — you already have access.
                </p>
                <Link
                  href="/partner"
                  className="block w-full rounded-lg bg-navy text-white text-sm font-semibold py-3 hover:opacity-90"
                >
                  Go to your console
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

            {state.kind === 'cross_org' && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <AlertCircle size={48} className="text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-navy mb-2">Account already in use</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This account already belongs to another organisation, so it can&rsquo;t
                  accept this invitation. Contact the organisation that invited you to sort
                  out access.
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
                  This invitation link is invalid or incomplete. Please check the link or
                  contact the organisation that invited you.
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
                  We couldn&rsquo;t process your invitation just now. Please try again in a
                  moment.
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

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  )
}
