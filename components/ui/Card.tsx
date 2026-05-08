import React from 'react'
import { cn } from '@/lib/cn'

export function Card({ children, className, header, footer }: { children: React.ReactNode; className?: string; header?: React.ReactNode; footer?: React.ReactNode }){
  return (
    <div className={cn('bg-bg.elevated rounded-lg p-4 shadow-subtle', className)}>
      {header && <div className="mb-3">{header}</div>}
      <div>{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  )
}
