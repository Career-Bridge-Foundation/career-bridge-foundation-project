'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <main className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl border border-border-light shadow-lg p-8 md:p-10">
            <div className="flex justify-center mb-4">
              <img
                src="/logo-colour.png"
                alt="Career Bridge Foundation"
                className="h-10 w-auto"
              />
            </div>

            {success ? (
              <div className="text-center py-2">
                <div className="flex items-center justify-center mb-4">
                  <CheckCircle size={48} className="text-teal" />
                </div>
                <h2 className="text-xl font-bold text-navy mb-2">Check your email</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  We sent a password reset link to{' '}
                  <span className="font-medium text-navy">{email}</span>.
                </p>
                <Link
                  href="/auth/login"
                  className="text-sm text-link-blue hover:opacity-80 mt-6 inline-block"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-navy text-center mb-2">
                  Reset your password
                </h1>
                <p className="text-sm text-center text-gray-500 mb-8">
                  Enter your email and we&apos;ll send you a reset link
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
                    {error}
                  </div>
                )}

                <form onSubmit={handleReset} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-medium text-navy uppercase tracking-brand-xs mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="sim-input w-full rounded-lg px-4 py-3 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-navy text-white w-full py-3 rounded-lg text-sm font-medium uppercase tracking-brand-sm hover:opacity-90 transition-opacity disabled:opacity-60 mt-2"
                  >
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-8">
                  <Link href="/auth/login" className="text-link-blue hover:opacity-80">
                    Back to sign in
                  </Link>
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
