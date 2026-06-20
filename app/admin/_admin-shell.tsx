'use client'
import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sidebar } from './_sidebar'
import { AdminBreadcrumb } from './_breadcrumb'
import { AdminPageTransition } from './_page-transition'

type Props = {
  role: string
  email: string | null
  children: React.ReactNode
}

export function AdminShell({ role, email, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar whenever the route changes
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  return (
    <div className="h-screen overflow-hidden flex" style={{ backgroundColor: '#eef2f7' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: slides in on mobile, always visible on lg+ */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={role} email={email} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header
          className="h-14 flex items-center px-4 sm:px-6 lg:px-8 gap-3 shrink-0"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e4eaf3',
            boxShadow: '0 1px 4px rgba(0,51,89,0.05)',
          }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden p-2 -ml-1 rounded-lg transition-colors hover:bg-[#eef2f7]"
            style={{ color: '#003359' }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <AdminBreadcrumb />

          <div className="ml-auto flex items-center gap-2.5">
            {/* Cmd+K hint */}
            <div
              className="hidden sm:flex items-center gap-1 text-xs rounded-md px-2.5 py-1.5 font-mono"
              style={{
                color: 'rgba(0,51,89,0.32)',
                backgroundColor: 'rgba(0,51,89,0.04)',
                border: '1px solid rgba(0,51,89,0.08)',
              }}
            >
              <kbd>⌘</kbd>
              <kbd className="ml-0.5">K</kbd>
            </div>

            {/* Brand chip */}
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-lg"
              style={{
                color: '#4DC5D2',
                backgroundColor: 'rgba(77,197,210,0.08)',
                border: '1px solid rgba(77,197,210,0.18)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4DC5D2' }} />
              <span className="hidden sm:inline">Evidentize</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 overflow-auto">
          <AdminPageTransition>{children}</AdminPageTransition>
        </main>
      </div>
    </div>
  )
}
