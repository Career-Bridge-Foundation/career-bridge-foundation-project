'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const NAVY = '#003359'
const TEAL = '#4DC5D2'

type InitialData = {
  email: string
  portfolioPublic: boolean
  hasPortfolio: boolean
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 flex-shrink-0"
      style={{
        backgroundColor: checked ? TEAL : '#D1D5DB',
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

type SectionProps = { title: string; description?: string; children: React.ReactNode }
function Section({ title, description, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  )
}

function SettingRow({ label, description, control }: { label: string; description?: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  )
}

export function AccountSettingsContent({ initial }: { initial: InitialData }) {
  const [portfolioPublic, setPortfolioPublic] = useState(initial.portfolioPublic)
  const [privacySaving, setPrivacySaving] = useState(false)

  // Notification prefs (UI only — no backend yet)
  const [emailResults, setEmailResults] = useState(true)
  const [emailCredentials, setEmailCredentials] = useState(true)
  const [emailUpdates, setEmailUpdates] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  async function handlePortfolioToggle(val: boolean) {
    setPortfolioPublic(val)
    setPrivacySaving(true)
    try {
      await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: val }),
      })
    } finally {
      setPrivacySaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header variant="solid" />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-24">
        {/* Page header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-1"
            style={{ color: NAVY, fontFamily: "'Fraunces', serif" }}
          >
            Account Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage your preferences, privacy, and account.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Account */}
          <Section title="Account" description="Your sign-in credentials">
            <SettingRow
              label="Email Address"
              description="Your account email — contact support to change it"
              control={
                <span className="text-sm text-slate-500 font-mono">{initial.email}</span>
              }
            />
          </Section>

          {/* Notifications */}
          <Section title="Email Notifications" description="Choose which emails you'd like to receive">
            <SettingRow
              label="Simulation Results"
              description="Receive an email when your simulation evaluation is ready"
              control={<Toggle checked={emailResults} onChange={setEmailResults} />}
            />
            <SettingRow
              label="Credential Issued"
              description="Get notified when a new digital credential is available to claim"
              control={<Toggle checked={emailCredentials} onChange={setEmailCredentials} />}
            />
            <SettingRow
              label="Platform Updates"
              description="Occasional news about new simulations and features"
              control={<Toggle checked={emailUpdates} onChange={setEmailUpdates} />}
            />
          </Section>

          {/* Privacy */}
          <Section title="Privacy" description="Control how your data is visible to others">
            <SettingRow
              label="Public Portfolio"
              description={
                initial.hasPortfolio
                  ? 'Allow anyone with your portfolio link to view your results and credentials'
                  : 'Complete a simulation first to enable your public portfolio'
              }
              control={
                initial.hasPortfolio ? (
                  <div className="flex items-center gap-2">
                    {privacySaving && (
                      <svg className="animate-spin w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    )}
                    <Toggle checked={portfolioPublic} onChange={handlePortfolioToggle} />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Unavailable</span>
                )
              }
            />
          </Section>

          {/* Data */}
          <Section title="Your Data">
            <SettingRow
              label="Export Data"
              description="Download a copy of all your simulation responses and results"
              control={
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-widest px-4 py-2 border transition-opacity hover:opacity-70"
                  style={{ borderColor: NAVY, color: NAVY }}
                >
                  Request Export
                </button>
              }
            />
          </Section>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-red-100">
              <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Danger Zone</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700 mb-4">
                Deleting your account is permanent and cannot be undone. All your simulation results, credentials, and portfolio data will be removed.
              </p>
              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-xs font-semibold uppercase tracking-widest px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete My Account
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-red-600 font-medium">
                    Type <strong>DELETE</strong> to confirm account deletion
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value)}
                      placeholder="DELETE"
                      className="px-4 py-2.5 text-sm border border-red-300 rounded focus:outline-none focus:ring-2 focus:ring-red-300 w-40 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteInput !== 'DELETE'}
                      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirm(false); setDeleteInput('') }}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
