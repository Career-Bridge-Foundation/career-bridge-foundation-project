import React from 'react'

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }){
  return <label htmlFor={htmlFor} className={"text-[#003359] text-sm font-medium "+(className||"")}>{children}</label>
}
