import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCommunity } from '../community/CommunityProvider'

export default function Decks(){
  const { activeCommunity } = useCommunity() || {}
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [canCreate, setCanCreate] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)

  useEffect(() => {
    if (!activeCommunity) {
      navigate('/communities')
      return
    }
    let mounted = true
    import('../api.js').then(m => {
      setCanCreate(m.canCreateContent(activeCommunity?.role))
      return m.getDecks(activeCommunity.id)
    }).then(data => {
      if (!mounted) return
      setDecks(data || [])
    }).catch(err => {
      console.warn('Could not fetch decks:', err.message || err)
      setDecks([])
    })
    return () => { mounted = false }
  }, [activeCommunity, navigate])

  const create = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const d = await import('../api.js').then(m => m.createDeck(newTitle, newDescription, activeCommunity?.id))
      setDecks(prev => [...prev, d])
      setNewTitle('')
      setNewDescription('')
      setShowAddForm(false)
    } catch(err) {
      alert('Create deck failed: ' + (err.message || err))
    }
  }

  const deleteDeck = async (id) => {
    if (!confirm('Are you sure you want to delete this deck?')) return
    try {
      await import('../api.js').then(m => m.deleteDeck(id))
      setDecks(prev => prev.filter(d => d.id !== id))
    } catch(err) {
      alert('Delete deck failed: ' + (err.message || err))
    }
  }

  if (!activeCommunity) return null

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
              <button type="submit" className="btn-primary">Save Deck</button>
            </div>
          </form>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="empty-state">No decks in this community yet. Create one to get started!</div>
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
                        <button className="dropdown-item" onClick={() => deleteDeck(d.id)}>Delete</button>
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
