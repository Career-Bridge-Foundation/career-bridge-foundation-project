'use client'

import React from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { LayoutList, MessageSquare, Settings2, ClipboardCheck, Eye } from 'lucide-react'

type TabKey = 'overview' | 'prompts' | 'settings' | 'rubric' | 'preview'

const TABS: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: 'overview',  label: 'Overview',  Icon: LayoutList      },
  { key: 'prompts',   label: 'Prompts',   Icon: MessageSquare   },
  { key: 'settings',  label: 'Settings',  Icon: Settings2       },
  { key: 'rubric',    label: 'Rubric',    Icon: ClipboardCheck  },
  { key: 'preview',   label: 'Preview',   Icon: Eye             },
]

export function EditorTabs() {
  const { activeTab, setActiveTab } = useEditorStore()

  return (
    <div className="border-b bg-white mt-[30px] px-6" style={{ borderColor: '#d5dce8' }}>
      <div className="flex gap-1">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors"
              style={{
                color: isActive ? '#0d9488' : 'rgba(0,51,89,0.45)',
              }}
            >
              <Icon size={13} />
              {label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: '#0d9488' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
