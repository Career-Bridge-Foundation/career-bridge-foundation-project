import React from 'react'

export function Separator({ vertical }: { vertical?: boolean }){
  return vertical ? <div className="w-px bg-border mx-2" /> : <hr className="border-t border-border my-2" />
}
