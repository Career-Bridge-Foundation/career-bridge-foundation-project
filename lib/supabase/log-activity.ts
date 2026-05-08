import { supabaseServer } from '@/lib/supabase/server'

type Action = 'created' | 'updated_metadata' | 'updated_content' | 'deleted'

export async function logActivity(opts: {
  simulationId: string
  userEmail: string
  action: Action
  diff?: Record<string, unknown>
}) {
  await supabaseServer.from('simulation_activity').insert({
    simulation_id: opts.simulationId,
    user_email: opts.userEmail,
    action: opts.action,
    diff: opts.diff ?? null,
  })
  // Fire-and-forget — never throw; a logging failure must not break the response
}
