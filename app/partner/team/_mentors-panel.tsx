'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PartnerMentor } from '@/lib/partners/mentorRoster'

type RosterOption = { userId: string; fullName: string | null; email: string | null }

export function MentorsPanel({
  mentors,
  roster,
  availableDisciplines,
}: {
  mentors: PartnerMentor[]
  roster: RosterOption[]
  availableDisciplines: string[]
}) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(key: string, url: string, method: 'POST' | 'DELETE', body: object) {
    setBusyKey(key)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Something went wrong.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  function toggleDiscipline(mentor: PartnerMentor, discipline: string, active: boolean) {
    call(
      `${mentor.userId}:${discipline}`,
      `/api/partner/mentors/${mentor.userId}/disciplines`,
      active ? 'DELETE' : 'POST',
      { discipline }
    )
  }

  function assignCandidate(mentor: PartnerMentor, candidateUserId: string) {
    if (!candidateUserId) return
    call(
      `${mentor.userId}:assign`,
      `/api/partner/mentors/${mentor.userId}/candidates`,
      'POST',
      { candidateUserId }
    )
  }

  function unassignCandidate(mentor: PartnerMentor, candidateUserId: string) {
    call(
      `${mentor.userId}:${candidateUserId}`,
      `/api/partner/mentors/${mentor.userId}/candidates`,
      'DELETE',
      { candidateUserId }
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {mentors.map((m) => {
        const assignedIds = new Set(m.candidates.map((c) => c.userId))
        const assignable = roster.filter((r) => !assignedIds.has(r.userId))
        return (
          <div key={m.userId} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <p className="text-base font-semibold text-slate-900">{m.email ?? m.userId}</p>
              {m.grantedAt && (
                <p className="text-xs text-slate-500">
                  Mentor since{' '}
                  {new Date(m.grantedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>

            {/* Disciplines */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Disciplines</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {availableDisciplines.map((d) => {
                  const active = m.disciplines.includes(d)
                  const key = `${m.userId}:${d}`
                  return (
                    <label key={d} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={active}
                        disabled={busyKey === key}
                        onChange={() => toggleDiscipline(m, d, active)}
                      />
                      {d}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Assigned candidates */}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Assigned candidates</p>
              {m.candidates.length === 0 ? (
                <p className="text-sm text-slate-500">None assigned yet.</p>
              ) : (
                <ul className="mb-2 space-y-1">
                  {m.candidates.map((c) => (
                    <li
                      key={c.userId}
                      className="flex items-center justify-between gap-2 text-sm text-slate-700"
                    >
                      <span>{c.fullName ?? c.email ?? c.userId}</span>
                      <button
                        onClick={() => unassignCandidate(m, c.userId)}
                        disabled={busyKey === `${m.userId}:${c.userId}`}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {assignable.length > 0 && (
                <select
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                  value=""
                  disabled={busyKey === `${m.userId}:assign`}
                  onChange={(e) => assignCandidate(m, e.target.value)}
                >
                  <option value="">Assign a candidate…</option>
                  {assignable.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.fullName ?? r.email ?? r.userId}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
