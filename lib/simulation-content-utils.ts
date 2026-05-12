import type { SimulationContent } from '@/lib/schemas/simulation'

export function normalizeSimulationContent(content: SimulationContent): SimulationContent {
  const prompts = content.prompts ?? []
  const timeRemaining = [...(content.time_remaining ?? [])]

  while (timeRemaining.length < prompts.length) {
    const lastTime = timeRemaining[timeRemaining.length - 1] ?? 5
    timeRemaining.push(Math.max(lastTime - 8, 5))
  }

  return {
    ...content,
    time_remaining: timeRemaining.slice(0, prompts.length),
  }
}