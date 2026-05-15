'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { UserRoleRecord, AdminPermissions, UserRole } from '@/types/database'

const ROLE_STYLE: Record<string, string> = {
  super_admin: 'bg-orange-50 border-orange-200 text-orange-700',
  admin:       'bg-blue-50 border-blue-200 text-blue-700',
  reviewer:    'bg-emerald-50 border-emerald-200 text-emerald-700',
}

const PERMISSION_LABELS: { key: keyof AdminPermissions; label: string }[] = [
  { key: 'canManageSimulations', label: 'Manage simulations' },
  { key: 'canManageUsers',       label: 'Manage users'       },
  { key: 'canViewAnalytics',     label: 'View analytics'     },
  { key: 'canExportData',        label: 'Export data'        },
]

const ALL_DISCIPLINES = [
  'Marketing', 'Finance', 'Operations', 'HR', 'Product Management',
  'Sales', 'Legal', 'Technology', 'Strategy', 'Data & Analytics',
]

type Member = UserRoleRecord & { disciplines: string[] }

interface Props {
  members: Member[]
  currentUserId: string
  currentRole: UserRole
  canManage: boolean
}

export function TeamManager({ members, currentUserId, currentRole, canManage }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Add member form state
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'admin' | 'reviewer'>('admin')
  const [addDisciplines, setAddDisciplines] = useState<string[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

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

  async function handleDisciplinesUpdate(member: Member, disciplines: string[]) {
    setLoading(member.user_id + 'disc')
    setError(null)
    try {
      const res = await fetch(`/api/admin/team/${member.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ disciplines }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to update disciplines')
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
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: addEmail, role: addRole, disciplines: addDisciplines }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add member')
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
              onClick={() => setShowAdd(v => !v)}
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
                  onChange={e => setAddRole(e.target.value as 'admin' | 'reviewer')}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
                >
                  <option value="admin">Admin</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </div>
            </div>

            {addRole === 'reviewer' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Disciplines</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DISCIPLINES.map(d => (
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
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {addError && <p className="text-xs text-red-600">{addError}</p>}

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

                    {/* Email + role */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 font-medium truncate">
                        {member.email}
                        {isMe && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                      </div>
                      {member.role === 'reviewer' && member.disciplines.length > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {member.disciplines.join(', ')}
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
                    <div className="px-6 pb-5 pt-2 bg-slate-50 border-t border-slate-100 space-y-4">
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

                      {/* Disciplines editor (reviewer only) */}
                      {member.role === 'reviewer' && (
                        <ReviewerDisciplinesEditor
                          member={member}
                          saving={loading === member.user_id + 'disc'}
                          onSave={disciplines => handleDisciplinesUpdate(member, disciplines)}
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

function ReviewerDisciplinesEditor({
  member,
  saving,
  onSave,
}: {
  member: Member
  saving: boolean
  onSave: (disciplines: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(member.disciplines)

  function toggle(d: string) {
    setSelected(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-700 mb-2">Disciplines</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {ALL_DISCIPLINES.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selected.includes(d)
                ? 'bg-teal text-white border-teal'
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal/50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSave(selected)}
        disabled={saving}
        className="text-xs px-3 py-1.5 bg-teal text-white rounded-md hover:bg-teal/90 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save disciplines'}
      </button>
    </div>
  )
}
