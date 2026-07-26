import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

export default function Deck(){
  const { id } = useParams()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [userCode, setUserCode] = useState('')
  const [codeResult, setCodeResult] = useState(null)

  // Edit / Admin mode toggle
  const [isEditing, setIsEditing] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [validationSpec, setValidationSpec] = useState('')
  const [type, setType] = useState('basic')

  useEffect(()=>{
    let mounted = true
    import('../api.js').then(m=>Promise.all([m.getDeck(id).catch(()=>null), m.getCards(id).catch(()=>[])]))
      .then(([d,cs])=>{ 
        if(!mounted) return; 
        setDeck(d); 
        setCards(cs || []);
        setCurrentIndex(0);
        setShowAnswer(false);
      })
      .catch(err=>{ console.warn('deck load',err); setDeck(null); setCards([]) })
    return ()=>{ mounted = false }
  },[id])

  const currentCard = cards[currentIndex]

  const handleNextCard = () => {
    setShowAnswer(false)
    setUserCode('')
    setCodeResult(null)
    setCurrentIndex(prev => prev + 1)
  }

  const addCard = async (e) => {
    e.preventDefault()
    if(!prompt.trim()) return
    try{
      const c = await import('../api.js').then(m=>m.createCard(id, prompt, validationSpec, type))
      setCards(prev=>[...prev, c])
      setPrompt(''); setValidationSpec(''); setType('basic')
      alert('Card added successfully!')
    }catch(err){ alert('Create card failed: ' + (err.message || err)) }
  }

  const removeCard = async (cardId) => {
    if(!confirm('Delete card?')) return
    try{
      await import('../api.js').then(m=>m.deleteCard(id, cardId))
      setCards(prev=>prev.filter(c=>c.id !== cardId))
    }catch(err){ alert('Delete failed: ' + (err.message || err)) }
  }

  const restartStudy = () => {
    setCurrentIndex(0)
    setShowAnswer(false)
    setUserCode('')
    setCodeResult(null)
  }

  return (
    <div className="study-container">
      {/* Top Toolbar */}
      <div className="study-top-bar">
        <div className="study-toolbar-left">
          <button className="btn-study-tool" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Close Edit' : 'Edit'}
          </button>
          <button className="btn-study-tool" onClick={() => alert('Deck limits option')}>Limits</button>
          <button className="btn-study-tool" onClick={() => setIsEditing(true)}>+</button>
        </div>
        <div className="study-counts-right">
          <span className="count-blue">{cards.length - currentIndex > 0 ? cards.length - currentIndex : 0}</span>
          {' + '}
          <span className="count-red">0</span>
          {' + '}
          <span className="count-green">0</span>
        </div>
      </div>

      {/* Edit Drawer for Management */}
      {isEditing && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Add New Card to Deck</h3>
          <form onSubmit={addCard}>
            <div className="form-group">
              <label>Prompt / Question</label>
              <input className="form-control" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Enter question or problem" required />
            </div>
            <div className="form-group">
              <label>Validation Spec / Answer</label>
              <input className="form-control" value={validationSpec} onChange={e=>setValidationSpec(e.target.value)} placeholder='Answer or {"answer":"Paris"}' />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select className="form-control" value={type} onChange={e=>setType(e.target.value)}>
                <option value="basic">basic</option>
                <option value="micro-coding">micro-coding</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">Add Card</button>
          </form>

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Existing Cards ({cards.length})</h4>
          <ul style={{ paddingLeft: 20 }}>
            {cards.map(c => (
              <li key={c.id} style={{ marginBottom: 6 }}>
                <strong>{c.prompt}</strong> ({c.type})
                {' '}
                <button 
                  style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem' }} 
                  onClick={() => removeCard(c.id)}
                >
                  [Delete]
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Card Viewer Area */}
      {cards.length === 0 ? (
        <div className="empty-state">
          <h3>No cards in this deck yet.</h3>
          <p>Click <strong>Edit</strong> above or the <strong>+</strong> button to add cards to this deck!</p>
        </div>
      ) : currentIndex >= cards.length ? (
        <div className="empty-state">
          <h2>Congratulations!</h2>
          <p style={{ fontSize: '1.1rem', color: '#495057' }}>You have finished reviewing this deck for now.</p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={restartStudy}>Study Again</button>
            <Link to="/decks" className="btn-study-tool" style={{ textDecoration: 'none' }}>Return to Decks</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="card-viewer-area">
            {/* Front Prompt */}
            <div className="card-prompt">{currentCard.prompt}</div>

            {/* Micro-coding Editor (If Card Type is Micro-Coding) */}
            {currentCard.type === 'micro-coding' && (
              <div className="code-box">
                <textarea
                  className="code-input"
                  placeholder="// Type your code solution here..."
                  value={userCode}
                  onChange={e=>setUserCode(e.target.value)}
                />
              </div>
            )}

            {/* Answer Section (Revealed when Show Answer is clicked) */}
            {showAnswer && (
              <>
                <hr className="card-divider" />
                <div className="card-answer">
                  {currentCard.validationSpec || 'Correct answer verified.'}
                </div>
              </>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="study-bottom-bar">
            {!showAnswer ? (
              <button className="btn-show-answer" onClick={() => setShowAnswer(true)}>
                Show Answer
              </button>
            ) : (
              <div className="rating-buttons-group">
                <div className="rating-col">
                  <span className="rating-interval">&lt;1m</span>
                  <button className="btn-rating again" onClick={handleNextCard}>Again</button>
                </div>
                <div className="rating-col">
                  <span className="rating-interval">&lt;6m</span>
                  <button className="btn-rating" onClick={handleNextCard}>Hard</button>
                </div>
                <div className="rating-col">
                  <span className="rating-interval">&lt;10m</span>
                  <button className="btn-rating" onClick={handleNextCard}>Good</button>
                </div>
                <div className="rating-col">
                  <span className="rating-interval">4d</span>
                  <button className="btn-rating" onClick={handleNextCard}>Easy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

