import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCommunity } from '../community/CommunityProvider'
import { getCommunities, createCommunity, joinCommunity } from '../api'

export default function Communities() {
  const auth = useAuth()
  const { setActiveCommunity } = useCommunity()
  const navigate = useNavigate()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', isPublic: true })
  const [actionLoading, setActionLoading] = useState(false)

  const token = auth?.user ? localStorage.getItem('ankix_token') : null

  useEffect(() => {
    loadCommunities()
  }, [])

  async function loadCommunities() {
    setLoading(true)
    try {
      const data = await getCommunities()
      setCommunities(data || [])
    } catch (err) {
      console.error('Failed to load communities:', err)
    } finally {
      setLoading(false)
    }
  }

  function enterCommunity(community) {
    setActiveCommunity({
      id: community.id,
      slug: community.slug,
      name: community.name,
      role: community.userRole
    })
    navigate('/decks')
  }

  async function handleJoinAndEnter(community) {
    setActionLoading(true)
    try {
      await joinCommunity(community.slug)
      await loadCommunities()
      // After joining, enter immediately
      setActiveCommunity({
        id: community.id,
        slug: community.slug,
        name: community.name,
        role: 'Member'
      })
      navigate('/decks')
    } catch (err) {
      alert(err.message || 'Failed to join community')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setActionLoading(true)
    try {
      const created = await createCommunity(createForm)
      setShowCreateModal(false)
      setCreateForm({ name: '', slug: '', description: '', isPublic: true })
      // Enter the newly created community
      setActiveCommunity({
        id: created.id,
        slug: created.slug,
        name: created.name,
        role: 'Owner'
      })
      navigate('/decks')
    } catch (err) {
      alert(err.message || 'Failed to create community')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading communities...</div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e293b' }}>🌐 Learning Communities</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
            Select a community to access its decks and exercises.
          </p>
        </div>
        {token && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.25rem' }}
          >
            ➕ Create Community
          </button>
        )}
      </div>

      {/* Communities Grid */}
      {communities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
          <p style={{ fontSize: '1.1rem' }}>No communities available yet.</p>
          <p>Create the first one!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {communities.map(c => (
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
              onClick={() => c.userRole ? enterCommunity(c) : null}
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
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                    onClick={(e) => { e.stopPropagation(); enterCommunity(c) }}
                  >
                    Enter Community →
                  </button>
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

      {/* Create Community Modal */}
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
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#1e293b' }}>➕ Create Community</h2>
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
                  placeholder="What is this community about?"
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
                Public community (visible to everyone)
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
    </div>
  )
}
