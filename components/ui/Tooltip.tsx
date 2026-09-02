import React from 'react'

export function Tooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }){
  return (
    <span className="relative group inline-block">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 -translate-y-2 hidden group-hover:inline-block bg-slate-100 text-navy text-sm px-2 py-1 rounded-md">{content}</span>
    </span>
  )
}
