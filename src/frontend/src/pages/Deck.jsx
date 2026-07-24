import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function Deck(){
  const { id } = useParams()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [code, setCode] = useState('')

  useEffect(()=>{
    let mounted = true
    import('../api.js').then(m=>Promise.all([m.getDeck(id).catch(()=>null), m.getCards(id).catch(()=>[])]))
      .then(([d,cs])=>{ if(!mounted) return; setDeck(d); setCards(cs) })
      .catch(err=>{ console.warn('deck load',err); setDeck(null); setCards([]) })
    return ()=>{ mounted = false }
  },[id])

  const addCard = async (e) => {
    e.preventDefault()
    try{
      const c = await import('../api.js').then(m=>m.createCard(id, front, back, code))
      setCards(prev=>[c,...prev])
      setFront(''); setBack(''); setCode('')
    }catch(err){ alert('Create card failed: ' + (err.message || err)) }
  }

  const removeCard = async (cardId) => {
    if(!confirm('Delete card?')) return
    try{
      await import('../api.js').then(m=>m.deleteCard(id, cardId))
      setCards(prev=>prev.filter(c=>c.id !== cardId))
    }catch(err){ alert('Delete failed: ' + (err.message || err)) }
  }

  return (
    <div>
      <h2>{deck?.title ? `Deck: ${deck.title}` : `Deck ${id}`}</h2>

      <section style={{marginTop:12}}>
        <h3>Add Card</h3>
        <form onSubmit={addCard}>
          <div><label>Front</label><input value={front} onChange={e=>setFront(e.target.value)} /></div>
          <div><label>Back</label><input value={back} onChange={e=>setBack(e.target.value)} /></div>
          <div><label>Code (optional)</label><input value={code} onChange={e=>setCode(e.target.value)} /></div>
          <button type="submit">Add Card</button>
        </form>
      </section>

      <section style={{marginTop:20}}>
        <h3>Cards</h3>
        <ul>
          {cards.map(c=> (
            <li key={c.id} style={{marginBottom:8}}>
              <strong>{c.front}</strong> — {c.back}
              <div><small>code: {c.code ? 'yes' : 'no'}</small></div>
              <div><button onClick={()=>removeCard(c.id)}>Delete</button></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
