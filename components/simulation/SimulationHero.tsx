import { Badge } from '@/components/ui/badge'
import type { SimulationHeroProps } from '@/lib/types'

export default function SimulationHero({ simulation }: SimulationHeroProps) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline" className="border-brand-primary text-brand-primary">
          {simulation.discipline}
        </Badge>
        <Badge variant="outline" className="border-brand-primary text-brand-primary">
          {simulation.company_name}
        </Badge>
      </div>

      <h1 className="text-3xl font-bold text-text-primary leading-tight">
        {simulation.title}
      </h1>

      <p className="text-sm text-text-muted">
        Role: {simulation.candidate_role ?? 'N/A'} &middot; Est. {simulation.estimated_minutes ?? 'N/A'}
      </p>
    </header>
  )
}
