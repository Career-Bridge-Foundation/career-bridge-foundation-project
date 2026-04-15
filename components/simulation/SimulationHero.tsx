import { Badge } from '@/components/ui/badge'
import type { Simulation } from '@/types/simulation'

type Props = {
  simulation: Simulation
}

export default function SimulationHero({ simulation }: Props) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="border-brand-primary text-brand-primary">
          {simulation.discipline}
        </Badge>
        <Badge variant="outline" className="border-brand-primary text-brand-primary">
          {simulation.company}
        </Badge>
      </div>

      <h1 className="text-3xl font-bold text-text-primary leading-tight">
        {simulation.title}
      </h1>

      <p className="text-sm text-text-muted">
        Role: {simulation.candidateRole} &middot; Est. {simulation.estimatedMinutes}
      </p>
    </header>
  )
}
