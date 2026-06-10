'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/client'

type State =
  | { kind: 'loading' }
  | { kind: 'no_token' }
  | { kind: 'needs_auth'; token: string }
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
  // NOTE (white-label seam): for partner-branded onboarding, resolve the
  // inviting partner from the token here and brand this screen accordingly.
  const returnTo = token ? `/redeem?token=${encodeURIComponent(token)}` : '/redeem'
  const signupHref = `/auth/signup?next=${encodeURIComponent(returnTo)}`
  const loginHref = `/auth/login?next=${encodeURIComponent(returnTo)}`

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <main className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
        <div className="w-full max-w-[460px]">
          <div className="bg-white rounded-2xl border border-border-light shadow-lg p-8 md:p-10 text-center">
            <div className="flex justify-center mb-4">
              <img src="/logo-colour.png" alt="Career Bridge Foundation" className="h-10 w-auto" />
            </div>

            {state.kind === 'loading' && (
              <p className="text-sm text-gray-500 py-6">Checking your invitation…</p>
            )}

            {state.kind === 'redeeming' && (
              <p className="text-sm text-gray-500 py-6">Activating your access…</p>
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
