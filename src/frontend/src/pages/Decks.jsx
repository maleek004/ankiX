import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import { getDecks, createDeck, deleteDeck, canCreateContent } from '../api.js'

export default function Decks(){
  const { activeStudyGroup } = useStudyGroup() || {}
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [canCreate, setCanCreate] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!activeStudyGroup) {
      navigate('/study-groups')
      return
    }
    let mounted = true
    setLoading(true)
    setCanCreate(canCreateContent(activeStudyGroup?.role))
    getDecks(activeStudyGroup.id)
      .then(data => {
        if (!mounted) return
        setDecks(data || [])
      })
      .catch(err => {
        console.warn('Could not fetch decks:', err.message || err)
        if (mounted) setDecks([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [activeStudyGroup?.id, activeStudyGroup?.role, navigate])

  const create = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsCreating(true)
    try {
      const d = await createDeck(newTitle, newDescription, activeStudyGroup?.id)
      setDecks(prev => [...prev, d])
      setNewTitle('')
      setNewDescription('')
      setShowAddForm(false)
    } catch(err) {
      alert('Create deck failed: ' + (err.message || err))
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteDeck = async (id) => {
    if (!confirm('Are you sure you want to delete this deck?')) return
    setDeletingId(id)
    try {
      await deleteDeck(id)
      setDecks(prev => prev.filter(d => d.id !== id))
    } catch(err) {
      alert('Delete deck failed: ' + (err.message || err))
    } finally {
      setDeletingId(null)
    }
  }


  if (!activeStudyGroup) return null

  return (
    <div>
      <div className="decks-header-bar">
        <h2 style={{ margin: 0, fontWeight: 500, fontSize: '1.5rem' }}>Decks</h2>
        {canCreate && (
          <button 
            className="btn-primary" 
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : '+ Add Deck'}
          </button>
        )}
      </div>

      {showAddForm && canCreate && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Deck Title</label>
              <input 
                className="form-control"
                placeholder="Deck title" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
                autoFocus
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
              <input 
                className="form-control"
                placeholder="Deck description (optional)" 
                value={newDescription} 
                onChange={e => setNewDescription(e.target.value)} 
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-study-tool" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isCreating}>
                {isCreating ? 'Saving Deck...' : 'Save Deck'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Fetching decks...</div>
      ) : decks.length === 0 ? (
        <div className="empty-state">No decks in this study group yet. Create one to get started!</div>
      ) : (
        <table className="decks-table">
          <tbody>
            {decks.map(d => (
              <tr key={d.id}>
                <td>
                  <Link to={`/decks/${d.id}`} className="deck-name-link">
                    {d.title}
                  </Link>
                </td>
                <td className="deck-counts" style={{ width: 100 }}>
                  <div className="count-green">{d.dueCount ?? 0}</div>
                  <div className="count-blue">{d.learnCount ?? 0}</div>
                </td>
                <td style={{ width: 110, textAlign: 'right' }}>
                  <div className="actions-dropdown">
                    <button 
                      className="btn-actions"
                      onClick={() => setActiveDropdown(activeDropdown === d.id ? null : d.id)}
                    >
                      Actions ▾
                    </button>
                    {activeDropdown === d.id && (
                      <div className="dropdown-menu">
                        <Link to={`/decks/${d.id}`} className="dropdown-item">Study</Link>
                        <button className="dropdown-item" disabled={deletingId === d.id} onClick={() => handleDeleteDeck(d.id)}>
                          {deletingId === d.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

