import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { SimulationPrompt } from '@/types/simulation'
import { getSimulationByIdOrSlug } from '@/lib/data/simulations.server'
import Navbar from '@/components/layout/Navbar'
import PromptProgress from '@/components/simulation/PromptProgress'
import CollapsibleBrief from '@/components/simulation/CollapsibleBrief'
import PromptForm from '@/components/simulation/PromptForm'

type Props = {
  params: Promise<{ id: string; step: string }>
}

function mapPromptToFormPrompt(prompt: {
  prompt_number: number
  title: string
  text: string
  submission_type: 'typed' | 'either'
  url_allowed?: boolean
  min_words: number
  word_guidance?: string
  typed_word_guidance?: string
}): SimulationPrompt {
  const guidance = prompt.typed_word_guidance ?? prompt.word_guidance ?? ''
  const numbers = guidance.match(/\d+/g)?.map((n) => Number.parseInt(n, 10)) ?? []
  const [parsedMin, parsedMax] = numbers

  return {
    number: prompt.prompt_number,
    title: prompt.title,
    body: prompt.text,
    submissionType: prompt.url_allowed ? 'url' : prompt.submission_type,
    wordMin: Number.isFinite(parsedMin) ? parsedMin : prompt.min_words,
    wordMax: Number.isFinite(parsedMax)
      ? parsedMax
      : Number.isFinite(parsedMin)
        ? parsedMin + 200
        : prompt.min_words + 200,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, step } = await params
  const simulation = await getSimulationByIdOrSlug(id)
  if (!simulation) return { title: 'Not found' }
  return {
    title: `Step ${step} — ${simulation.title} — Career Bridge`,
  }
}

export default async function PromptPage({ params }: Props) {
  const { id, step } = await params
  const simulation = await getSimulationByIdOrSlug(id)
  if (!simulation) notFound()

  const stepNumber = parseInt(step, 10)
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > simulation.prompts.length) notFound()

  const prompt = mapPromptToFormPrompt(simulation.prompts[stepNumber - 1])

  return (
    <main className="min-h-screen bg-surface">
      <Navbar showBack backHref="/" />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PromptProgress current={stepNumber} total={simulation.prompts.length} />

        <div className="mt-5">
          <CollapsibleBrief brief={simulation.scenario_brief} />
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
