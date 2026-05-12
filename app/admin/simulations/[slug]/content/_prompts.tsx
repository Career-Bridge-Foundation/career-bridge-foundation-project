'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { Prompt } from '@/lib/schemas/simulation-content'
import { PromptCard } from './prompts/_prompt-card'
import { PromptListItem } from './prompts/_prompt-list-item'
import { Button } from '@/components/ui'
import { Plus, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export function PromptsTab() {
  const { content, addPrompt, updateContent, expandedPromptId, setExpandedPromptId } = useEditorStore()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Keep local render list in sync with store, since PromptCard updates the store directly.
  useEffect(() => {
    setPrompts(content?.prompts ?? [])
  }, [content?.prompts])

  // Fetch prompts from database
  useEffect(() => {
    async function fetchPrompts() {
      // Only fetch when we have the simulation id
      console.log("Content ID: ", content?.id)
      if (!content?.id) return
      
      try {
        setLoading(true)
        const supabase = createClient()
        const { data: simulation_prompts, error: dbError } = await supabase
        .from('simulation_prompts')
        .select('*')
        .eq('simulation_id', content.id)
        .order('id', { ascending: true })
        
        // Log both data and any DB error for diagnostics
        console.log('Supabase result:', { data: simulation_prompts, dbError })
        
        if (dbError) {
          console.error('Error fetching prompts:', dbError)
          setError('Failed to load prompts')
          return
        }
        
        // Transform snake_case from DB to camelCase for schema
        const transformed = (simulation_prompts || []).map((p: any) => ({
          id: String(p.id),
          type: p.type,
          title: p.title,
          question: p.question,
          guidance: p.guidance || [],
          minWords: p.min_words || 0,
        }))
        updateContent({ prompts: transformed })
      } catch (err) {
        console.error('Error fetching prompts:', err)
        setError('Failed to load prompts')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPrompts()
  }, [content?.id, updateContent])

  const handleAddPrompt = useCallback(() => {
    if (!content?.id) return
    const newId = crypto.randomUUID()
    const newPrompt: Prompt = {
      id: newId,
      type: 'typed',
      title: `Prompt ${prompts.length + 1}`,
      question: '',
      guidance: [],
      minWords: 0,
    }
    addPrompt(newPrompt)
    setExpandedPromptId(newId)
  }, [prompts, setExpandedPromptId, content?.id, addPrompt])

  if (!content?.id) {
    return (
      <div className="max-w-6xl mx-auto px-8 pb-24">
        <div className="flex items-center gap-3 text-slate-600">
          <AlertCircle size={20} />
          <p>Unable to load prompts. Simulation data not found.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-8 pb-24">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-8 pb-24">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (prompts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-8 pb-24">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="text-center">
            <p className="text-slate-600 mb-2">No prompts yet</p>
            <p className="text-sm text-slate-500 mb-6">Create your first prompt to get started</p>
          </div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={handleAddPrompt}
              variant="primary"
              size="default"
              leftIcon={<Plus size={16} />}
            >
              Create First Prompt
            </Button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 pb-24 space-y-6">    
      {/* Prompts list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {prompts.map((prompt, idx) => (
            <motion.div
              key={prompt.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {expandedPromptId === prompt.id ? (
                <PromptCard prompt={prompt} index={idx} />
              ) : (
                <PromptListItem prompt={prompt} index={idx} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add prompt button */}
      <div className="flex justify-center pt-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={handleAddPrompt}
            variant="primary"
            size="default"
            leftIcon={<Plus size={16} />}
          >
            Add Prompt
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

