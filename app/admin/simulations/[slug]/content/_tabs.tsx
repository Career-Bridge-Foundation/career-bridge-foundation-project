'use client'

import React from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { motion } from 'framer-motion'

type TabKey = 'overview' | 'prompts' | 'settings' | 'rubric'

interface Tab {
  key: TabKey
  label: string
  icon: string
}

const TABS: Tab[] = [
  { key: 'overview', label: 'Overview', icon: '📋' },
  { key: 'prompts', label: 'Prompts', icon: '💬' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'rubric', label: 'Rubric', icon: '📝' },
]

export function EditorTabs() {
  const { activeTab, setActiveTab } = useEditorStore()

  return (
    <div className="border-b border-border">
      <div className="max-w-6xl mx-auto px-8 flex gap-8">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-blue-400'
                : 'text-grey-500/50 hover:text-grey-500/70'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>{tab.icon}</span>
              {tab.label}
            </span>
            {activeTab === tab.key && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
