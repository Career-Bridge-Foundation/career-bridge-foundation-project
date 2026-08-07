import React from 'react'

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>){
  return <select className="bg-white text-navy rounded-md px-3 py-2 border border-slate-300" {...props} />
}
