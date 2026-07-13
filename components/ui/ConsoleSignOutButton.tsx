'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ConsoleSignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="mt-6 flex w-full items-center gap-2 rounded-md border-t border-slate-200 px-3 pt-4 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
    >
      <LogOut size={15} />
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
