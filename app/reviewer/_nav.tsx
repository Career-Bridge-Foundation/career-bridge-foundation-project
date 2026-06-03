'use client'
import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ReviewerNav() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/evidentize-icon.png" alt="Evidentize" width={28} height={28} className="rounded" />
          <div>
            <span className="text-slate-900 font-bold text-sm">Evidentize</span>
            <span className="ml-2 text-xs font-semibold tracking-widest uppercase text-teal">
              Reviewer
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {email && (
            <span className="text-xs text-slate-500 hidden sm:block">{email}</span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
