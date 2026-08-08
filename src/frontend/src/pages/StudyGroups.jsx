import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import { getStudyGroups, createStudyGroup, joinStudyGroup, getStudyGroupMembers, updateStudyGroupMemberRole, addStudyGroupMember } from '../api'

export default function StudyGroups() {
  const auth = useAuth()
  const { setActiveStudyGroup } = useStudyGroup()
  const navigate = useNavigate()
  const [studyGroups, setStudyGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', isPublic: true })
  const [actionLoading, setActionLoading] = useState(false)
  const [managingMembersStudyGroup, setManagingMembersStudyGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('Member')
  const [addMemberLoading, setAddMemberLoading] = useState(false)
  const [updatingRoleId, setUpdatingRoleId] = useState(null)

  const token = auth?.user ? localStorage.getItem('ankix_token') : null

  useEffect(() => {
    loadStudyGroups()
  }, [])

  async function loadStudyGroups() {
    setLoading(true)
    try {
      const data = await getStudyGroups()
      setStudyGroups(data || [])
    } catch (err) {
      console.error('Failed to load study groups:', err)
    } finally {
      setLoading(false)
    }
  }

  function enterStudyGroup(group) {
    setActiveStudyGroup({
      id: group.id,
      slug: group.slug,
      name: group.name,
      role: group.userRole
    })
    navigate('/decks')
  }

  async function handleJoinAndEnter(group) {
    setActionLoading(true)
    try {
      await joinStudyGroup(group.slug)
      await loadStudyGroups()
      // After joining, enter immediately
      setActiveStudyGroup({
        id: group.id,
        slug: group.slug,
        name: group.name,
        role: 'Member'
      })
      navigate('/decks')
    } catch (err) {
      alert(err.message || 'Failed to join study group')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setActionLoading(true)
    try {
      const created = await createStudyGroup(createForm)
      setShowCreateModal(false)
      setCreateForm({ name: '', slug: '', description: '', isPublic: true })
      // Enter the newly created study group
      setActiveStudyGroup({
        id: created.id,
        slug: created.slug,
        name: created.name,
        role: 'Owner'
      })
      navigate('/decks')
    } catch (err) {
      alert(err.message || 'Failed to create study group')
    } finally {
      setActionLoading(false)
    }
  }

  async function openManageMembers(e, group) {
    e.stopPropagation()
    setManagingMembersStudyGroup(group)
    setMembersLoading(true)
    try {
      const data = await getStudyGroupMembers(group.slug)
      setMembers(data || [])
    } catch (err) {
      alert(err.message || 'Failed to load members')
    } finally {
      setMembersLoading(false)
    }
  }

  async function handleRoleChange(targetUserId, newRole) {
    if (!managingMembersStudyGroup) return
    setUpdatingRoleId(targetUserId)
    try {
      await updateStudyGroupMemberRole(managingMembersStudyGroup.slug, targetUserId, newRole)
      const updated = await getStudyGroupMembers(managingMembersStudyGroup.slug)
      setMembers(updated || [])
      await loadStudyGroups()
    } catch (err) {
      alert(err.message || 'Failed to update role')
    } finally {
      setUpdatingRoleId(null)
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!managingMembersStudyGroup || !addMemberEmail.trim()) return
    setAddMemberLoading(true)
    try {
      await addStudyGroupMember(managingMembersStudyGroup.slug, addMemberEmail.trim(), addMemberRole)
      setAddMemberEmail('')
      setAddMemberRole('Member')
      const updated = await getStudyGroupMembers(managingMembersStudyGroup.slug)
      setMembers(updated || [])
      await loadStudyGroups()
    } catch (err) {
      alert(err.message || 'Failed to add member')
    } finally {
      setAddMemberLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading study groups...</div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e293b' }}>🌐 Study Groups</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
            Select a study group to access its decks and exercises.
          </p>
        </div>
        {token && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.25rem' }}
          >
            ➕ Create Study Group
          </button>
        )}
      </div>

      {/* Study Groups Grid */}
      {studyGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
          <p style={{ fontSize: '1.1rem' }}>No study groups available yet.</p>
          <p>Create the first one!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {studyGroups.map(c => (
            <div
              key={c.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => c.userRole ? enterStudyGroup(c) : null}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.13)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>{c.name}</h3>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {c.userRole && (
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999,
                      background: c.userRole === 'Owner' ? '#fef3c7' : '#e0e7ff',
                      color: c.userRole === 'Owner' ? '#92400e' : '#3730a3',
                      fontWeight: 600
                    }}>
                      {c.userRole}
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999,
                    background: c.isPublic ? '#dcfce7' : '#fef9c3',
                    color: c.isPublic ? '#166534' : '#854d0e'
                  }}>
                    {c.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>

              {c.description && (
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4 }}>
                  {c.description.length > 120 ? c.description.slice(0, 120) + '...' : c.description}
                </p>
              )}

              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>👥 {c.memberCount}</span>
                <span>📚 {c.deckCount}</span>
                <span>🧩 {c.exerciseCount}</span>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                {c.userRole ? (
                  <>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                      onClick={(e) => { e.stopPropagation(); enterStudyGroup(c) }}
                    >
                      Enter Study Group →
                    </button>
                    {(c.userRole === 'Owner' || c.userRole === 'Admin' || auth?.user?.role === 'Admin') && (
                      <button
                        className="btn btn-[#6366f1]"
                        style={{ marginTop: 6, width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                        onClick={(e) => openManageMembers(e, c)}
                      >
                        👥 Manage Members
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                    disabled={actionLoading}
                    onClick={(e) => { e.stopPropagation(); handleJoinAndEnter(c) }}
                  >
                    {actionLoading ? 'Joining...' : 'Join & Enter'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Study Group Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: '2rem',
              width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#1e293b' }}>➕ Create Study Group</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Name *</label>
                <input
                  className="form-control"
                  value={createForm.name}
                  onChange={e => setCreateForm({
                    ...createForm,
                    name: e.target.value,
                    slug: e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  })}
                  placeholder="My Study Group"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Slug</label>
                <input
                  className="form-control"
                  value={createForm.slug}
                  onChange={e => setCreateForm({ ...createForm, slug: e.target.value })}
                  placeholder="my-study-group"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Description</label>
                <textarea
                  className="form-control"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="What is this study group about?"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={createForm.isPublic}
                  onChange={e => setCreateForm({ ...createForm, isPublic: e.target.checked })}
                />
                Public study group (visible to everyone)
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {managingMembersStudyGroup && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setManagingMembersStudyGroup(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: '2rem',
              width: '100%', maxWidth: 650, maxHeight: '90vh', overflow: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#1e293b' }}>👥 Manage Members — {managingMembersStudyGroup.name}</h2>
              <button className="btn btn-secondary" onClick={() => setManagingMembersStudyGroup(null)}>✕</button>
            </div>

            {membersLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading members...</div>
            ) : (
              <>
              {/* Add Member Form */}
              <form onSubmit={handleAddMember} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter registered user email..."
                  value={addMemberEmail}
                  onChange={e => setAddMemberEmail(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                  required
                />
                <select
                  value={addMemberRole}
                  onChange={e => setAddMemberRole(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="Member">Member</option>
                  <option value="Contributor">Contributor</option>
                  <option value="Admin">Admin</option>
                  {managingMembersStudyGroup.userRole === 'Owner' && <option value="Owner">Owner</option>}
                </select>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} disabled={addMemberLoading}>
                  {addMemberLoading ? 'Adding...' : '➕ Add Member'}
                </button>
              </form>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>
                    <th style={{ padding: '8px' }}>User</th>
                    <th style={{ padding: '8px' }}>Role</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{m.displayName || m.email}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.email}</div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          fontSize: '0.75rem', padding: '2px 8px', borderRadius: 999,
                          background: m.role === 'Owner' ? '#fef3c7' : m.role === 'Admin' ? '#e0e7ff' : '#f1f5f9',
                          color: m.role === 'Owner' ? '#92400e' : m.role === 'Admin' ? '#3730a3' : '#475569',
                          fontWeight: 600
                        }}>
                          {m.role}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {(managingMembersStudyGroup.userRole === 'Owner' || auth?.user?.role === 'Admin' || (managingMembersStudyGroup.userRole === 'Admin' && m.role !== 'Owner')) ? (
                          <select
                            value={m.role}
                            disabled={updatingRoleId === m.userId}
                            onChange={e => handleRoleChange(m.userId, e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                          >
                            <option value="Admin">Admin</option>
                            <option value="Contributor">Contributor</option>
                            <option value="Member">Member</option>
                            {managingMembersStudyGroup.userRole === 'Owner' && <option value="Owner">Owner</option>}
                          </select>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

