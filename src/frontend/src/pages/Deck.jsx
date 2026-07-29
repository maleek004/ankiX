import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

export default function Deck(){
  const { id } = useParams()
  const [deck, setDeck]           = useState(null)
  const [queue, setQueue]         = useState({ newCount:0, learningCount:0, reviewCount:0, dueCards:[] })
  const [allCards, setAllCards]   = useState([])  // for the edit drawer
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer]     = useState(false)
  const [userCode, setUserCode]         = useState('')

  // Edit / Admin mode toggle
  const [isEditing, setIsEditing]           = useState(false)
  const [prompt, setPrompt]                 = useState('')
  const [validationSpec, setValidationSpec] = useState('')
  const [type, setType]                     = useState('basic')

  // Followups
  const [showFollowups, setShowFollowups]       = useState(false)
  const [followups, setFollowups]               = useState([])
  const [followupsLoading, setFollowupsLoading] = useState(false)
  const [newQuestion, setNewQuestion]           = useState('')
  const [submittingFollowup, setSubmittingFollowup] = useState(false)

  const [canCreate, setCanCreate] = useState(false)

  // ── Load deck info + study queue ──────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    const m = await import('../api.js')
    const [d, q, cs] = await Promise.all([
      m.getDeck(id).catch(() => null),
      m.getStudyQueue(id).catch(() => ({ newCount:0, learningCount:0, reviewCount:0, dueCards:[] })),
      m.getCards(id).catch(() => [])
    ])
    setDeck(d)
    setQueue(q)
    setAllCards(cs || [])
    setCurrentIndex(0)
    setShowAnswer(false)
    setShowFollowups(false)
    setFollowups([])
  }, [id])

  useEffect(() => {
    let mounted = true
    import('../api.js').then(m => {
      setCanCreate(m.canCreateContent())
    })
    if (mounted) loadQueue()
    return () => { mounted = false }
  }, [id, loadQueue])

  // Reset followup panel whenever the card changes
  useEffect(() => {
    setShowFollowups(false)
    setFollowups([])
    setNewQuestion('')
  }, [currentIndex])

  const dueCards   = queue.dueCards || []
  const currentCard = dueCards[currentIndex]

  // ── Followups ─────────────────────────────────────────────────────────────
  const loadFollowups = useCallback(async (cardId) => {
    setFollowupsLoading(true)
    try {
      const data = await import('../api.js').then(m => m.getFollowups(cardId))
      setFollowups(data || [])
    } catch(err) {
      console.warn('Could not load followups:', err.message || err)
      setFollowups([])
    } finally {
      setFollowupsLoading(false)
    }
  }, [])

  const handleToggleFollowups = () => {
    if (!showFollowups && currentCard) {
      loadFollowups(currentCard.id)
    }
    setShowFollowups(prev => !prev)
  }

  const handleSubmitFollowup = async (e) => {
    e.preventDefault()
    if (!newQuestion.trim() || !currentCard) return
    setSubmittingFollowup(true)
    try {
      const created = await import('../api.js').then(m => m.addFollowup(currentCard.id, newQuestion.trim()))
      setFollowups(prev => [created, ...prev])
      setNewQuestion('')
    } catch(err) {
      alert('Could not add follow-up: ' + (err.message || err))
    } finally {
      setSubmittingFollowup(false)
    }
  }

  // ── Rating ────────────────────────────────────────────────────────────────
  // After rating: advance to next card. If we finish the queue, reload it —
  // learning cards may have come back due (1-min or 10-min intervals elapsed).
  const rateCard = async (outcome) => {
    try {
      await import('../api.js').then(m => m.submitReview(currentCard.id, outcome))
    } catch(err) {
      console.warn('Review submission failed (continuing study):', err.message || err)
    }

    const nextIndex = currentIndex + 1
    if (nextIndex >= dueCards.length) {
      // End of current queue — reload to pick up any learning cards now due
      await loadQueue()
    } else {
      setCurrentIndex(nextIndex)
      setShowAnswer(false)
      setUserCode('')
    }
  }

  // ── Edit Drawer ───────────────────────────────────────────────────────────
  const addCard = async (e) => {
    e.preventDefault()
    if(!prompt.trim()) return
    try{
      const c = await import('../api.js').then(m => m.createCard(id, prompt, validationSpec, type))
      setAllCards(prev => [...prev, c])
      setPrompt(''); setValidationSpec(''); setType('basic')
      alert('Card added!')
      await loadQueue() // refresh queue counts
    }catch(err){ alert('Create card failed: ' + (err.message || err)) }
  }

  const removeCard = async (cardId) => {
    if(!confirm('Delete card?')) return
    try{
      await import('../api.js').then(m => m.deleteCard(id, cardId))
      setAllCards(prev => prev.filter(c => c.id !== cardId))
      await loadQueue()
    }catch(err){ alert('Delete failed: ' + (err.message || err)) }
  }

  // Compute display label for each rating button's next-interval hint
  const getIntervalLabel = (outcome) => {
    if (!currentCard) return ''
    // These are approximate labels. The actual interval is phase-dependent.
    // New/Learning cards: Again=1m, Hard=1m, Good=10m, Easy=Graduate
    // Review cards: shows SM-2 days
    const phase = currentCard._phase  // we don't have server phase in card, show sensible defaults
    switch(outcome){
      case 'Again': return '<1m'
      case 'Hard':  return '<1m'
      case 'Good':  return '<10m'
      case 'Easy':  return '1d+'
      default:      return ''
    }
  }

  // ── Counters (live from queue response) ───────────────────────────────────
  const newCount      = queue.newCount      ?? 0
  const learningCount = queue.learningCount ?? 0
  const reviewCount   = queue.reviewCount   ?? 0
  const remaining     = Math.max(0, dueCards.length - currentIndex)

  return (
    <div className="study-container">
      {/* Top Toolbar */}
      <div className="study-top-bar">
        <div className="study-toolbar-left">
          {canCreate && (
            <>
              <button className="btn-study-tool" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? 'Close Edit' : 'Edit'}
              </button>
              <button className="btn-study-tool" onClick={() => setIsEditing(true)}>+</button>
            </>
          )}
          <button className="btn-study-tool" onClick={() => alert('Deck limits option')}>Limits</button>
        </div>
        <div className="study-counts-right">
          {/* Blue = new, Red = learning, Green = review — live from backend */}
          <span className="count-blue">{newCount}</span>
          {' + '}
          <span className="count-red">{learningCount}</span>
          {' + '}
          <span className="count-green">{reviewCount}</span>
        </div>
      </div>

      {/* Edit Drawer */}
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

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Existing Cards ({allCards.length})</h4>
          <ul style={{ paddingLeft: 20 }}>
            {allCards.map(c => (
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
      {allCards.length === 0 ? (
        <div className="empty-state">
          <h3>No cards in this deck yet.</h3>
          <p>Click <strong>Edit</strong> above or the <strong>+</strong> button to add cards!</p>
        </div>
      ) : dueCards.length === 0 || currentIndex >= dueCards.length ? (
        <div className="empty-state">
          <h2>🎉 All done!</h2>
          <p style={{ fontSize: '1.1rem', color: '#495057' }}>
            No cards due right now. Check back soon — learning cards reappear in minutes!
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={loadQueue}>Refresh Queue</button>
            <Link to="/decks" className="btn-study-tool" style={{ textDecoration: 'none' }}>Return to Decks</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="card-viewer-area">
            {/* Front Prompt */}
            <div className="card-prompt">{currentCard.prompt}</div>

            {/* Micro-coding Editor */}
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

            {/* Answer Section — revealed after Show Answer */}
            {showAnswer && (
              <>
                <hr className="card-divider" />
                <div className="card-answer">
                  {currentCard.validationSpec || 'Correct answer verified.'}
                </div>

                {/* ── Followups Toggle ── only visible once answer is shown ── */}
                <div className="followups-wrapper">
                  <button className="btn-followups-toggle" onClick={handleToggleFollowups}>
                    {showFollowups ? '▲ Hide Follow-ups' : '▼ Follow-ups'}
                    {followups.length > 0 && !showFollowups && (
                      <span className="followups-badge">{followups.length}</span>
                    )}
                  </button>

                  {showFollowups && (
                    <div className="followups-panel">
                      <form className="followup-form" onSubmit={handleSubmitFollowup}>
                        <input
                          className="form-control followup-input"
                          placeholder="A question this card sparked in your mind..."
                          value={newQuestion}
                          onChange={e => setNewQuestion(e.target.value)}
                          disabled={submittingFollowup}
                        />
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={submittingFollowup || !newQuestion.trim()}
                        >
                          {submittingFollowup ? 'Posting...' : 'Ask'}
                        </button>
                      </form>

                      {followupsLoading ? (
                        <p className="followups-loading">Loading follow-ups...</p>
                      ) : followups.length === 0 ? (
                        <p className="followups-empty">No follow-ups yet. Be the first to ask!</p>
                      ) : (
                        <ul className="followups-list">
                          {followups.map(f => (
                            <li key={f.id} className="followup-item">
                              <div className="followup-meta">
                                <span className="followup-author">{f.authorDisplayName}</span>
                                <span className="followup-date">
                                  {new Date(f.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="followup-text">{f.questionText}</p>
                              {f.linkedCardId && (
                                <Link to={`/decks/${id}`} className="followup-answer-link">
                                  → Answered by a card
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
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
                  <button className="btn-rating again" onClick={() => rateCard('Again')}>Again</button>
                </div>
                <div className="rating-col">
                  <span className="rating-interval">&lt;1m</span>
                  <button className="btn-rating" onClick={() => rateCard('Hard')}>Hard</button>
                </div>
                <div className="rating-col">
                  <span className="rating-interval">&lt;10m</span>
                  <button className="btn-rating" onClick={() => rateCard('Good')}>Good</button>
                </div>
                <div className="rating-col">
                  <span className="rating-interval">1d+</span>
                  <button className="btn-rating" onClick={() => rateCard('Easy')}>Easy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
