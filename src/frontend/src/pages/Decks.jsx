import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Decks(){
  const [decks, setDecks] = useState([])

  useEffect(()=>{
    let mounted = true
    import('../api.js').then(m=>m.getDecks()).then(data=>{
      if(!mounted) return
      // backend returns array of deck DTOs
      setDecks(data || [])
    }).catch(err=>{
      console.warn('Could not fetch decks:', err.message || err)
      setDecks([{id:1,title:'Sample Deck (local)'}])
    })
    return ()=>{ mounted = false }
  },[])

  const [newTitle, setNewTitle] = useState('')
  const create = async (e) => {
    e.preventDefault()
    try{
      const d = await import('../api.js').then(m=>m.createDeck(newTitle))
      setDecks(prev=>[d,...prev])
      setNewTitle('')
    }catch(err){
      alert('Create deck failed: ' + (err.message || err))
    }
  }

  return (
    <div>
      <h2>Decks</h2>
      <form onSubmit={create} style={{marginBottom:12}}>
        <input placeholder="New deck title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
        <button type="submit">Create</button>
      </form>
      <ul>
        {decks.map(d=> (
          <li key={d.id}><Link to={`/decks/${d.id}`}>{d.title}</Link></li>
        ))}
      </ul>
    </div>
  )
}
