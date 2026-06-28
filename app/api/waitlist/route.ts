import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

const VALID_TIME_OPTIONS = [
  'As soon as possible',
  'Within 1 month',
  '1–3 months',
  '3–6 months',
  'No specific timeline',
]

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email, discipline, time_requested } = body as Record<string, unknown>

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }
  if (typeof discipline !== 'string' || !discipline.trim()) {
    return NextResponse.json({ error: 'Discipline is required' }, { status: 400 })
  }
  if (typeof time_requested !== 'string' || !VALID_TIME_OPTIONS.includes(time_requested)) {
    return NextResponse.json({ error: 'A valid time option is required' }, { status: 400 })
  }

  const { error } = await supabaseServer.from('waitlist_signups').insert({
    email: email.trim().toLowerCase(),
    discipline: discipline.trim(),
    time_requested,
  })

  if (error) {
    // Unique constraint violation — already signed up for this discipline
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You are already on the waitlist for this discipline.' },
        { status: 409 }
      )
    }
    console.error('[waitlist] insert error', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
