'use client'

import React, { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const params = useSearchParams()
  const urlError = params.get('error')

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState(
    urlError === 'not_admin' ? 'This email is not authorised as an admin.' : ''
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    setErrorMsg('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="bg-white rounded-lg p-8 border border-slate-200 shadow-sm">
      {status === 'sent' ? (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-teal/10 border border-teal/30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                stroke="currentColor"
                className="text-teal"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-base text-slate-900">
              Check your email
            </h2>
            <p className="text-sm mt-2 leading-relaxed text-slate-600">
              We sent a magic link to{' '}
              <strong className="text-slate-900">{email}</strong>.
              The link expires in 1 hour.
            </p>
          </div>
          <button
            onClick={() => { setStatus('idle'); setEmail('') }}
            className="text-sm font-medium text-teal hover:text-teal/80 transition-colors"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="font-semibold text-lg text-slate-900">
              Sign in
            </h2>
            <p className="text-sm mt-1 text-slate-600">
              Enter your admin email to receive a magic link.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-900"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all bg-white border border-slate-300 focus:border-teal focus:ring-2 focus:ring-teal/20 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {(status === 'error' || errorMsg) && (
            <p className="text-sm rounded-lg px-4 py-3 bg-red-50 border border-red-200 text-red-700">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white bg-teal hover:bg-teal/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="font-bold text-2xl mb-2 text-slate-900">
            CareerBridge
          </div>
          <div className="text-xs font-semibold tracking-widest uppercase text-teal">
            Admin Console
          </div>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-lg p-8 border border-slate-200">
            <div className="h-32 animate-pulse rounded-md bg-slate-100" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
