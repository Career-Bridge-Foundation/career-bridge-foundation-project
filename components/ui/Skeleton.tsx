import React from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md animate-pulse',
        'bg-gradient-to-r from-[#003359]/[0.04] via-[#003359]/[0.07] to-[#003359]/[0.04]',
        'h-4 w-full',
        className
      )}
    />
  )
}
