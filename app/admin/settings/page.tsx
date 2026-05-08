import React from 'react'
import { ExternalLink } from 'lucide-react'
import packageJson from '@/package.json'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '')}.supabase.co`.replace(
      /^https?:\/\//,
      ''
    )
  : null

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm mt-1 text-slate-600">Environment and system configuration</p>
      </div>

      {/* Admin emails */}
      <section className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Authorised admins</h2>
          <p className="text-xs text-slate-600 mt-1">
            Set via the <code className="text-teal/80 font-mono text-xs">ADMIN_EMAILS</code> environment variable, comma-separated.
          </p>
        </div>
        <div className="divide-y divide-slate-200">
          {ADMIN_EMAILS.length === 0 ? (
            <div className="px-6 py-4 text-sm text-slate-600 italic">
              No ADMIN_EMAILS set — all authenticated users can access admin.
            </div>
          ) : (
            ADMIN_EMAILS.map(email => (
              <div key={email} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-teal/10 border border-teal/30 text-teal">
                  {email[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-900 font-mono">{email}</span>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700">
                  admin
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* App info */}
      <section className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Application</h2>
        </div>
        <div className="divide-y divide-slate-200">
          <InfoRow label="App name" value={packageJson.name} />
          <InfoRow label="Version" value={`v${packageJson.version}`} />
          <InfoRow label="Next.js" value={packageJson.dependencies.next} />
        </div>
      </section>

      {/* Supabase */}
      <section className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Supabase</h2>
        </div>
        <div className="divide-y divide-slate-200">
          <InfoRow
            label="Project URL"
            value={SUPABASE_PROJECT_URL ?? '—'}
          />
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">Dashboard</span>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 transition-colors font-medium"
            >
              Open Supabase
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">{label}</span>
      <span className="text-sm text-slate-900 font-mono">{value}</span>
    </div>
  )
}
