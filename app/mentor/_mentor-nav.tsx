'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConsoleSignOutButton } from '@/components/ui/ConsoleSignOutButton'

export function MentorNav() {
  const pathname = usePathname()
  const active = pathname === '/mentor'
  return (
    <nav className="space-y-1">
      <Link
        href="/mentor"
        className={`block rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        Candidates
      </Link>
      <ConsoleSignOutButton />
    </nav>
  )
}
