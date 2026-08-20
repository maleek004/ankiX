import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import AuthModal from '../components/AuthModal'
import {
  getStudyGroups,
  createStudyGroup,
  joinStudyGroup,
  requestStudyGroupAccess,
  getStudyGroupMembers,
  updateStudyGroupMemberRole,
  addStudyGroupMember,
  inviteStudyGroupMember,
  getStudyGroupJoinRequests,
  approveStudyGroupJoinRequest,
  rejectStudyGroupJoinRequest,
  getMyStudyGroupInvitations,
  acceptStudyGroupInvitation,
  declineStudyGroupInvitation,
  updateStudyGroupPrivacy,
  getEffectiveDisplayName
} from '../api'

export default function StudyGroups() {
  const auth = useAuth()
  const { setActiveStudyGroup } = useStudyGroup()
  const navigate = useNavigate()
  const [studyGroups, setStudyGroups] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [authModalConfig, setAuthModalConfig] = useState({ isOpen: false, title: '', subtitle: '', intent: null })
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', privacy: 'Public' })
  const [actionLoading, setActionLoading] = useState(false)

  // Manage Members & Settings Modal State
  const [managingMembersStudyGroup, setManagingMembersStudyGroup] = useState(null)
  const [activeTab, setActiveTab] = useState('members') // 'members' | 'requests' | 'invite' | 'settings'
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [updatingRoleId, setUpdatingRoleId] = useState(null)
  const [processingRequestId, setProcessingRequestId] = useState(null)
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false)
  const [selectedPrivacy, setSelectedPrivacy] = useState('Public')

  const token = auth?.user ? localStorage.getItem('ankix_token') : null

  useEffect(() => {
    loadData()
  }, [token])

  async function loadData() {
    setLoading(true)
    try {
      const promises = [getStudyGroups()]
      if (token) {
        promises.push(getMyStudyGroupInvitations().catch(() => []))
      }
      const [groupsData, invitesData] = await Promise.all(promises)
      setStudyGroups(groupsData || [])
      setInvitations(invitesData || [])
    } catch (err) {
      console.error('Failed to load study groups data:', err)
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
      await loadData()
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

  async function handleRequestAccess(group) {
    setActionLoading(true)
    try {
      await requestStudyGroupAccess(group.slug)
      alert(`Join request for '${group.name}' submitted successfully! A group administrator will review your request.`)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to request access')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAcceptInvite(invitation) {
    setActionLoading(true)
    try {
      await acceptStudyGroupInvitation(invitation.studyGroupSlug)
      await loadData()
      setActiveStudyGroup({
        id: invitation.studyGroupId,
        slug: invitation.studyGroupSlug,
        name: invitation.studyGroupName,
        role: invitation.role || 'Member'
      })
      navigate('/decks')
    } catch (err) {
      alert(err.message || 'Failed to accept invitation')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeclineInvite(invitation) {
    setActionLoading(true)
    try {
      await declineStudyGroupInvitation(invitation.studyGroupSlug)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to decline invitation')
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
      setCreateForm({ name: '', slug: '', description: '', privacy: 'Public' })
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
    setSelectedPrivacy(group.privacy || (group.isPublic ? 'Public' : 'Private'))
    setActiveTab(group.pendingRequestCount > 0 ? 'requests' : 'members')
    loadGroupMembersAndRequests(group.slug)
  }

  async function loadGroupMembersAndRequests(slug) {
    setMembersLoading(true)
    setRequestsLoading(true)
    try {
      const [membersData, requestsData] = await Promise.all([
        getStudyGroupMembers(slug).catch(() => []),
        getStudyGroupJoinRequests(slug).catch(() => [])
      ])
      setMembers(membersData || [])
      setRequests(requestsData || [])
    } catch (err) {
      console.error('Failed to load group admin data:', err)
    } finally {
      setMembersLoading(false)
      setRequestsLoading(false)
    }
  }

  async function handleRoleChange(targetUserId, newRole) {
    if (!managingMembersStudyGroup) return
    setUpdatingRoleId(targetUserId)
    try {
      await updateStudyGroupMemberRole(managingMembersStudyGroup.slug, targetUserId, newRole)
      const updated = await getStudyGroupMembers(managingMembersStudyGroup.slug)
      setMembers(updated || [])
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to update role')
    } finally {
      setUpdatingRoleId(null)
    }
  }

  async function handleSendInvite(e) {
    e.preventDefault()
    if (!managingMembersStudyGroup || !inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const res = await inviteStudyGroupMember(managingMembersStudyGroup.slug, inviteEmail.trim(), inviteRole)
      alert(res.message || 'Invitation dispatched successfully!')
      setInviteEmail('')
      setInviteRole('Member')
      await loadGroupMembersAndRequests(managingMembersStudyGroup.slug)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleApproveRequest(userId) {
    if (!managingMembersStudyGroup) return
    setProcessingRequestId(userId)
    try {
      await approveStudyGroupJoinRequest(managingMembersStudyGroup.slug, userId)
      await loadGroupMembersAndRequests(managingMembersStudyGroup.slug)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to approve request')
    } finally {
      setProcessingRequestId(null)
    }
  }

  async function handleRejectRequest(userId) {
    if (!managingMembersStudyGroup) return
    setProcessingRequestId(userId)
    try {
      await rejectStudyGroupJoinRequest(managingMembersStudyGroup.slug, userId)
      await loadGroupMembersAndRequests(managingMembersStudyGroup.slug)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to reject request')
    } finally {
      setProcessingRequestId(null)
    }
  }

  async function handleSavePrivacy() {
    if (!managingMembersStudyGroup) return
    setUpdatingPrivacy(true)
    try {
      const updated = await updateStudyGroupPrivacy(managingMembersStudyGroup.slug, selectedPrivacy)
      setManagingMembersStudyGroup(updated)
      await loadData()
      alert(`Study group privacy updated to '${selectedPrivacy}'.`)
    } catch (err) {
      alert(err.message || 'Failed to update privacy')
    } finally {
      setUpdatingPrivacy(false)
    }
  }

  function getPrivacyBadge(privacy, isPublic) {
    const tier = privacy || (isPublic ? 'Public' : 'Private')
    switch (tier) {
      case 'Public':
        return { label: 'Public', bg: '#dcfce7', color: '#166534', icon: '🌐' }
      case 'Private':
        return { label: 'Private (Request to Join)', bg: '#fef9c3', color: '#854d0e', icon: '🔒' }
      case 'Locked':
        return { label: 'Locked (Invite Only)', bg: '#fee2e2', color: '#991b1b', icon: '🛡️' }
      default:
        return { label: tier, bg: '#f1f5f9', color: '#475569', icon: '📁' }
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading study groups...</div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e293b' }}>🌐 Study Groups</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
            Discover learning communities, request access to cohorts, or manage your own study groups.
          </p>
        </div>
        <button
          onClick={() => {
            if (token) {
              setShowCreateModal(true)
            } else {
              setAuthModalConfig({
                isOpen: true,
                title: 'Create a Study Group',
                subtitle: 'Sign in or register in seconds to create and manage your own public, private, or locked study groups.',
                intent: { returnUrl: '/study-groups', action: 'create_group' }
              })
            }
          }}
          className="btn btn-primary"
          style={{ padding: '0.5rem 1.25rem' }}
        >
          ➕ Create Study Group
        </button>
      </div>

      {/* Pending Invitations Banner */}
      {invitations.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: 12,
          padding: '1.25rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(37,99,235,0.08)'
        }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem' }}>
            📬 Pending Group Invitations ({invitations.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {invitations.map(inv => (
              <div
                key={inv.studyGroupId}
                style={{
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>
                    🛡️ {inv.studyGroupName} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>({inv.role || 'Member'})</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 2 }}>
                    Invited by <strong>{inv.inviterDisplayName}</strong> {inv.description ? `— "${inv.description}"` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    disabled={actionLoading}
                    onClick={() => handleAcceptInvite(inv)}
                  >
                    ✅ Accept & Join
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    disabled={actionLoading}
                    onClick={() => handleDeclineInvite(inv)}
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Study Groups Grid */}
      {studyGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
          <p style={{ fontSize: '1.1rem' }}>No study groups available yet.</p>
          <p>Create the first one!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {studyGroups.map(c => {
            const badge = getPrivacyBadge(c.privacy, c.isPublic)
            const isMember = Boolean(c.userRole)
            const isPendingRequest = c.userMembershipStatus === 'PendingRequest'

            return (
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
                  cursor: isMember ? 'pointer' : 'default'
                }}
                onClick={() => { if (isMember) enterStudyGroup(c) }}
                onMouseEnter={e => {
                  if (isMember) {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.13)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'none'
                }}
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
                      background: badge.bg,
                      color: badge.color,
                      fontWeight: 600
                    }}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                </div>

                {c.description && (
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {c.description.length > 120 ? c.description.slice(0, 120) + '...' : c.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>👥 {c.memberCount} active</span>
                  <span>📚 {c.deckCount} decks</span>
                  <span>🧩 {c.exerciseCount} exercises</span>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                  {isMember ? (
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
                          style={{
                            marginTop: 6, width: '100%', padding: '0.4rem', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                          onClick={(e) => openManageMembers(e, c)}
                        >
                          👥 Manage & Settings
                          {c.pendingRequestCount > 0 && (
                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 999, fontWeight: 'bold' }}>
                              {c.pendingRequestCount}
                            </span>
                          )}
                        </button>
                      )}
                    </>
                  ) : !token ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                        onClick={(e) => { e.stopPropagation(); enterStudyGroup(c) }}
                      >
                        Browse Decks →
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setAuthModalConfig({
                            isOpen: true,
                            title: `Join ${c.name}`,
                            subtitle: 'Sign in or register to join this study group, sync your SRS reviews, and track daily learning streaks.',
                            intent: { returnUrl: '/study-groups', action: 'join', slug: c.slug }
                          })
                        }}
                      >
                        {c.privacy === 'Private' ? 'Request Join' : 'Join Group'}
                      </button>
                    </div>
                  ) : c.privacy === 'Private' ? (
                    isPendingRequest ? (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', cursor: 'not-allowed', background: '#f1f5f9', color: '#64748b' }}
                        disabled
                      >
                        ⏳ Request Pending Review
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', border: '1px solid #cbd5e1' }}
                        disabled={actionLoading}
                        onClick={(e) => { e.stopPropagation(); handleRequestAccess(c) }}
                      >
                        {actionLoading ? 'Submitting...' : '🔒 Request to Join'}
                      </button>
                    )
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
            )
          })}
        </div>
      )}

      <AuthModal
        {...authModalConfig}
        onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

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
              width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto'
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
                  placeholder="e.g. Cardiology Cohort"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Slug *</label>
                <input
                  className="form-control"
                  value={createForm.slug}
                  onChange={e => setCreateForm({ ...createForm, slug: e.target.value })}
                  placeholder="cardiology-cohort"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Description</label>
                <textarea
                  className="form-control"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="What is the focus of this study group?"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* 3-Tier Privacy Selection */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Privacy & Access Tier</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 8,
                    border: createForm.privacy === 'Public' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: createForm.privacy === 'Public' ? '#f0f7ff' : '#fff', cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="privacy"
                      value="Public"
                      checked={createForm.privacy === 'Public'}
                      onChange={() => setCreateForm({ ...createForm, privacy: 'Public' })}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>🌐 Public (Open)</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Visible to everyone. Any platform member can find and join instantly.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 8,
                    border: createForm.privacy === 'Private' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: createForm.privacy === 'Private' ? '#f0f7ff' : '#fff', cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="privacy"
                      value="Private"
                      checked={createForm.privacy === 'Private'}
                      onChange={() => setCreateForm({ ...createForm, privacy: 'Private' })}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>🔒 Private (Request to Join)</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Visible in directory. Users must submit a join request that you approve.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 8,
                    border: createForm.privacy === 'Locked' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: createForm.privacy === 'Locked' ? '#f0f7ff' : '#fff', cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="privacy"
                      value="Locked"
                      checked={createForm.privacy === 'Locked'}
                      onChange={() => setCreateForm({ ...createForm, privacy: 'Locked' })}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>🛡️ Locked (Invite-Only)</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Completely hidden from search and non-members. Access only via direct email invitation.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Study Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Members & Settings Modal */}
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
              width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.35rem' }}>⚙️ {managingMembersStudyGroup.name}</h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 2 }}>
                  Role: <strong>{managingMembersStudyGroup.userRole}</strong> • Tier: <strong>{managingMembersStudyGroup.privacy || 'Public'}</strong>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setManagingMembersStudyGroup(null)}>✕</button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                style={{
                  padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: activeTab === 'members' ? 600 : 'normal',
                  color: activeTab === 'members' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'members' ? '2px solid #2563eb' : '2px solid transparent'
                }}
              >
                👥 Active Members ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                style={{
                  padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: activeTab === 'requests' ? 600 : 'normal',
                  color: activeTab === 'requests' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'requests' ? '2px solid #2563eb' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                ⏳ Join Requests
                {requests.length > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 999, fontWeight: 'bold' }}>
                    {requests.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('invite')}
                style={{
                  padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: activeTab === 'invite' ? 600 : 'normal',
                  color: activeTab === 'invite' ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === 'invite' ? '2px solid #2563eb' : '2px solid transparent'
                }}
              >
                ✉️ Send Invite
              </button>
              {managingMembersStudyGroup.userRole === 'Owner' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  style={{
                    padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: activeTab === 'settings' ? 600 : 'normal',
                    color: activeTab === 'settings' ? '#2563eb' : '#64748b',
                    borderBottom: activeTab === 'settings' ? '2px solid #2563eb' : '2px solid transparent'
                  }}
                >
                  🔒 Privacy Settings
                </button>
              )}
            </div>

            {/* TAB 1: ACTIVE MEMBERS */}
            {activeTab === 'members' && (
              membersLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading members...</div>
              ) : (
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
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{getEffectiveDisplayName(m.displayName, m.email)}</div>
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
              )
            )}

            {/* TAB 2: JOIN REQUESTS */}
            {activeTab === 'requests' && (
              requestsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading requests...</div>
              ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
                  <p style={{ margin: 0 }}>No pending join requests.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {requests.map(req => (
                    <div
                      key={req.userId}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{getEffectiveDisplayName(req.displayName, req.email)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{req.email} • Requested {new Date(req.requestedAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem' }}
                          disabled={processingRequestId === req.userId}
                          onClick={() => handleApproveRequest(req.userId)}
                        >
                          {processingRequestId === req.userId ? 'Processing...' : '✅ Approve'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem' }}
                          disabled={processingRequestId === req.userId}
                          onClick={() => handleRejectRequest(req.userId)}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* TAB 3: SEND INVITE */}
            {activeTab === 'invite' && (
              <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                  Send an email invitation and in-app notice to a registered AnkiX user. The user will be able to accept the invitation to join.
                </p>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>User Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Assign Role</label>
                  <select
                    className="form-control"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                  >
                    <option value="Member">Member (View & Practice)</option>
                    <option value="Contributor">Contributor (Create & Edit Content)</option>
                    <option value="Admin">Admin (Manage Members & Content)</option>
                    {managingMembersStudyGroup.userRole === 'Owner' && <option value="Owner">Owner</option>}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    {inviteLoading ? 'Sending Invitation...' : '✉️ Send Invitation'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: PRIVACY SETTINGS */}
            {activeTab === 'settings' && managingMembersStudyGroup.userRole === 'Owner' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                  Change the privacy and visibility tier for <strong>{managingMembersStudyGroup.name}</strong> at any time.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 8,
                    border: selectedPrivacy === 'Public' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedPrivacy === 'Public' ? '#f0f7ff' : '#fff', cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="settingsPrivacy"
                      value="Public"
                      checked={selectedPrivacy === 'Public'}
                      onChange={() => setSelectedPrivacy('Public')}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>🌐 Public (Open)</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Visible to everyone. Any platform member can find and join instantly.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 8,
                    border: selectedPrivacy === 'Private' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedPrivacy === 'Private' ? '#f0f7ff' : '#fff', cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="settingsPrivacy"
                      value="Private"
                      checked={selectedPrivacy === 'Private'}
                      onChange={() => setSelectedPrivacy('Private')}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>🔒 Private (Request to Join)</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Visible in directory. Users must submit a join request that you approve.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 8,
                    border: selectedPrivacy === 'Locked' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedPrivacy === 'Locked' ? '#f0f7ff' : '#fff', cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="settingsPrivacy"
                      value="Locked"
                      checked={selectedPrivacy === 'Locked'}
                      onChange={() => setSelectedPrivacy('Locked')}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>🛡️ Locked (Invite-Only)</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Completely hidden from search and non-members. Access only via direct invitation.</div>
                    </div>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={updatingPrivacy || selectedPrivacy === (managingMembersStudyGroup.privacy || 'Public')}
                    onClick={handleSavePrivacy}
                  >
                    {updatingPrivacy ? 'Saving...' : 'Save Privacy Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
