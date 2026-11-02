'use client'

import { Dialog } from '@/components/ui/Dialog'
import { disciplines } from '@/lib/disciplines-data'

const DISCIPLINE_NAME = new Map(disciplines.map((d) => [d.slug, d.name] as const))

/**
 * Shown instead of the Assessment Pack modal when the candidate's programme
 * (the partner that invited them) hasn't granted them this simulation's
 * discipline. Deliberately offers no code entry or purchase — access to a
 * discipline comes from the sponsor, not from the candidate paying.
 */
export function NoAccessModal({
  open,
  onClose,
  simulationTitle,
  discipline,
}: {
  open: boolean
  onClose: () => void
  simulationTitle: string
  discipline?: string | null
}) {
  const disciplineName = discipline ? DISCIPLINE_NAME.get(discipline) ?? discipline : null

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-600">
            No access
          </p>
          <h2 className="text-lg font-bold leading-snug text-navy">{simulationTitle}</h2>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          You haven&apos;t been given access to {disciplineName ? `${disciplineName} simulations` : 'this simulation'} yet.
          Your programme decides which disciplines you can take. If you&apos;d like to try this one, ask the
          organisation that invited you to add it.
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </Dialog>
  )
}
