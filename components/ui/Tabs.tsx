import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export function Tabs({ children }: { children: React.ReactNode }){ return <div>{children}</div> }
export function TabList({ children }: { children: React.ReactNode }){ return <div className="flex gap-2">{children}</div> }
export function Tab({ id, active, onClick, children }: { id: string; active?: boolean; onClick?: ()=>void; children: React.ReactNode }){
  return (
    <button onClick={onClick} className={cn('px-3 py-2 text-sm rounded-md', active? 'text-navy':'text-navy/70')}>{children}{active && <motion.div layoutId="tab-underline" className="h-0.5 bg-accent mt-2" />}</button>
  )
}
export function TabPanel({ children, hidden }: { children: React.ReactNode; hidden?: boolean }){ return <div hidden={hidden}>{children}</div> }
