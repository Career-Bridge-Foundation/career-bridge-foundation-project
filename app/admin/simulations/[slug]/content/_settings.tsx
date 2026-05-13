'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { Card, Button } from '@/components/ui'
import { Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface SettingsTabProps {
  slug?: string
}

export function SettingsTab({ slug }: SettingsTabProps) {
  const { content, updateContent } = useEditorStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteSlugInput, setDeleteSlugInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  if (!content) return null

  const handleSimRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateContent({ sim_role: e.target.value })
  }

  const handleDeleteSimulation = async () => {
    if (deleteSlugInput !== slug) {
      alert('Slug does not match')
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/simulations/${slug}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete simulation')
      }

      router.push('/admin/simulations')
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete simulation')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-8 space-y-6">
      {/* Simulation Role */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Simulation Role</h3>
          <div>
            <label className="text-xs font-medium text-slate-500/70 mb-2 block">
              Role the user will take
            </label>
            <input
              type="text"
              value={content.sim_role || ''}
              onChange={handleSimRoleChange}
              placeholder="e.g., Product Manager, Marketing Director..."
              className="w-full bg-white border border-border rounded-lg px-4 py-2.5 text-slate-800 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-900/50 bg-red-950/10">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>
          <p className="text-xs text-red-700/40">
            Permanently delete this simulation and all its data. This action cannot be undone.
          </p>
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="destructive"
            size="default"
            leftIcon={<Trash2 size={16} />}
          >
            Delete Simulation
          </Button>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-elevated border border-border rounded-xl p-6 max-w-md space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Delete Simulation?</h2>
            <p className="text-sm text-white/70">
              This action is permanent and cannot be undone. Please type the slug to confirm:
            </p>
            <p className="text-xs font-mono text-white/50 bg-bg rounded px-3 py-2 border border-border/50">
              {slug}
            </p>
            <input
              type="text"
              value={deleteSlugInput}
              onChange={(e) => setDeleteSlugInput(e.target.value)}
              placeholder="Type slug to confirm"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleDeleteSimulation}
                disabled={deleteSlugInput !== slug || isDeleting}
                variant="destructive"
                size="default"
                className="flex-1"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="secondary"
                size="default"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
