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

  // Followups & Linked Exercises
  const [showFollowups, setShowFollowups]       = useState(false)
  const [followups, setFollowups]               = useState([])
  const [followupsLoading, setFollowupsLoading] = useState(false)
  const [newQuestion, setNewQuestion]           = useState('')
  const [submittingFollowup, setSubmittingFollowup] = useState(false)

  const [linkedExercises, setLinkedExercises] = useState([])
  const [linkerModalCard, setLinkerModalCard] = useState(null)
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
    setLinkedExercises([])
  }, [id])

  useEffect(() => {
    let mounted = true
    import('../api.js').then(m => {
      setCanCreate(m.canCreateContent())
    })
    if (mounted) loadQueue()
    return () => { mounted = false }
  }, [id, loadQueue])

  // Reset followup panel and fetch linked exercises whenever the card changes
  useEffect(() => {
    setShowFollowups(false)
    setFollowups([])
    setNewQuestion('')
    setLinkedExercises([])

    const currentCardId = queue?.dueCards?.[currentIndex]?.id
    if (currentCardId) {
      import('../api.js').then(m => m.getCardExercises(currentCardId))
        .then(exs => setLinkedExercises(exs || []))
        .catch(() => setLinkedExercises([]))
    }
  }, [currentIndex, queue])

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

  const handleResetProgress = async () => {
    if(!confirm('Are you sure you want to reset your study progress for this deck? All cards will be returned to your New Queue.')) return
    try{
      await import('../api.js').then(m => m.resetDeckProgress(id))
      await loadQueue()
      alert('Deck progress reset successfully! All cards are now back in your New Queue.')
    }catch(err){ alert('Reset progress failed: ' + (err.message || err)) }
  }

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
              <li key={c.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span><strong>{c.prompt}</strong> ({c.type})</span>
                <button
                  className="btn-study-tool"
                  style={{ fontSize: '0.75rem', padding: '2px 8px', borderColor: '#0d6efd', color: '#0d6efd' }}
                  onClick={() => setLinkerModalCard(c)}
                >
                  🔗 Link Exercises
                </button>
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
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={loadQueue}>🔄 Sync & Check Due Cards</button>
              <button 
                className="btn-study-tool" 
                style={{ color: '#dc3545', borderColor: '#dc3545' }} 
                onClick={handleResetProgress}
              >
                ⚠️ Reset Progress (Move Cards to New)
              </button>
            </div>
            <Link to="/decks" className="btn-study-tool" style={{ textDecoration: 'none' }}>Return to Decks</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="card-viewer-area">
            {/* Front Prompt */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div className="card-prompt" style={{ flex: 1 }}>{currentCard.prompt}</div>
              {canCreate && (
                <button
                  className="btn-study-tool"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap', borderColor: '#0d6efd', color: '#0d6efd' }}
                  onClick={() => setLinkerModalCard(currentCard)}
                >
                  🔗 Link Exercises
                </button>
              )}
            </div>

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

                  {/* Linked Exercises Section */}
                  {linkedExercises.length > 0 && (
                    <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #e9ecef' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>⚡ Linked Coding Exercises ({linkedExercises.length})</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {linkedExercises.map(ex => (
                          <Link
                            key={ex.id}
                            to="/exercises"
                            style={{
                              textDecoration: 'none',
                              padding: '6px 12px',
                              background: '#fff',
                              border: '1px solid #0d6efd',
                              borderRadius: 6,
                              color: '#0d6efd',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <span>▶ {ex.title}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({ex.language})</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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

      {/* Card Exercise Linker Modal */}
      {linkerModalCard && (
        <CardExerciseLinkerModal
          card={linkerModalCard}
          onClose={() => setLinkerModalCard(null)}
          onUpdated={loadQueue}
        />
      )}
    </div>
  )
}

function CardExerciseLinkerModal({ card, onClose, onUpdated }) {
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'create'
  const [exercises, setExercises] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Inline creation form state
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('python')
  const [description, setDescription] = useState('')
  const [starterCode, setStarterCode] = useState('')
  const [solutionCode, setSolutionCode] = useState('')
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const m = await import('../api.js')
      const [allExs, cardExs] = await Promise.all([
        m.getExercises().catch(() => []),
        m.getCardExercises(card.id).catch(() => [])
      ])
      setExercises(allExs || [])
      setLinkedIds(new Set((cardExs || []).map(e => e.id)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [card.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleLink = async (exerciseId) => {
    const isLinked = linkedIds.has(exerciseId)
    try {
      const m = await import('../api.js')
      if (isLinked) {
        await m.unlinkCardExercise(card.id, exerciseId)
        setLinkedIds(prev => { const next = new Set(prev); next.delete(exerciseId); return next })
      } else {
        await m.linkCardExercise(card.id, exerciseId)
        setLinkedIds(prev => new Set(prev).add(exerciseId))
      }
      if (onUpdated) onUpdated()
    } catch (err) {
      alert('Link action failed: ' + (err.message || err))
    }
  }

  const handleCreateAndLink = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const m = await import('../api.js')
      const newEx = await m.createExercise({
        title,
        language,
        description,
        starterCode,
        solutionCode
      })
      await m.linkCardExercise(card.id, newEx.id)
      alert(`Created and linked "${title}" to card!`)
      setTitle('')
      setDescription('')
      setStarterCode('')
      setSolutionCode('')
      setActiveTab('search')
      await loadData()
      if (onUpdated) onUpdated()
    } catch (err) {
      alert('Create exercise failed: ' + (err.message || err))
    } finally {
      setCreating(false)
    }
  }

  const filteredExercises = exercises.filter(ex => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return ex.title.toLowerCase().includes(q) ||
           ex.language.toLowerCase().includes(q) ||
           (ex.description && ex.description.toLowerCase().includes(q))
  })

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          margin: 'auto',
          width: '90%',
          maxWidth: 750,
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>🔗 Link Coding Exercises</h3>
            <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>Card: "{card.prompt.length > 45 ? card.prompt.substring(0, 45) + '...' : card.prompt}"</span>
          </div>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid #dee2e6', background: '#fff' }}>
          <button
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'search' ? '3px solid #0d6efd' : 'none',
              background: activeTab === 'search' ? '#fff' : '#f8f9fa',
              fontWeight: activeTab === 'search' ? 600 : 400,
              color: activeTab === 'search' ? '#0d6efd' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('search')}
          >
            🔍 Search & Link ({linkedIds.size} Linked)
          </button>
          <button
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'create' ? '3px solid #0d6efd' : 'none',
              background: activeTab === 'create' ? '#fff' : '#f8f9fa',
              fontWeight: activeTab === 'create' ? 600 : 400,
              color: activeTab === 'create' ? '#0d6efd' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('create')}
          >
            + Create & Link New Exercise
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'search' ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <input
                  className="form-control"
                  placeholder="Type keyword to filter exercises (e.g. 'Python', 'Reverse', 'Even')..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>Loading exercises catalog...</div>
              ) : filteredExercises.length === 0 ? (
                <div className="empty-state">No matching exercises found. Try another search or create a new exercise in the tab above!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredExercises.map(ex => {
                    const isLinked = linkedIds.has(ex.id)
                    return (
                      <div
                        key={ex.id}
                        style={{
                          padding: 12,
                          border: isLinked ? '1px solid #198754' : '1px solid #dee2e6',
                          borderRadius: 8,
                          background: isLinked ? '#f8fff9' : '#fff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <strong style={{ fontSize: '0.95rem' }}>{ex.title}</strong>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#eee' }}>
                              {ex.language}
                            </span>
                          </div>
                          {ex.description && (
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#6c757d', maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ex.description}
                            </p>
                          )}
                        </div>

                        <button
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: isLinked ? '#198754' : '#0d6efd',
                            color: '#fff'
                          }}
                          onClick={() => handleToggleLink(ex.id)}
                        >
                          {isLinked ? '✓ Linked' : '+ Link'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateAndLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Exercise Title</label>
                  <input className="form-control" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Check Prime Number" required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Language</label>
                  <select className="form-control" value={language} onChange={e=>setLanguage(e.target.value)}>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="csharp">C#</option>
                    <option value="go">Go</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Instructions / Description</label>
                <textarea className="form-control" rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the problem..." />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Starter Code Template</label>
                <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={starterCode} onChange={e=>setStarterCode(e.target.value)} placeholder="initial function signature..." />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Solution Code (or Assertion Test Suite)</label>
                <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={solutionCode} onChange={e=>setSolutionCode(e.target.value)} placeholder="reference solution code..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating & Linking...' : 'Save & Link to Card 🔗'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
