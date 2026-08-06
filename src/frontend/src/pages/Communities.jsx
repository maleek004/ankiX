import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  getCommunities,
  getCommunityBySlug,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityDecks,
  getCommunityExercises
} from '../api'

export default function Communities() {
  const { slug } = useParams()
  const auth = useAuth()
  const [communities, setCommunities] = useState([])
  const [activeCommunity, setActiveCommunity] = useState(null)
  const [communityDecks, setCommunityDecks] = useState([])
  const [communityExercises, setCommunityExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', isPublic: true })
  const [createError, setCreateError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const token = localStorage.getItem('token')

  useEffect(() => {
    loadCommunities()
  }, [])

  useEffect(() => {
    if (slug) {
      loadCommunityDetail(slug)
    } else {
      setActiveCommunity(null)
    }
  }, [slug])

  async function loadCommunities() {
    try {
      setLoading(true)
      const data = await getCommunities()
      setCommunities(data)
    } catch (err) {
      setError(err.message || 'Failed to load communities')
    } finally {
      setLoading(false)
    }
  }

  async function loadCommunityDetail(cSlug) {
    try {
      setLoading(true)
      const comm = await getCommunityBySlug(cSlug)
      setActiveCommunity(comm)
      const [decks, exercises] = await Promise.all([
        getCommunityDecks(cSlug),
        getCommunityExercises(cSlug)
      ])
      setCommunityDecks(decks)
      setCommunityExercises(exercises)
    } catch (err) {
      setError(err.message || 'Failed to load community details')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault()
    setCreateError('')
    if (!createForm.name || !createForm.slug) {
      setCreateError('Community Name and Slug are required.')
      return
    }

    try {
      setActionLoading(true)
      const newComm = await createCommunity(createForm)
      setShowCreateModal(false)
      setCreateForm({ name: '', slug: '', description: '', isPublic: true })
      await loadCommunities()
    } catch (err) {
      setCreateError(err.message || 'Failed to create community')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleJoin(cSlug) {
    try {
      setActionLoading(true)
      await joinCommunity(cSlug)
      await loadCommunities()
      if (slug === cSlug) await loadCommunityDetail(cSlug)
    } catch (err) {
      alert(err.message || 'Failed to join community')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLeave(cSlug) {
    if (!window.confirm('Are you sure you want to leave this community?')) return
    try {
      setActionLoading(true)
      await leaveCommunity(cSlug)
      await loadCommunities()
      if (slug === cSlug) await loadCommunityDetail(cSlug)
    } catch (err) {
      alert(err.message || 'Failed to leave community')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e293b' }}>
            🌐 {slug && activeCommunity ? activeCommunity.name : 'Learning Communities'}
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
            {slug && activeCommunity
              ? activeCommunity.description || 'Community Space'
              : 'Join topic hubs, share flashcards, and practice exercises with peers.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {slug && (
            <Link to="/communities" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>
              ← All Communities
            </Link>
          )}
          {auth?.user?.role === 'Admin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.25rem' }}
            >
              ➕ Create Community
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading communities...</div>
      ) : slug && activeCommunity ? (
        /* Community Detail Scoped View */
        <div>
          <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', background: activeCommunity.isPublic ? '#e0f2fe' : '#fef3c7', color: activeCommunity.isPublic ? '#0369a1' : '#b45309' }}>
                  {activeCommunity.isPublic ? 'Public Community' : 'Private Community'}
                </span>
                <span style={{ marginLeft: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                  👥 {activeCommunity.memberCount} Members &nbsp;•&nbsp; 📚 {activeCommunity.deckCount} Decks &nbsp;•&nbsp; 🧩 {activeCommunity.exerciseCount} Exercises
                </span>
              </div>
              <div>
                {activeCommunity.userRole ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 600, color: '#059669', fontSize: '0.9rem' }}>
                      Role: {activeCommunity.userRole}
                    </span>
                    {activeCommunity.userRole !== 'Owner' && (
                      <button onClick={() => handleLeave(activeCommunity.slug)} className="btn btn-outline-danger" disabled={actionLoading} style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>
                        Leave
                      </button>
                    )}
                  </div>
                ) : token ? (
                  <button onClick={() => handleJoin(activeCommunity.slug)} className="btn btn-primary" disabled={actionLoading} style={{ padding: '0.4rem 1rem' }}>
                    Join Community
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Decks Section */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '1rem' }}>📚 Community Decks</h2>
            {communityDecks.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No decks available in this community yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {communityDecks.map(deck => (
                  <div key={deck.id} style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                      <Link to={`/decks/${deck.id}`} style={{ textDecoration: 'none', color: '#2563eb' }}>{deck.title}</Link>
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{deck.description || 'No description.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exercises Section */}
          <div>
            <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '1rem' }}>🧩 Community Exercises</h2>
            {communityExercises.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No exercises available in this community yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {communityExercises.map(ex => (
                  <div key={ex.id} style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#1e293b' }}>{ex.title}</h3>
                      <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#475569', textTransform: 'uppercase' }}>{ex.language}</span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>{ex.description || 'No description.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* All Communities Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {communities.map(comm => (
            <div key={comm.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                    <Link to={`/c/${comm.slug}`} style={{ textDecoration: 'none', color: '#0f172a' }}>{comm.name}</Link>
                  </h2>
                  {comm.userRole && (
                    <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                      {comm.userRole}
                    </span>
                  )}
                </div>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                  {comm.description || 'No community description available.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  👥 {comm.memberCount} &nbsp;•&nbsp; 📚 {comm.deckCount} &nbsp;•&nbsp; 🧩 {comm.exerciseCount}
                </span>

                {comm.userRole ? (
                  <Link to={`/c/${comm.slug}`} className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem', textDecoration: 'none' }}>
                    View Community
                  </Link>
                ) : token ? (
                  <button onClick={() => handleJoin(comm.slug)} className="btn btn-outline-primary" disabled={actionLoading} style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem' }}>
                    Join
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '500px', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.3rem' }}>➕ Create New Community</h2>

            {createError && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}>Community Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Python Mastery"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}>URL Handle / Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. python-mastery"
                  value={createForm.slug}
                  onChange={e => setCreateForm({ ...createForm, slug: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="What is this community about?"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={createForm.isPublic}
                  onChange={e => setCreateForm({ ...createForm, isPublic: e.target.checked })}
                />
                <label htmlFor="isPublic" style={{ fontSize: '0.9rem' }}>Public Community (Anyone can view and join)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
