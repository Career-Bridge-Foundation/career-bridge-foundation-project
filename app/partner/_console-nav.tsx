'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConsoleSignOutButton } from '@/components/ui/ConsoleSignOutButton'

const NAV: { label: string; href?: string; live: boolean }[] = [
  { label: 'Candidates', href: '/partner', live: true },
  { label: 'Usage', href: '/partner/usage', live: true },
  { label: 'Analytics', href: '/partner/analytics', live: true },
  { label: 'Team', href: '/partner/team', live: true },
  { label: 'Branding', href: '/partner/branding', live: true },
]

export function ConsoleNav() {
  const pathname = usePathname()
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        if (!item.live) {
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="flex cursor-not-allowed select-none items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-400"
            >
              {item.label}
              <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
            </span>
          )
        }
        // Candidates owns /partner AND the /partner/candidates detail routes.
        const active =
          item.href === '/partner'
            ? pathname === '/partner' || pathname.startsWith('/partner/candidates')
            : pathname.startsWith(item.href!)
        return (
          <Link
            key={item.label}
            href={item.href!}
            className={`block rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {item.label}
          </Link>
        )
      })}
      <ConsoleSignOutButton />
    </nav>
  )
}
