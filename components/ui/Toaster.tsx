"use client"
import { Toaster as SonnerToaster, toast } from 'sonner'
import React from 'react'

export function Toaster(){
  return <SonnerToaster position="top-right" toastOptions={{className: 'bg-slate-50 text-navy rounded-md p-3 shadow-md border border-slate-200'}} />
}

export { toast }
