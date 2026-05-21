import React from 'react'
import { getSimBySlug } from '@/lib/data'
import { notFound } from 'next/navigation'
import { ContentEditor } from './_editor'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sim = await getSimBySlug(slug)
  if (!sim) return { title: 'Not Found' }
  return { title: `Edit Content — ${sim.title}` }
}

export default async function SimulationContentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const sim = await getSimBySlug(slug)
  if (!sim) notFound()

  return (
    <div className="min-h-screen -mx-6 -mt-6">
      <ContentEditor slug={slug} videoUrl={(sim as any).video_url ?? null} initialData={sim as any} />
    </div>
  )
}
