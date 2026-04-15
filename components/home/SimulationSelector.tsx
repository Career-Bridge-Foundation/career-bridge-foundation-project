'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type SimulationOption = {
  id: string
  title: string
  discipline: string
  company: string
}

type Props = {
  simulations: SimulationOption[]
}

export default function SimulationSelector({ simulations }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>('')

  function handleStart() {
    if (!selectedId) return
    router.push(`/simulate/${selectedId}`)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <label htmlFor="simulation-select" className="text-sm font-medium text-text-primary">
          Choose a simulation
        </label>
        <Select onValueChange={setSelectedId}>
          <SelectTrigger id="simulation-select" className="w-full">
            <SelectValue placeholder="Select a simulation…" />
          </SelectTrigger>
          <SelectContent>
            {simulations.map((sim) => (
              <SelectItem key={sim.id} value={sim.id}>
                <span className="font-medium">{sim.title}</span>
                <span className="ml-2 text-xs text-text-muted">
                  {sim.discipline} · {sim.company}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleStart}
        disabled={!selectedId}
        className="bg-brand-primary hover:bg-brand-primary/90 text-white sm:w-auto w-full"
      >
        View Simulation
      </Button>
    </div>
  )
}
