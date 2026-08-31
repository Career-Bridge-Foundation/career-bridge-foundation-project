import React from 'react'
import { motion } from 'framer-motion'

export function SegmentedControl({ options, value, onChange }: { options: {label:string,value:string}[]; value: string; onChange: (v:string)=>void }){
  return (
    <div className="relative inline-flex bg-slate-100 p-1 rounded-full">
      {options.map(opt=> (
        <button key={opt.value} onClick={()=>onChange(opt.value)} className={"relative z-10 px-3 py-1 rounded-full text-sm "+(opt.value===value? 'text-navy':'text-navy/70')}>{opt.label}
        </button>
      ))}
      <motion.div layoutId="seg-indicator" className="absolute bg-accent rounded-full" style={{width:0, height:0}} />
    </div>
  )
}
