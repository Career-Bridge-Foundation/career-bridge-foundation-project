'use client'
import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'

export function DropdownMenu({ trigger, children, align='start'}: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start'|'end' }){
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement|null>(null)
  useEffect(()=>{
    function onDoc(e: MouseEvent){ if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', onDoc)
    return ()=> document.removeEventListener('click', onDoc)
  },[])

  return (
    <div className="relative inline-block z-100" ref={ref}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(v => !v)
          }
          if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      >
        {trigger}
      </div>
      {open && <div className={cn('absolute mt-2 min-w-[160px] bg-white rounded-md p-2 shadow-lg border border-slate-200', align==='end'?'right-0':'left-0')}>{children}</div>}
    </div>
  )
}
