import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Decks(){
  const [decks, setDecks] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [activeDropdown, setActiveDropdown] = useState(null)

  useEffect(()=>{
    let mounted = true
    import('../api.js').then(m=>m.getDecks()).then(data=>{
      if(!mounted) return
      setDecks(data || [])
    }).catch(err=>{
      console.warn('Could not fetch decks:', err.message || err)
      setDecks([{id:1,title:'Sample Deck (local)'}])
    })
    return ()=>{ mounted = false }
  },[])

  const create = async (e) => {
    e.preventDefault()
    if(!newTitle.trim()) return
    try{
      const d = await import('../api.js').then(m=>m.createDeck(newTitle))
      setDecks(prev=>[...prev, d])
      setNewTitle('')
      setShowAddForm(false)
    }catch(err){
      alert('Create deck failed: ' + (err.message || err))
    }
  }

  const deleteDeck = async (id) => {
    if(!confirm('Are you sure you want to delete this deck?')) return
    try{
      await import('../api.js').then(m=>m.deleteDeck(id))
      setDecks(prev=>prev.filter(d=>d.id !== id))
    }catch(err){
      alert('Delete deck failed: ' + (err.message || err))
    }
  }

  return (
    <div>
      <div className="decks-header-bar">
        <h2 style={{ margin: 0, fontWeight: 500, fontSize: '1.5rem' }}>Decks</h2>
        <button 
          className="btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Deck'}
        </button>
      </div>

      {showAddForm && (
        <div className="form-card">
          <form onSubmit={create} style={{ display: 'flex', gap: 12 }}>
            <input 
              className="form-control"
              placeholder="Deck title" 
              value={newTitle} 
              onChange={e=>setNewTitle(e.target.value)} 
              autoFocus
            />
            <button type="submit" className="btn-primary">Save Deck</button>
          </form>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="empty-state">No decks available. Create one to get started!</div>
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
                  <div className="count-green">{d.dueCount ?? 1}</div>
                  <div className="count-blue">{d.learnCount ?? 2}</div>
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

