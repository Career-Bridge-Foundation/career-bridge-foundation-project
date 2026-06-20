import React from 'react'
import '@/app/globals.css'
import { AdminShell } from './_admin-shell'
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
      <AdminShell role={role} email={email}>
        {children}
      </AdminShell>
      <Toaster />
    </CommandPaletteProvider>
  )
}
