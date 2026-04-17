'use client'

import Link from 'next/link'
import { Building2, ChevronRight, Briefcase, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SimulationCardProps } from '@/lib/types'

const DISCIPLINE_COLORS: Record<string, string> = {
  'Product Management': 'border-accent-teal/30 text-accent-teal',
  'Marketing':          'border-accent-teal/30 text-accent-teal',
  'Finance':            'border-accent-teal/30 text-accent-teal',
  'Engineering':        'border-accent-teal/30 text-accent-teal',
  'Design':             'border-accent-teal/30 text-accent-teal',
}

export default function SimulationCard({
  id,
  title,
  discipline,
  company_name,
  industry,
  estimated_minutes,
  candidate_role,

}: SimulationCardProps) {
  const badgeClass =
    DISCIPLINE_COLORS[discipline] ?? 'border-subtle text-cool'

  return (
    <div className="group relative flex flex-col bg-warm-white border border-subtle hover:border-accent-teal transition-all duration-300">

      {/* Top teal accent line */}
      <div className="cb-accent-line w-full" />

      <div className="flex flex-col flex-1 p-6">

        {/* Discipline badge */}
        <span
          className={`inline-flex items-center self-start border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase mb-4 ${badgeClass}`}
        >
          {discipline}
        </span>

        {/* Title */}
        <h3 className="text-lg font-semibold text-ink leading-snug mb-2 group-hover:text-accent-teal transition-colors">
          {title}
        </h3>

        {/* Company · Industry */}
        <div className="flex items-center gap-1.5 text-sm text-cool mb-4">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span>{company_name}</span>
          <span className="text-border">·</span>
          <span>{industry}</span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-auto pt-4 border-t border-subtle">
          <div className="flex items-center gap-1.5 text-xs text-cool">
            <Briefcase className="h-3.5 w-3.5" />
            <span>{candidate_role}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-cool">
            <Clock className="h-3.5 w-3.5" />
            <span>{estimated_minutes}</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <Link href={`/simulate/${id}`} className="block">
          <button className="cb-btn cb-btn-primary-light w-full text-xs group/btn">
            Start Simulation
            <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </Link>
      </div>
    </div>
  )
}
