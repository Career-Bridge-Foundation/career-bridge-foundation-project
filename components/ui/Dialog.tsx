'use client'
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type DialogProps = { open: boolean; onClose: () => void; children: React.ReactNode }

export function Dialog({ open, onClose, children }: DialogProps){
  const ref = useRef<HTMLDivElement|null>(null)
  useEffect(()=>{
    function onKey(e: KeyboardEvent){ if(e.key==='Escape') onClose() }
    if(open) document.addEventListener('keydown', onKey)
    return ()=> document.removeEventListener('keydown', onKey)
  },[open,onClose])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 overflow-y-auto" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          {/* Backdrop — fixed so it covers the viewport even when modal content scrolls */}
          <motion.div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div ref={ref} className="relative z-10 w-full max-w-lg" initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.98}} transition={{duration:0.18}}>
              <div className="bg-white rounded-xl shadow-xl p-6">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AlertDialog(props: DialogProps){ return <Dialog {...props} /> }
