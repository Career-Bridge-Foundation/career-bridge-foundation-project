'use client'

import Link from 'next/link'
import { Building2, ChevronRight, Briefcase, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SimulationCardProps } from '@/lib/types'

const DISCIPLINE_COLORS: Record<string, string> = {
  'Product Management': 'bg-blue-50 text-blue-700 border-blue-200',
  'Marketing': 'bg-purple-50 text-purple-700 border-purple-200',
  'Finance': 'bg-green-50 text-green-700 border-green-200',
  'Engineering': 'bg-orange-50 text-orange-700 border-orange-200',
  'Design': 'bg-pink-50 text-pink-700 border-pink-200',
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
    DISCIPLINE_COLORS[discipline] ?? 'bg-slate-50 text-slate-700 border-slate-200'

  return (
    <div className="group relative flex flex-col bg-white rounded-xl border border-border shadow-sm hover:shadow-md hover:border-brand-primary/30 transition-all duration-200">

      {/* Top accent bar */}
      <div className="h-1 w-full rounded-t-xl bg-brand-primary" />

      <div className="flex flex-col flex-1 p-6">

        {/* Discipline badge */}
        <span
          className={`inline-flex items-center self-start rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-3 ${badgeClass}`}
        >
          {discipline}
        </span>

        {/* Title */}
        <h3 className="text-lg font-semibold text-text-primary leading-snug mb-2 group-hover:text-brand-primary transition-colors">
          {title}
        </h3>

        {/* Company · Industry */}
        <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span>{company_name}</span>
          <span className="text-border">·</span>
          <span>{industry}</span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Briefcase className="h-3.5 w-3.5" />
            <span>{candidate_role}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="h-3.5 w-3.5" />
            <span>{estimated_minutes}</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <Link href={`/simulate/${id}`} className="block">
          <Button className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-medium group/btn">
            Start Simulation
            <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
