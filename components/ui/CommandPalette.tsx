'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Plus, FileText, Settings, LogOut, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  simulations?: Array<{ slug: string; title: string; company: string }>
}

export function CommandPalette({ open, onClose, simulations = [] }: CommandPaletteProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  // Reset search on open
  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  // Esc handled inside Command itself; also handle via AnimatePresence exit
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function go(path: string) {
    router.push(path)
    onClose()
  }

  async function logout() {
    onClose()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 w-full max-w-lg mx-4"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <Command
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid rgba(0,51,89,0.15)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
              }}
              loop
            >
              {/* Search input */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: '1px solid rgba(0,51,89,0.1)' }}
              >
                <Search size={15} style={{ color: 'rgba(0,51,89,0.4)', flexShrink: 0 }} />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command or search…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#003359]/40"
                  style={{ color: 'rgba(0,51,89,0.9)' }}
                />
                <kbd
                  className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{
                    color: 'rgba(0,51,89,0.4)',
                    backgroundColor: 'rgba(0,51,89,0.06)',
                    border: '1px solid rgba(0,51,89,0.1)',
                  }}
                >
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="px-4 py-8 text-sm text-center" style={{ color: 'rgba(0,51,89,0.4)' }}>
                  No results found.
                </Command.Empty>

                {/* Navigation */}
                <Command.Group
                  heading="Navigation"
                  className="mb-1"
                >
                  <PaletteItem icon={<LayoutDashboard size={14} />} onSelect={() => go('/admin')}>
                    Go to Dashboard
                  </PaletteItem>
                  <PaletteItem icon={<FileText size={14} />} onSelect={() => go('/admin/simulations')}>
                    Go to Simulations
                  </PaletteItem>
                  <PaletteItem icon={<Settings size={14} />} onSelect={() => go('/admin/settings')}>
                    Go to Settings
                  </PaletteItem>
                </Command.Group>

                {/* Actions */}
                <Command.Group heading="Actions" className="mb-1">
                  <PaletteItem icon={<Plus size={14} />} onSelect={() => go('/admin/simulations/new')}>
                    Create new simulation
                  </PaletteItem>
                  <PaletteItem icon={<LogOut size={14} />} onSelect={logout} danger>
                    Sign out
                  </PaletteItem>
                </Command.Group>

                {/* Simulations */}
                {simulations.length > 0 && (
                  <Command.Group heading="Simulations">
                    {simulations.map(sim => (
                      <PaletteItem
                        key={sim.slug}
                        icon={<FileText size={14} />}
                        onSelect={() => go(`/admin/simulations/${sim.slug}`)}
                      >
                        <span>{sim.title}</span>
                        <span style={{ color: 'rgba(0,51,89,0.4)', marginLeft: 6, fontSize: 12 }}>
                          {sim.company}
                        </span>
                      </PaletteItem>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PaletteItem({
  icon,
  children,
  onSelect,
  danger,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onSelect: () => void
  danger?: boolean
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm cursor-pointer transition-colors"
      style={
        {
          color: danger ? '#dc2626' : 'rgba(0,51,89,0.8)',
          '--cmdk-selected-bg': danger ? 'rgba(220,38,38,0.08)' : 'rgba(0,51,89,0.06)',
        } as React.CSSProperties
      }
    >
      <span style={{ color: danger ? '#dc2626' : 'rgba(0,51,89,0.4)', flexShrink: 0 }}>
        {icon}
      </span>
      <span className="flex items-center">{children}</span>
    </Command.Item>
  )
}
