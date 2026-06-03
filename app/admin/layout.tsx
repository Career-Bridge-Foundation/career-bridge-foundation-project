import React from 'react'
import '@/app/globals.css'
import { Sidebar } from './_sidebar'
import { AdminPageTransition } from './_page-transition'
import { AdminBreadcrumb } from './_breadcrumb'
import { Toaster } from '@/components/ui'
import { CommandPaletteProvider } from './_command-palette-provider'
import { getCurrentUserRole } from '@/lib/auth/permissions'

export const metadata = { title: 'Admin — Evidentize' }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserRole()
  const role = ctx?.role ?? 'admin'
  const email = ctx?.email ?? null

  return (
    <CommandPaletteProvider>
      <div className="min-h-screen flex bg-slate-50">
        <Sidebar role={role} email={email} />

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* Top bar */}
          <header className="h-14 flex items-center px-8 gap-2 shrink-0 bg-white border-b border-slate-200">
            <AdminBreadcrumb />

            <div className="ml-auto flex items-center gap-3">
              {/* Cmd+K hint */}
              <div className="hidden sm:flex items-center gap-1 text-xs rounded-md px-2 py-1 text-[#003359]/40 bg-[#003359]/5 border border-[#003359]/10">
                <kbd className="font-mono">⌘</kbd>
                <kbd className="font-mono">K</kbd>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-[#003359]/60">
                <span className="w-2 h-2 rounded-full bg-teal" />
                Evidentize
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-8 py-8 overflow-auto">
            <AdminPageTransition>{children}</AdminPageTransition>
          </main>
        </div>
        <Toaster />
      </div>
    </CommandPaletteProvider>
  )
}
