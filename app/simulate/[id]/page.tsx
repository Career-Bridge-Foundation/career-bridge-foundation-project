import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FaArrowLeft } from 'react-icons/fa'
import { getSimulation } from '@/lib/data/simulations'
import SimulationHero from '@/components/simulation/SimulationHero'
import VideoPlayerWrapper from '@/components/simulation/VideoPlayerWrapper'
import ScenarioBrief from '@/components/simulation/ScenarioBrief'
import CandidateGate from '@/components/simulation/CandidateGate'
import { Separator } from '@/components/ui/separator'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const simulation = getSimulation(id)

  if (!simulation) return { title: 'Simulation not found' }

  return {
    title: `${simulation.title} — Career Bridge`,
    description: `A ${simulation.discipline} simulation set at ${simulation.company}. Estimated time: ${simulation.estimatedMinutes}.`,
  }
}

export default async function SimulatePage({ params }: Props) {
  const { id } = await params
  const simulation = getSimulation(id)

  if (!simulation) notFound()

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="cb-btn cb-btn-primary text-xs py-2 px-5" aria-label="Go back">
            <span className="mr-2 inline-flex items-center align-middle">
              <FaArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            Back
          </Link>
        </div>

        <SimulationHero simulation={simulation} />

        <VideoPlayerWrapper src={simulation.videoUrl} className="mt-6 rounded-lg overflow-hidden" />

        <Separator className="my-8" />

        <ScenarioBrief brief={simulation.scenarioBrief} />

        <div className="mt-10 pb-16">
          <CandidateGate simulationId={simulation.id} />
        </div>
      </div>
    </main>
  )
}
