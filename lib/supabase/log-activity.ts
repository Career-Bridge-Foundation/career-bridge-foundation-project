import { supabaseServer } from '@/lib/supabase/server'

type Action = 'created' | 'updated_metadata' | 'updated_content' | 'updated_rubric' | 'deleted' | 'status_changed'

export async function logActivity(opts: {
  simulationId: string
  userEmail: string
  action: Action
  diff?: Record<string, unknown>
}) {
  const { error } = await supabaseServer.from('simulation_activity').insert({
    simulation_id: opts.simulationId,
    user_email: opts.userEmail,
    action: opts.action,
    diff: opts.diff ?? null,
  })
  if (error) console.error('[logActivity] write failed:', error.message, { action: opts.action, simulationId: opts.simulationId })
}
