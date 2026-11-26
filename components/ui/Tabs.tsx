import React from 'react'
import { cn } from '@/lib/cn'

// Shared so tab-styled <Link>s (tabs that navigate to another page) match <Tab> buttons.
// -mb-px lets each tab's bottom border sit on top of the TabList's baseline.
export function tabClassName(active?: boolean) {
  return cn(
    '-mb-px px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
    active
      ? 'border-teal text-navy'
      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
  )
}

export function Tabs({ children }: { children: React.ReactNode }){ return <div>{children}</div> }
export function TabList({ children }: { children: React.ReactNode }){
  return <div role="tablist" className="flex gap-1 border-b border-slate-200">{children}</div>
}
export function Tab({ active, onClick, children }: { id: string; active?: boolean; onClick?: ()=>void; children: React.ReactNode }){
  return (
    <button type="button" role="tab" aria-selected={!!active} onClick={onClick} className={tabClassName(active)}>
      {children}
    </button>
  )
}
export function TabPanel({ children, hidden }: { children: React.ReactNode; hidden?: boolean }){ return <div hidden={hidden}>{children}</div> }
