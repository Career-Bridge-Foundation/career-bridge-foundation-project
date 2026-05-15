'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileText, Settings, LogOut, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const NAV = [
  { href: '/admin',             label: 'Dashboard',   icon: LayoutDashboard, exact: true  },
  { href: '/admin/simulations', label: 'Simulations', icon: FileText,        exact: false },
  { href: '/admin/team',        label: 'Team',        icon: Users,           exact: false },
  { href: '/admin/settings',    label: 'Settings',    icon: Settings,        exact: false },
]

export function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const initial = email ? email[0].toUpperCase() : 'A'

  return (
    <aside
      className="w-64 min-h-screen flex flex-col shrink-0 bg-white border-r border-slate-200"
    >
      {/* Brand */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 ">
            <Image
              src="/logo.png"            
              alt='Logo'
              width={45}
              height={45}
            />
          </div>
          <div>
            <div className="text-slate-900 font-bold text-sm tracking-tight leading-none">
              CareerBridge
            </div>
            <div className="text-xs font-semibold tracking-widest uppercase mt-0.5 text-{accent-copper}">
              Admin
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
              style={{
                backgroundColor: active ? '#003359/8' : 'transparent',
                color: active ? '#003359' : 'rgb(107, 114, 128)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgb(15, 23, 42)/5'
                  ;(e.currentTarget as HTMLElement).style.color = '#003359'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'rgb(107, 114, 128)'
                }
              }}
            >
              <Icon
                size={16}
                style={{ color: active ? '#0d9488' : 'rgb(156, 163, 175)', flexShrink: 0 }}
              />
              <span className="flex-1">{label}</span>
              {active && (
                <span className="h-4 w-0.5 rounded-full shrink-0 bg-teal" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User area */}
      <div className="px-4 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-teal/10 border border-teal/30 text-teal">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-900 text-xs font-medium truncate">Admin</div>
            <div className="text-xs truncate text-slate-500">
              {email ?? '…'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="transition-colors disabled:opacity-40 text-slate-400 hover:text-slate-600"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
