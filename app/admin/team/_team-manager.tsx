'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { UserRoleRecord, AdminPermissions, UserRole } from '@/types/database'

const ROLE_STYLE: Record<string, string> = {
  super_admin:       'bg-orange-50 border-orange-200 text-orange-700',
  admin:             'bg-blue-50 border-blue-200 text-blue-700',
  reviewer:          'bg-emerald-50 border-emerald-200 text-emerald-700',
  content_developer: 'bg-violet-50 border-violet-200 text-violet-700',
}

const PERMISSION_LABELS: { key: keyof AdminPermissions; label: string }[] = [
  { key: 'canManageSimulations', label: 'Manage simulations' },
  { key: 'canManageUsers',       label: 'Manage users'       },
  { key: 'canViewAnalytics',     label: 'View analytics'     },
  { key: 'canExportData',        label: 'Export data'        },
]

// Human label for a discipline slug (e.g. "cyber-security" -> "Cyber Security").
// Matches the convention already used in app/(branded)/redeem/page.tsx.
function disciplineLabel(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const ASSIGN_TYPE_LABELS: Record<string, string> = {
  discipline: 'Discipline',
  industry:   'Industry',
  slug:       'Simulation',
}

interface Assignment {
  id: string
  discipline: string | null
  industry: string | null
  slug: string | null
}

type Member = UserRoleRecord & { disciplines: string[]; assignments: Assignment[] }

interface Props {
  members: Member[]
  currentUserId: string
  currentRole: UserRole
  canManage: boolean
  industries: string[]
  simOptions: { slug: string; title: string | null }[]
  disciplines: string[]
}

export function TeamManager({ members, currentUserId, currentRole, canManage, industries, simOptions, disciplines }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Add member form state
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'admin' | 'reviewer' | 'content_developer'>('admin')
  const [addDisciplines, setAddDisciplines] = useState<string[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addInviteSentMsg, setAddInviteSentMsg] = useState<string | null>(null)

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the team?')) return
    setLoading(userId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to remove member')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  async function handlePermissionToggle(member: Member, key: keyof AdminPermissions) {
    const updated = { ...member.permissions, [key]: !member.permissions[key] }
    setLoading(member.user_id + key)
    setError(null)
    try {
      const res = await fetch(`/api/admin/team/${member.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions: updated }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to update permissions')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  async function handleAddAssignment(
    member: Member,
    assignment: { discipline?: string; industry?: string; slug?: string },
  ) {
    setLoading(member.user_id + ':add-assign')
    setError(null)
    try {
      const res = await fetch(`/api/admin/team/${member.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addAssignment: assignment }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add assignment')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setLoading(userId + ':role')
    setError(null)
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to update role')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    setLoading(assignmentId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/team/assignments/${assignmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to remove assignment')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    setAddInviteSentMsg(null)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: addEmail, role: addRole, disciplines: addRole === 'reviewer' ? addDisciplines : [] }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? 'Failed to add member')
      }
      if (body.invited) {
        // No account existed yet — an invite was sent instead. They won't
        // appear in the list below until they accept it.
        setAddInviteSentMsg(`Invite sent to ${body.email}`)
        setAddEmail('')
        setAddRole('admin')
        setAddDisciplines([])
        return
      }
      setAddEmail('')
      setAddRole('admin')
      setAddDisciplines([])
      setShowAdd(false)
      router.refresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Member list */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Team members ({members.length})
          </h2>
          {canManage && (
            <button
              onClick={() => {
                setShowAdd(v => !v)
                setAddInviteSentMsg(null)
                setAddError(null)
              }}
              className="text-xs font-medium text-teal hover:text-teal/80 transition-colors"
            >
              {showAdd ? 'Cancel' : '+ Add member'}
            </button>
          )}
        </div>

        {/* Add member form */}
        {showAdd && canManage && (
          <form onSubmit={handleAdd} className="px-6 py-5 border-b border-slate-200 bg-slate-50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value as 'admin' | 'reviewer' | 'content_developer')}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
                >
                  <option value="admin">Admin</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="content_developer">Content Developer</option>
                </select>
              </div>
            </div>

            {addRole === 'reviewer' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Disciplines <span className="text-slate-400 font-normal">(optional — can also configure after adding)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {disciplines.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setAddDisciplines(prev =>
                          prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        addDisciplines.includes(d)
                          ? 'bg-teal text-white border-teal'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-teal/50'
                      }`}
                    >
                      {disciplineLabel(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {addError && <p className="text-xs text-red-600">{addError}</p>}
            {addInviteSentMsg && <p className="text-xs text-teal">{addInviteSentMsg}</p>}

            <button
              type="submit"
              disabled={addLoading}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-md hover:bg-teal/90 disabled:opacity-50 transition-colors"
            >
              {addLoading ? 'Adding…' : 'Add member'}
            </button>
          </form>
        )}

        {/* Members */}
        {members.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No team members yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(member => {
              const isMe = member.user_id === currentUserId
              const isSuperAdmin = member.role === 'super_admin'
              const isOpen = expanded === member.user_id

              return (
                <div key={member.user_id}>
                  <div className="flex items-center gap-4 px-6 py-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-slate-100 border border-slate-200 text-slate-600">
                      {(member.email ?? '?')[0].toUpperCase()}
                    </div>

                    {/* Email + summary */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 font-medium truncate">
                        {member.email}
                        {isMe && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                      </div>
                      {member.role === 'reviewer' && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {[
                            member.disciplines.length > 0 && member.disciplines.join(', '),
                            member.assignments.length > 0 && `+${member.assignments.length} specific ${member.assignments.length === 1 ? 'assignment' : 'assignments'}`,
                          ].filter(Boolean).join(' · ') || 'No assignments yet'}
                        </div>
                      )}
                    </div>

                    {/* Role badge */}
                    <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${ROLE_STYLE[member.role] ?? ''}`}>
                      {member.role.replace('_', ' ')}
                    </span>

                    {/* Expand / remove */}
                    {canManage && !isSuperAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpanded(isOpen ? null : member.user_id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Edit"
                        >
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          onClick={() => handleRemove(member.user_id)}
                          disabled={loading === member.user_id}
                          className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded panel */}
                  {isOpen && !isSuperAdmin && (
                    <div className="px-6 pb-5 pt-2 bg-slate-50 border-t border-slate-100 space-y-5">
                      {/* Role change */}
                      {canManage && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 mb-2">Role</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(currentRole === 'super_admin'
                              ? ['admin', 'reviewer', 'content_developer']
                              : ['reviewer', 'content_developer']
                            ).map(r => (
                              <button
                                key={r}
                                type="button"
                                disabled={member.role === r || loading === member.user_id + ':role'}
                                onClick={() => handleRoleChange(member.user_id, r)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:cursor-not-allowed ${
                                  member.role === r
                                    ? ROLE_STYLE[r] ?? 'bg-slate-100 border-slate-200 text-slate-700'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-teal/50 disabled:opacity-40'
                                }`}
                              >
                                {r.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Permission toggles (admin only) */}
                      {member.role === 'admin' && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 mb-2">Permissions</p>
                          <div className="space-y-2">
                            {PERMISSION_LABELS.map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-3 cursor-pointer">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={member.permissions[key]}
                                  onClick={() => handlePermissionToggle(member, key)}
                                  disabled={loading === member.user_id + key}
                                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                                    member.permissions[key]
                                      ? 'bg-teal border-teal'
                                      : 'bg-slate-200 border-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                      member.permissions[key] ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                                <span className="text-sm text-slate-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reviewer assignment editor */}
                      {member.role === 'reviewer' && (
                        <ReviewerAssignmentsEditor
                          member={member}
                          industries={industries}
                          simOptions={simOptions}
                          disciplines={disciplines}
                          addingAssignment={loading === member.user_id + ':add-assign'}
                          removingId={loading}
                          onAdd={assignment => handleAddAssignment(member, assignment)}
                          onRemove={id => handleRemoveAssignment(id)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Granular assignments editor (reviewer_assignments table) ─────────────────

interface AssignmentsEditorProps {
  member: Member
  industries: string[]
  simOptions: { slug: string; title: string | null }[]
  disciplines: string[]
  addingAssignment: boolean
  removingId: string | null
  onAdd: (assignment: { discipline?: string; industry?: string; slug?: string }) => void
  onRemove: (id: string) => void
}

function ReviewerAssignmentsEditor({
  member,
  industries,
  simOptions,
  disciplines,
  addingAssignment,
  removingId,
  onAdd,
  onRemove,
}: AssignmentsEditorProps) {
  const [addType, setAddType] = useState<'discipline' | 'industry' | 'slug'>('industry')
  const [addValue, setAddValue] = useState('')

  function handleAdd() {
    if (!addValue.trim()) return
    const payload =
      addType === 'discipline' ? { discipline: addValue } :
      addType === 'industry'   ? { industry: addValue } :
                                 { slug: addValue }
    onAdd(payload)
    setAddValue('')
  }

  function assignmentLabel(a: Assignment) {
    if (a.discipline) return `Discipline: ${a.discipline}`
    if (a.industry)   return `Industry: ${a.industry}`
    if (a.slug) {
      const sim = simOptions.find(s => s.slug === a.slug)
      return `Sim: ${sim?.title ?? a.slug}`
    }
    return 'Unknown'
  }

  function assignmentColor(a: Assignment) {
    if (a.discipline) return 'bg-teal/10 text-teal border-teal/20'
    if (a.industry)   return 'bg-violet-50 text-violet-700 border-violet-200'
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-700 mb-1">Specific assignments</p>
      <p className="text-xs text-slate-400 mb-3">
        Grant access to simulations by industry or individual slug, in addition to the disciplines above.
      </p>

      {/* Existing assignments */}
      <div className="flex flex-wrap gap-2 mb-4 min-h-[28px]">
        {member.assignments.length === 0 ? (
          <p className="text-xs text-slate-400 italic">None yet.</p>
        ) : (
          member.assignments.map(a => (
            <span
              key={a.id}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${assignmentColor(a)}`}
            >
              {assignmentLabel(a)}
              <button
                onClick={() => onRemove(a.id)}
                disabled={removingId === a.id}
                className="hover:text-red-500 transition-colors disabled:opacity-40"
                aria-label="Remove assignment"
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Add new assignment */}
      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Filter by</label>
          <select
            value={addType}
            onChange={e => { setAddType(e.target.value as typeof addType); setAddValue('') }}
            className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
          >
            <option value="discipline">Discipline</option>
            <option value="industry">Industry</option>
            <option value="slug">Simulation</option>
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">{ASSIGN_TYPE_LABELS[addType]}</label>
          {addType === 'discipline' && (
            <select
              value={addValue}
              onChange={e => setAddValue(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
            >
              <option value="">Select discipline…</option>
              {disciplines.length === 0
                ? <option disabled>No disciplines found in simulations</option>
                : disciplines.map(d => <option key={d} value={d}>{disciplineLabel(d)}</option>)
              }
            </select>
          )}
          {addType === 'industry' && (
            <select
              value={addValue}
              onChange={e => setAddValue(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
            >
              <option value="">Select industry…</option>
              {industries.length === 0
                ? <option disabled>No industries found in simulations</option>
                : industries.map(i => <option key={i} value={i}>{i}</option>)
              }
            </select>
          )}
          {addType === 'slug' && (
            <select
              value={addValue}
              onChange={e => setAddValue(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/40"
            >
              <option value="">Select simulation…</option>
              {simOptions.map(s => (
                <option key={s.slug} value={s.slug}>{s.title ?? s.slug}</option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={!addValue.trim() || addingAssignment}
          className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {addingAssignment ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
