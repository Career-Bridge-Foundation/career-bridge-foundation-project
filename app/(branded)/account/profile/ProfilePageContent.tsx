'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const NAVY = '#003359'
const TEAL = '#4DC5D2'

type ExternalLink = { label: string; url: string }

type InitialData = {
  email: string
  full_name: string
  avatar_url: string | null
  portfolio_slug: string | null
  headline: string
  bio: string
  location: string
  linkedin_url: string
  external_links: ExternalLink[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

const inputClass =
  'w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent bg-white text-slate-800 placeholder:text-slate-400 transition'

const labelClass = 'block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5'

export function ProfilePageContent({ initial }: { initial: InitialData }) {
  const searchParams = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === '1'

  const [fullName, setFullName] = useState(initial.full_name)
  const [headline, setHeadline] = useState(initial.headline)
  const [bio, setBio] = useState(initial.bio)
  const [location, setLocation] = useState(initial.location)
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url)
  const [links, setLinks] = useState<ExternalLink[]>(initial.external_links)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function addLink() {
    if (links.length < 6) setLinks(prev => [...prev, { label: '', url: '' }])
  }

  function removeLink(i: number) {
    setLinks(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateLink(i: number, field: 'label' | 'url', value: string) {
    setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveState('saving')
    setErrorMsg('')
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          headline,
          bio,
          location,
          linkedin_url: linkedinUrl,
          external_links: links.filter(l => l.label && l.url),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setSaveState('error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header variant="solid" />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-24">
        {/* Onboarding welcome banner */}
        {isOnboarding && (
          <div
            className="mb-8 rounded-xl px-5 py-4 flex items-start gap-4"
            style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-800 mb-1">
                Welcome to Evidentize — one quick step before you start.
              </p>
              <p className="text-sm text-emerald-700 leading-relaxed">
                Add your name below and save. That&apos;s all that&apos;s needed to unlock simulations.
              </p>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-1"
            style={{ color: NAVY, fontFamily: "'Fraunces', serif" }}
          >
            Your Profile
          </h1>
          <p className="text-sm text-slate-500">
            This information appears on your public portfolio.
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Avatar + identity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5">
            {initial.avatar_url ? (
              <img
                src={initial.avatar_url}
                alt={fullName || 'Avatar'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-offset-2 ring-slate-200 flex-shrink-0"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{ backgroundColor: NAVY }}
              >
                {getInitials(fullName || initial.email)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">Signed in as</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{initial.email}</p>
              {initial.avatar_url && (
                <p className="text-xs text-slate-400 mt-1">Avatar synced from your sign-in provider</p>
              )}
            </div>
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>
              Basic Info
            </h2>

            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Headline</label>
              <input
                type="text"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="e.g. Product Manager · Data Enthusiast"
                maxLength={120}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. London, UK"
                maxLength={80}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="A short intro about yourself — your background, goals, and what you're working towards."
                maxLength={500}
                rows={4}
                className={inputClass + ' resize-none'}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{bio.length}/500</p>
            </div>
          </div>

          {/* Social links */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>
              Social &amp; Links
            </h2>

            <div>
              <label className={labelClass}>LinkedIn URL</label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/yourhandle"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={labelClass + ' mb-0'}>Other Links</label>
                {links.length < 6 && (
                  <button
                    type="button"
                    onClick={addLink}
                    className="text-xs font-semibold uppercase tracking-widest hover:opacity-70 transition-opacity"
                    style={{ color: TEAL }}
                  >
                    + Add Link
                  </button>
                )}
              </div>
              {links.length === 0 && (
                <p className="text-sm text-slate-400">No links added yet.</p>
              )}
              <div className="flex flex-col gap-3">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={e => updateLink(i, 'label', e.target.value)}
                      placeholder="Label"
                      maxLength={30}
                      className={inputClass + ' flex-[0_0_30%]'}
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={e => updateLink(i, 'url', e.target.value)}
                      placeholder="https://..."
                      className={inputClass + ' flex-1'}
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(i)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      aria-label="Remove link"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Portfolio link */}
          {initial.portfolio_slug && (
            <div
              className="rounded-xl px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-0.5">Your Public Portfolio</p>
                <p className="text-sm text-emerald-800 font-medium">
                  evidentize.io/portfolio/{initial.portfolio_slug}
                </p>
              </div>
              <Link
                href={`/portfolio/${initial.portfolio_slug}`}
                target="_blank"
                className="text-xs font-semibold uppercase tracking-widest px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                View →
              </Link>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saveState === 'saving'}
              className="px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: NAVY }}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save Changes'}
            </button>
            {saveState === 'saved' && (
              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </span>
            )}
            {saveState === 'error' && (
              <span className="text-sm text-red-500">{errorMsg}</span>
            )}
          </div>
        </form>
      </main>

      <Footer />
    </div>
  )
}
