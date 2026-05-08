'use client'

import React from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { Prompt } from '@/lib/schemas/simulation-content'
import { ChevronDown, GripVertical } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui'

interface PromptListItemProps {
  prompt: Prompt
  index: number
}

export function PromptListItem({ prompt, index }: PromptListItemProps) {
  const { expandedPromptId, setExpandedPromptId } = useEditorStore()

  const typeColors: Record<string, string> = {
    typed: 'bg-blue-950 text-blue-300',
    url: 'bg-purple-950 text-purple-300',
    either: 'bg-amber-950 text-amber-300',
  }

  return (
    <button
      onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
      className="w-full group"
    >
      <motion.div
        layout
        className="flex items-center gap-3 p-4 bg-bg-elevated/60 border border-border rounded-lg hover:bg-bg-elevated/80 hover:border-border/80 transition-all cursor-pointer"
      >
        <GripVertical size={16} className="text-white/30 group-hover:text-white/50 transition-colors" />
        
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-medium text-white/70">
              {index + 1}.
            </span>
            <span className="text-sm font-semibold text-white truncate">
              {prompt.title || 'Untitled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm" className={typeColors[prompt.type]}>
              {prompt.type}
            </Badge>
            <span className="text-xs text-white/40">
              {prompt.guidance.length} guidance{prompt.guidance.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-white/40">
              {prompt.minWords} words min
            </span>
          </div>
        </div>

        <motion.div
          animate={{ rotate: expandedPromptId === prompt.id ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={16} className="text-white/50" />
        </motion.div>
      </motion.div>
    </button>
  )
}
