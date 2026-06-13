import { notFound, redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerCandidateDetail } from '@/lib/partners/candidateDetail'
import { logCandidateAccess } from '@/lib/partners/accessLog'
import { CandidateDetail } from './_candidate-detail'

export const dynamic = 'force-dynamic'

export default async function CandidateDetailPage({ params }: { params: Promise<{ candidateId: string }> }) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner')
  }
  const { candidateId } = await params

  const detail = await getPartnerCandidateDetail(ctx.partnerId!, candidateId)
  if (!detail) notFound() // non-entitled / unknown → 404, no existence leak

  // Audit the sensitive submission access — only after a successful, entitled load.
  await logCandidateAccess({
    partnerId: ctx.partnerId!,
    viewerId: ctx.userId,
    viewerEmail: ctx.email,
    candidateId,
  })

  return <CandidateDetail detail={detail} />
}
