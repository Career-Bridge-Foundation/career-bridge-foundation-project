import React from 'react'
import { ReviewerNav } from './_nav'
import { Toaster } from '@/components/ui/Toaster'

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ReviewerNav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
      <Toaster />
    </div>
  )
}
