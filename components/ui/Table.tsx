import React from 'react'
import { cn } from '@/lib/cn'

export const Table = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('overflow-x-auto', className)}>
    <table className="w-full table-auto text-sm">{children}</table>
  </div>
)

export const THead = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <thead className={cn('text-navy/70 text-xs uppercase tracking-wider', className)}>
    <tr>{children}</tr>
  </thead>
)

export const TBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <tbody className={cn('text-navy', className)}>{children}</tbody>
)

export const TR = React.forwardRef<
  HTMLTableRowElement,
  { children: React.ReactNode; className?: string; style?: React.CSSProperties }
>(({ children, className, style }, ref) => (
  <tr ref={ref} style={style} className={cn('hover:bg-slate-50', className)}>
    {children}
  </tr>
))
TR.displayName = 'TR'

export const TH = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn('text-left py-3 px-2 border-b border-border', className)}>{children}</th>
)

export const TD = ({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('py-3 px-2 border-b border-border', className)} {...props}>
    {children}
  </td>
)
