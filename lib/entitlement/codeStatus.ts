// Shared effective-status derivation for sponsor_codes, used by every
// partner/codes endpoint that renders or filters on status. See the
// "status is NOT fully stored" note in
// schema-reference/spec-18-sponsor-codes.sql — active/exhausted/revoked are
// stored and authoritative; expired is derived at read time, since there is
// no cron/sweep in this codebase.
export type StoredCodeStatus = 'active' | 'exhausted' | 'revoked'
export type EffectiveCodeStatus = StoredCodeStatus | 'expired'

export function effectiveCodeStatus(row: { status: StoredCodeStatus; expires_at: string }): EffectiveCodeStatus {
  if (row.status === 'active' && new Date(row.expires_at) <= new Date()) return 'expired'
  return row.status
}
