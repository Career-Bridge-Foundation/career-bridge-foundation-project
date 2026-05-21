import { create } from 'zustand'
import { SimulationContent, Prompt } from '@/lib/schemas/simulation-content'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface EditorStore {
  // Content state
  content: SimulationContent | null
  original: SimulationContent | null
  isDirty: boolean

  // UI state
  saveStatus: SaveStatus
  errorMessage: string | null
  activeTab: 'overview' | 'prompts' | 'settings' | 'rubric' | 'preview'
  expandedPromptId: string | number | null

  // Actions
  setContent: (content: SimulationContent) => void
  setOriginal: (content: SimulationContent) => void
  updateContent: (updates: Partial<SimulationContent>) => void
  updatePrompt: (id: string | number, updates: Partial<Prompt>) => void
  addPrompt: (prompt: Prompt) => void
  deletePrompt: (id: string | number) => void
  reorderPrompts: (newOrder: Prompt[]) => void

  // UI actions
  setSaveStatus: (status: SaveStatus) => void
  setErrorMessage: (message: string | null) => void
  setActiveTab: (tab: 'overview' | 'prompts' | 'settings' | 'rubric' | 'preview') => void
  setExpandedPromptId: (id: string | number | null) => void

  // Reset
  reset: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  content: null,
  original: null,
  isDirty: false,
  saveStatus: 'idle',
  errorMessage: null,
  activeTab: 'overview',
  expandedPromptId: null,

  setContent: (content) =>
    set((state) => ({
      content,
      isDirty: JSON.stringify(content) !== JSON.stringify(state.original),
    })),

  setOriginal: (original) =>
    set({
      original,
      content: structuredClone(original),
      isDirty: false,
    }),

  updateContent: (updates) =>
    set((state) => {
      if (!state.content) return {}
      const newContent = { ...state.content, ...updates }
      return {
        content: newContent,
        isDirty: JSON.stringify(newContent) !== JSON.stringify(state.original),
      }
    }),

  updatePrompt: (id, updates) =>
    set((state) => {
      if (!state.content) return {}
      const newPrompts = state.content.prompts.map((p) =>
        String(p.id) === String(id) ? { ...p, ...updates } : p
      )
      const newContent = { ...state.content, prompts: newPrompts }
      return {
        content: newContent,
        isDirty: JSON.stringify(newContent) !== JSON.stringify(state.original),
      }
    }),

  addPrompt: (prompt) =>
    set((state) => {
      if (!state.content) return {}
      const newPrompts = [...state.content.prompts, prompt]
      const newTimeRemaining = [
        ...state.content.time_remaining,
        Math.max(state.content.time_remaining[state.content.time_remaining.length - 1] - 8 || 5, 5),
      ]
      const newContent = {
        ...state.content,
        prompts: newPrompts,
        time_remaining: newTimeRemaining,
      }
      return {
        content: newContent,
        isDirty: true,
      }
    }),

  deletePrompt: (id) =>
    set((state) => {
      if (!state.content) return {}
      const idx = state.content.prompts.findIndex((p) => String(p.id) === String(id))
      if (idx === -1) return {}
      const newPrompts = state.content.prompts.filter((p) => String(p.id) !== String(id))
      const newTimeRemaining = state.content.time_remaining.filter((_, i) => i !== idx)
      const newContent = {
        ...state.content,
        prompts: newPrompts,
        time_remaining: newTimeRemaining,
      }
      return {
        content: newContent,
        isDirty: true,
      }
    }),

  reorderPrompts: (newOrder) =>
    set((state) => {
      if (!state.content) return {}
      const timeMap = new Map(
        state.content.prompts.map((p, i) => [String(p.id), state.content!.time_remaining[i]])
      )
      const newTimeRemaining = newOrder.map((p) => timeMap.get(String(p.id)) || 5)
      const newContent = {
        ...state.content,
        prompts: newOrder,
        time_remaining: newTimeRemaining,
      }
      return {
        content: newContent,
        isDirty: true,
      }
    }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setExpandedPromptId: (expandedPromptId) => set({ expandedPromptId }),

  reset: () =>
    set({
      content: null,
      original: null,
      isDirty: false,
      saveStatus: 'idle',
      errorMessage: null,
      activeTab: 'overview',
      expandedPromptId: null,
    }),
}))
