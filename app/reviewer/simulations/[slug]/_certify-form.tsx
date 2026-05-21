'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react'

interface Props {
  slug: string
  currentStatus: 'pending' | 'certified' | 'rejected'
  currentNotes: string
}

export function CertifyForm({ slug, currentStatus, currentNotes }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState(currentNotes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(status: 'certified' | 'rejected' | 'pending') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reviewer/simulations/${slug}/certify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, notes }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Something went wrong')
      }
      if (status === 'certified' || status === 'rejected') {
        router.push('/reviewer')
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Add certification notes or feedback for the admin team…"
          className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => submit('certified')}
          disabled={loading || currentStatus === 'certified'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircle size={14} />
          Approve
        </button>
        <button
          onClick={() => submit('rejected')}
          disabled={loading || currentStatus === 'rejected'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <XCircle size={14} />
          Reject
        </button>
        {currentStatus !== 'pending' && (
          <button
            onClick={() => submit('pending')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw size={14} />
            Reset to pending
          </button>
        )}
      </div>
    </div>
  )
}
