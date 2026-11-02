/**
 * GET/PUT /api/mentor/candidates/:id/disciplines — Spec 20.
 *
 * Same handlers as the partner route. Middleware confines mentors to
 * /mentor and /api/mentor, so they need their own path; the handlers
 * already accept the mentor role and limit it to the mentor's assigned
 * candidates.
 */
export const runtime = 'nodejs'

export { GET, PUT } from '@/app/api/partner/candidates/[candidateId]/disciplines/route'
