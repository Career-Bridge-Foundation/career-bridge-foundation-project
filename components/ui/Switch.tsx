import React from 'react'

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v:boolean)=>void }){
  return (
    <button role="switch" aria-checked={checked} onClick={()=>onChange(!checked)} className={"w-10 h-6 rounded-full p-1 "+(checked? 'bg-accent':'bg-bg.surface')}>
      <span className={"block w-4 h-4 bg-white rounded-full transform "+(checked? 'translate-x-4':'')}></span>
    </button>
  )
}
