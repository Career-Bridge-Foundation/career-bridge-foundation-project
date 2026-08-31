'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Users,
  Building2,
  ScrollText,
  Users2,
  ChevronRight,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type StaffRole = 'admin' | 'super_admin' | 'content_developer' | string

const ALL_NAV = [
  {
    href: '/admin',
    label: 'Overview',
    icon: LayoutDashboard,
    exact: true,
    roles: ['admin', 'super_admin'],
  },
  {
    href: '/admin/simulations',
    label: 'Simulations',
    icon: FileText,
    exact: false,
    roles: ['admin', 'super_admin', 'content_developer'],
  },
  {
    href: '/admin/team',
    label: 'Team',
    icon: Users,
    exact: false,
    roles: ['admin', 'super_admin'],
  },
  {
    href: '/admin/partners',
    label: 'Partners',
    icon: Building2,
    exact: false,
    roles: ['super_admin'],
  },
  {
    href: '/admin/terms',
    label: 'Terms',
    icon: ScrollText,
    exact: false,
    roles: ['super_admin'],
  },
  {
    href: '/admin/community',
    label: 'Community',
    icon: Users2,
    exact: false,
    roles: ['super_admin'],
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: Settings,
    exact: false,
    roles: ['admin', 'super_admin'],
  },
]

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  content_developer: 'Content Dev',
}

type Props = {
  role: StaffRole
  email: string | null
  onClose?: () => void
}

export function Sidebar({ role, email, onClose }: Props) {
  const path = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const nav = ALL_NAV.filter(item => item.roles.includes(role))
  const initial = email ? email[0].toUpperCase() : 'A'

  async function handleLogout() {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      className="w-60 h-screen flex flex-col shrink-0 overflow-y-auto"
      style={{ backgroundColor: '#003359' }}
    >
      {/* Brand */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Image src="/evidentize-icon.png" alt="Evidentize" width={20} height={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm tracking-tight leading-none mb-1">
              Evidentize
            </div>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(77,197,210,0.18)',
                color: '#4DC5D2',
                letterSpacing: '0.04em',
              }}
            >
              {ROLE_LABEL[role] ?? 'Admin'}
            </span>
          </div>

          {/* Close button — mobile only */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md ml-2 shrink-0 transition-colors"
              style={{ color: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(255,255,255,0.06)' }}
              aria-label="Close navigation"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5">
        <div
          className="px-2 mb-3 text-[10px] font-bold uppercase"
          style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em' }}
        >
          Menu
        </div>
        <div className="space-y-0.5">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.52)',
                  borderLeft: `2px solid ${active ? '#4DC5D2' : 'transparent'}`,
                }}
              >
                <Icon
                  size={16}
                  style={{
                    color: active ? '#4DC5D2' : 'rgba(255,255,255,0.38)',
                    flexShrink: 0,
                  }}
                />
                <span className="flex-1">{label}</span>
                {active && (
                  <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.28)' }} />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User area */}
      <div
        className="px-4 py-4"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backgroundColor: 'rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{
              backgroundColor: 'rgba(77,197,210,0.18)',
              border: '1px solid rgba(77,197,210,0.35)',
              color: '#4DC5D2',
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {ROLE_LABEL[role] ?? 'Admin'}
            </div>
            <div
              className="text-[11px] truncate"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {email ?? '…'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.15)'
            ;(e.currentTarget as HTMLElement).style.color = '#fca5a5'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
          }}
        >
          <LogOut size={13} />
          {isLoggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
