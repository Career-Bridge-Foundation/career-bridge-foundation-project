import React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import packageJson from '@/package.json'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/permissions'

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '')}.supabase.co`.replace(
      /^https?:\/\//,
      ''
    )
  : null

export default async function SettingsPage() {
  try {
    await requireAdmin()
  } catch {
    redirect('/auth/login')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm mt-1 text-slate-600">Environment and system configuration</p>
      </div>

      {/* Team & access */}
      <section className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Team &amp; access</h2>
          <p className="text-xs text-slate-600 mt-1">
            Manage admins, reviewers, and their permissions from the Team page.
          </p>
        </div>
        <div className="px-6 py-4">
          <Link
            href="/admin/team"
            className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 transition-colors font-medium"
          >
            Go to Team management
            <ExternalLink size={12} />
          </Link>
        </div>
      </section>

      {/* API Documentation */}
      <section className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">API Documentation</h2>
          <p className="text-xs text-slate-600 mt-1">
            OpenAPI 3.0 specification for all admin and reviewer endpoints.
          </p>
        </div>
        <div className="divide-y divide-slate-200">
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">Swagger UI</span>
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 transition-colors font-medium"
            >
              Open docs
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">JSON spec</span>
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 transition-colors font-medium"
            >
              /api/docs
              <ExternalLink size={12} />
            </a>
          </div>
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
          <InfoRow label="Project URL" value={SUPABASE_PROJECT_URL ?? '—'} />
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
