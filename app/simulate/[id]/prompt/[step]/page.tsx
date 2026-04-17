import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSimulation } from '@/lib/data/simulations'
import Navbar from '@/components/layout/Navbar'
import PromptProgress from '@/components/simulation/PromptProgress'
import CollapsibleBrief from '@/components/simulation/CollapsibleBrief'
import PromptForm from '@/components/simulation/PromptForm'

type Props = {
  params: Promise<{ id: string; step: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, step } = await params
  const simulation = getSimulation(id)
  if (!simulation) return { title: 'Not found' }
  return {
    title: `Step ${step} — ${simulation.title} — Career Bridge`,
  }
}

export default async function PromptPage({ params }: Props) {
  const { id, step } = await params
  const simulation = getSimulation(id)
  if (!simulation) notFound()

  const stepNumber = parseInt(step, 10)
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > simulation.prompts.length) notFound()

  const prompt = simulation.prompts[stepNumber - 1]

  return (
    <main className="min-h-screen bg-surface">
      <Navbar showBack backHref="/" />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PromptProgress current={stepNumber} total={simulation.prompts.length} />

        <div className="mt-5">
          <CollapsibleBrief brief={simulation.scenarioBrief} />
        </div>

        <div className="mt-8 pb-16">
          <PromptForm
            simulationId={id}
            prompt={prompt}
            step={stepNumber}
            totalSteps={simulation.prompts.length}
          />
        </div>
      </div>
    </main>
  )
}
