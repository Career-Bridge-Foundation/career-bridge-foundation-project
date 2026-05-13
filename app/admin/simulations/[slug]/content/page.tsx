import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
    <div className="min-h-screen">
      <div className="flex items-center gap-2 mb-6  bg- text-slate-800/70">
        <Link href="/admin/simulations" className="hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="text-sm">{sim.title}</span>
      </div>
      <ContentEditor slug={slug} initialData={sim as any} />
    </div>
  )
}
