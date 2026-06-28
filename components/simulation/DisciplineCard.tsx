'use client'

import { useState } from 'react'
import type { Discipline } from '@/types'
import { WaitlistModal } from '@/components/simulation/WaitlistModal'

interface DisciplineCardProps {
  discipline: Discipline
}

export function DisciplineCard({ discipline: d }: DisciplineCardProps) {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  return (
    <div className="discipline-card bg-white p-8 flex flex-col">
      {/* Name + description */}
      <h3 className="text-lg font-bold text-navy leading-[1.3] mb-3">{d.name}</h3>
      <p className="text-sm text-[#555] leading-[1.75] flex-1">{d.description}</p>

      {/* Divider + bottom row */}
      <div className="mt-7 pt-5 flex items-center justify-between border-t border-border-light">
        {d.status === 'available' ? (
          <>
            <span className="text-sm text-[#999]">{d.count}</span>
            <a href={d.href} className="text-sm font-medium text-teal hover:underline">
              Start Practicing →
            </a>
          </>
        ) : (
          <>
            <span className="text-sm text-[#ccc]">Coming Soon</span>
            <button
              onClick={() => setWaitlistOpen(true)}
              className="text-sm font-medium text-teal hover:underline cursor-pointer"
            >
              Join The Waitlist →
            </button>
          </>
        )}
      </div>

      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        initialDiscipline={d.name}
      />
    </div>
  )
}
