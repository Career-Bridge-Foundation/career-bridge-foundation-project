import React from 'react'
import { cn } from '@/lib/cn'
import { Label } from './Label'

export function Input({
  id,
  label,
  error,
  helper,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id?: string
  label?: string
  error?: string
  helper?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <input
        id={id}
        className={cn(
          'bg-white text-[#003359] rounded-md px-3 py-2 border border-slate-300 text-sm',
          'placeholder:text-[#003359]/40 transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-white',
          error && 'border-red-500 focus-visible:ring-red-500/50'
        )}
        {...props}
      />
      {helper && <p className="text-[#003359]/60 text-xs">{helper}</p>}
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  )
}
