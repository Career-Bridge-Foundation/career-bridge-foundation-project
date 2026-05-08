'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'

export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
}: {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-5">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <AlertTriangle size={20} style={{ color: '#dc2626' }} />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {error.message || 'An unexpected error occurred. You can try again or return to the dashboard.'}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono mt-2">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Button variant="secondary" size="sm" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
