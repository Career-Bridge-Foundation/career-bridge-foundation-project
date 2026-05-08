import React from 'react'
import { cn } from '@/lib/cn'

type Variant = 'neutral'|'success'|'warning'|'danger'|'accent'

export function Badge({ children, variant='neutral', size='md', className }: { children: React.ReactNode; variant?: Variant; size?: 'sm'|'md'; className?: string }){
  const v = {
    neutral: 'bg-slate-100 text-[#003359]',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    accent: 'bg-accent text-white'
  }[variant]
  const s = size === 'sm' ? 'text-sm px-2 py-0.5 rounded-full' : 'text-sm px-3 py-1 rounded-md'
  return <span className={cn(v, s, className)}>{children}</span>
}
