'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { Prompt } from '@/lib/schemas/simulation-content'
import { Card, Button, Badge } from '@/components/ui'
import { Trash2, Copy, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'

interface PromptCardProps {
  prompt: Prompt
  index: number
}

export function PromptCard({ prompt, index }: PromptCardProps) {
  const { updatePrompt, deletePrompt, setExpandedPromptId } = useEditorStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePrompt(prompt.id, { title: e.target.value })
  }

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updatePrompt(prompt.id, { question: e.target.value })
  }

  const handleTypeChange = (newType: 'typed' | 'url' | 'either') => {
    updatePrompt(prompt.id, { type: newType })
  }

  const handleMinWordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePrompt(prompt.id, { minWords: Math.max(0, parseInt(e.target.value) || 0) })
  }

  const handleGuidanceChange = (idx: number, value: string) => {
    const newGuidance = [...prompt.guidance]
    newGuidance[idx] = value
    updatePrompt(prompt.id, { guidance: newGuidance })
  }

  const handleAddGuidance = () => {
    updatePrompt(prompt.id, { guidance: [...prompt.guidance, ''] })
  }

  const handleRemoveGuidance = (idx: number) => {
    updatePrompt(prompt.id, { 
      guidance: prompt.guidance.filter((_, i) => i !== idx) 
    })
  }

  const handleDelete = () => {
    deletePrompt(prompt.id)
  }

  const handleDuplicate = () => {
    // Duplicate is handled by parent, just need to signal
    // For now, this is a placeholder
  }

  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    typed:  { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
    url:    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    either: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700' },
  }

  const colors = typeColors[prompt.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`${colors.bg} border-2 ${colors.border}`}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-700">Prompt {index + 1}</span>
              <Badge variant="neutral" size="sm" className={colors.text}>
                {prompt.type}
              </Badge>
            </div>
            <button
              onClick={() => setExpandedPromptId(null)}
              className="text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ChevronUp size={18} />
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-2 block">
              Title
            </label>
            <input
              type="text"
              value={prompt.title}
              onChange={handleTitleChange}
              placeholder="Prompt title..."
              className="w-full bg-white border border-border rounded-lg px-4 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-2 block">
              Type
            </label>
            <div className="flex gap-2">
              {(['typed', 'url', 'either'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    prompt.type === type
                      ? 'bg-accent text-grey-500'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-2 block">
              Question
            </label>
            <textarea
              value={prompt.question}
              onChange={handleQuestionChange}
              placeholder="What should the user do?"
              className="w-full h-24 bg-white border border-border rounded-lg px-4 py-3 text-zinc-900 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <div className="text-xs text-zinc-500 mt-1">
              {prompt.question.length} characters
            </div>
          </div>

          {/* Guidance */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-3 block">
              Guidance Bullets
            </label>
            <div className="space-y-2">
              {prompt.guidance.map((bullet, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => handleGuidanceChange(idx, e.target.value)}
                    placeholder={`Guidance ${idx + 1}...`}
                    className="flex-1 bg-white border border-border rounded-lg px-3 py-2 text-zinc-900 placeholder:text-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <button
                    onClick={() => handleRemoveGuidance(idx)}
                    className="text-zinc-500 hover:text-red-600 transition-colors px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddGuidance}
              className="text-xs text-accent hover:text-accent/80 transition-colors mt-3 font-medium"
            >
              + Add guidance bullet
            </button>
          </div>

          {/* Min Words */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-2 block">
              Minimum Words
            </label>
            <input
              type="number"
              min="0"
              value={prompt.minWords}
              onChange={handleMinWordsChange}
              className="w-full bg-white border border-border rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex gap-2">
              <Button
                onClick={handleDuplicate}
                variant="ghost"
                size="sm"
                leftIcon={<Copy size={14} />}
              >
                Duplicate
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3"
            >
              <p className="text-sm text-red-700">
                Are you sure you want to delete this prompt? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  size="sm"
                >
                  Delete
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="secondary"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}