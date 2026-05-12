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
    typed: 'bg-blue-100 text-blue-700',
    url: 'bg-purple-100 text-purple-700',
    either: 'bg-amber-100 text-amber-700',
  }

  return (
    <button
      onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
      className="w-full group"
    >
      <motion.div
        layout
        className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer"
      >
        <GripVertical size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
        
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-medium text-slate-600">
              {index + 1}.
            </span>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {prompt.title || 'Untitled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm" className={typeColors[prompt.type]}>
              {prompt.type}
            </Badge>
            <span className="text-xs text-slate-500">
              {prompt.guidance.length} guidance{prompt.guidance.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-500">
              {prompt.minWords} words min
            </span>
          </div>
        </div>

        <motion.div
          animate={{ rotate: expandedPromptId === prompt.id ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={16} className="text-slate-400" />
        </motion.div>
      </motion.div>
    </button>
  )
}
