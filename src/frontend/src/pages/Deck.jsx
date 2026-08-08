import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import ExerciseRenderer from '../components/ExerciseComponents'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import * as api from '../api'

export default function Deck(){
  const { activeStudyGroup } = useStudyGroup() || {}
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
  const [activePracticeModal, setActivePracticeModal] = useState(null)
  const [convertingFollowup, setConvertingFollowup] = useState(null)
  const [previewCardModal, setPreviewCardModal] = useState(null)
  const [canCreate, setCanCreate] = useState(false)

  const handleOpenLinkedCards = async (followup) => {
    try {
      const cardIds = followup.linkedCardIds && followup.linkedCardIds.length > 0
        ? followup.linkedCardIds
        : (followup.linkedCardId ? [followup.linkedCardId] : [])
      if (cardIds.length === 0) return
      const cards = await Promise.all(cardIds.map(id => api.getCard(id).catch(() => null)))
      const validCards = cards.filter(Boolean)
      if (validCards.length === 0) {
        alert('Could not load linked answer cards.')
        return
      }
      setPreviewCardModal({
        cards: validCards,
        initialIndex: 0,
        followup,
        parentCard: currentCard
      })
    } catch (err) {
      alert('Could not load derived cards: ' + (err.message || err))
    }
  }

  // ── Load deck info + study queue ──────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    const [d, q, cs] = await Promise.all([
      api.getDeck(id).catch(() => null),
      api.getStudyQueue(id).catch(() => ({ newCount:0, learningCount:0, reviewCount:0, dueCards:[] })),
      api.getCards(id).catch(() => [])
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
    setCanCreate(api.canCreateContent(activeStudyGroup?.role))
    loadQueue()
  }, [id, loadQueue, activeStudyGroup?.role])

  // Reset followup panel and fetch linked exercises whenever the card changes
  useEffect(() => {
    setShowFollowups(false)
    setFollowups([])
    setNewQuestion('')
    setLinkedExercises([])

    const currentCardId = queue?.dueCards?.[currentIndex]?.id
    if (currentCardId) {
      api.getCardExercises(currentCardId)
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
      const data = await api.getFollowups(cardId)
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
      const created = await api.addFollowup(currentCard.id, newQuestion.trim())
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
      await api.submitReview(currentCard.id, outcome)
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
      const c = await api.createCard(id, prompt, validationSpec, type)
      setAllCards(prev => [...prev, c])
      setPrompt(''); setValidationSpec(''); setType('basic')
      alert('Card added!')
      await loadQueue() // refresh queue counts
    }catch(err){ alert('Create card failed: ' + (err.message || err)) }
  }

  const removeCard = async (cardId) => {
    if(!confirm('Delete card?')) return
    try{
      await api.deleteCard(id, cardId)
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

  // Import Modal state
  const [showImportModal, setShowImportModal] = useState(false)

  const handleResetProgress = async () => {
    if(!confirm('Are you sure you want to reset your study progress for this deck? All cards will be returned to your New Queue.')) return
    try{
      await api.resetDeckProgress(id)
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
              <button className="btn-study-tool" style={{ fontWeight: 600, color: '#0d6efd', borderColor: '#0d6efd' }} onClick={() => setShowImportModal(true)}>
                📥 Import Cards
              </button>
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
                              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                {(f.linkedCardIds?.length > 0 || f.linkedCardId) && (
                                  <button
                                    className="btn-study-tool"
                                    style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      color: '#198754',
                                      borderColor: '#198754',
                                      background: '#f8fff9',
                                      cursor: 'pointer',
                                      padding: '2px 8px'
                                    }}
                                    onClick={() => handleOpenLinkedCards(f)}
                                  >
                                    ✓ Answered by {(f.linkedCardIds?.length || 1)} card{(f.linkedCardIds?.length > 1) ? 's' : ''} ➔
                                  </button>
                                )}

                                {canCreate && (
                                  <button
                                    className="btn-study-tool"
                                    style={{ fontSize: '0.75rem', padding: '2px 8px', borderColor: '#0d6efd', color: '#0d6efd' }}
                                    onClick={() => setConvertingFollowup(f)}
                                  >
                                    + Answer with Card 🎴
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Linked Exercises Section — inside followups wrapper */}
                </div>
              </>
            )}

            {/* Linked Exercises Section — visible always (before and after answer reveal) */}
            {linkedExercises.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #e9ecef' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚡ Linked Coding Exercises ({linkedExercises.length})</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {linkedExercises.map((ex, idx) => (
                    <button
                      key={ex.id}
                      style={{
                        border: '1px solid #0d6efd',
                        background: '#fff',
                        borderRadius: 6,
                        color: '#0d6efd',
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                      onClick={() => setActivePracticeModal({ exercises: linkedExercises, initialIndex: idx })}
                    >
                      <span>▶ {ex.title}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({ex.language})</span>
                    </button>
                  ))}
                </div>
              </div>
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

      {/* Immersive Exercise Practice Modal */}
      {activePracticeModal && (
        <ExercisePracticeModal
          exercises={activePracticeModal.exercises}
          initialIndex={activePracticeModal.initialIndex}
          onClose={() => setActivePracticeModal(null)}
        />
      )}

      {/* Convert Followup to Card Modal */}
      {convertingFollowup && (
        <ConvertFollowupModal
          followup={convertingFollowup}
          parentCard={currentCard}
          currentDeckId={id}
          onClose={() => setConvertingFollowup(null)}
          onConverted={() => loadFollowups(currentCard?.id)}
        />
      )}

      {/* Derived Standalone Card Preview / Multi-Card Carousel Modal */}
      {previewCardModal && (
        <CardPreviewModal
          modalData={previewCardModal}
          onClose={() => setPreviewCardModal(null)}
          onUnlinked={() => loadFollowups(currentCard?.id)}
        />
      )}

      {/* Flat File Card Import Modal */}
      {showImportModal && (
        <ImportCardsModal
          deckId={id}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={loadQueue}
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

function ExercisePracticeModal({ exercises, initialIndex = 0, onClose }) {
  const [activeIdx, setActiveIdx] = useState(initialIndex)
  const currentEx = exercises[activeIdx]

  const [practiceLang, setPracticeLang] = useState(currentEx?.language || 'python')
  const [practiceCode, setPracticeCode] = useState(currentEx?.starterCode || currentEx?.solutionCode || '')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)

  const langBadges = {
    csharp: { label: 'C#', color: '#68217a', bg: '#f2e6f7' },
    python: { label: 'Python', color: '#3572A5', bg: '#e8f2fc' },
    javascript: { label: 'JavaScript', color: '#f1e05a', bg: '#fffde6' },
    go: { label: 'Go', color: '#00ADD8', bg: '#e6f9fc' }
  }

  useEffect(() => {
    let mounted = true
    if (currentEx) {
      if (!currentEx.starterCode && !currentEx.solutionCode) {
        import('../api.js').then(m => m.getExercise(currentEx.id))
          .then(fullEx => {
            if (!mounted) return
            setPracticeLang(fullEx.language || 'python')
            setPracticeCode(fullEx.starterCode || fullEx.solutionCode || '')
          })
          .catch(() => {
            if (!mounted) return
            setPracticeLang(currentEx.language || 'python')
            setPracticeCode(currentEx.starterCode || currentEx.solutionCode || '')
          })
      } else {
        setPracticeLang(currentEx.language || 'python')
        setPracticeCode(currentEx.starterCode || currentEx.solutionCode || '')
      }
      setRunResult(null)

      import('../api.js').then(m => m.getMyCollectionExerciseIds()).then(ids => {
        if (mounted) setIsEnrolled((ids || []).includes(currentEx.id))
      }).catch(() => {})
    }
    return () => { mounted = false }
  }, [currentEx])

  const [isEnrolled, setIsEnrolled] = useState(false)

  const handleToggleEnroll = async () => {
    if (!currentEx?.id) return
    try {
      const m = await import('../api.js')
      if (isEnrolled) {
        await m.unenrollExercise(currentEx.id)
        setIsEnrolled(false)
      } else {
        await m.enrollExercise(currentEx.id)
        setIsEnrolled(true)
      }
    } catch (err) {
      alert('Failed to update collection: ' + (err.message || err))
    }
  }

  const handleRunCode = async (submittedPayload) => {
    if (!currentEx) return
    setRunning(true)
    try {
      const codeToSubmit = typeof submittedPayload === 'string' ? submittedPayload : practiceCode
      const m = await import('../api.js')
      const res = await m.runExerciseCode(currentEx.id, codeToSubmit, practiceLang)
      setRunResult(res)
    } catch (err) {
      alert('Run failed: ' + (err.message || err))
    } finally {
      setRunning(false)
    }
  }

  const handleRateExercise = async (outcome) => {
    if (!currentEx) return
    try {
      const m = await import('../api.js')
      const res = await m.submitExerciseReview(currentEx.id, outcome)
      setIsEnrolled(true)
      alert(`Exercise rating submitted (${outcome})! Next review: ${new Date(res.nextReviewAt).toLocaleDateString()}`)
      setRunResult(null)
      if (activeIdx < exercises.length - 1) {
        setActiveIdx(prev => prev + 1)
      }
    } catch (err) {
      alert('Submit review failed: ' + (err.message || err))
    }
  }

  if (!currentEx) return null

  const badge = langBadges[currentEx.language] || { label: currentEx.language, color: '#333', bg: '#eee' }

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
          maxWidth: 820,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>⚡ {currentEx.title}</h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
            <button
              className="btn-study-tool"
              style={{
                padding: '3px 10px',
                fontSize: '0.75rem',
                background: isEnrolled ? '#d3f9d8' : '#e7f5ff',
                color: isEnrolled ? '#2b8a3e' : '#1864ab',
                borderColor: isEnrolled ? '#2b8a3e' : '#1864ab',
                fontWeight: 600
              }}
              onClick={handleToggleEnroll}
            >
              {isEnrolled ? '✓ In Collection' : '+ Add to My Exercises'}
            </button>
          </div>

          {/* Carousel Stepper Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {exercises.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e9ecef', padding: '4px 10px', borderRadius: 6 }}>
                <button
                  style={{ border: 'none', background: 'none', cursor: activeIdx > 0 ? 'pointer' : 'default', fontWeight: 700, opacity: activeIdx > 0 ? 1 : 0.4 }}
                  onClick={() => activeIdx > 0 && setActiveIdx(activeIdx - 1)}
                  disabled={activeIdx === 0}
                >
                  ‹ Prev
                </button>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057' }}>
                  Exercise {activeIdx + 1} of {exercises.length}
                </span>
                <button
                  style={{ border: 'none', background: 'none', cursor: activeIdx < exercises.length - 1 ? 'pointer' : 'default', fontWeight: 700, opacity: activeIdx < exercises.length - 1 ? 1 : 0.4 }}
                  onClick={() => activeIdx < exercises.length - 1 && setActiveIdx(activeIdx + 1)}
                  disabled={activeIdx === exercises.length - 1}
                >
                  Next ›
                </button>
              </div>
            )}
            <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d', padding: '0 4px' }} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {currentEx.description && (
            <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: '0.9rem', border: '1px solid #e9ecef' }}>
              <strong>Instructions:</strong>
              <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', color: '#333' }}>{currentEx.description}</p>
            </div>
          )}

          <ExerciseRenderer
            exercise={currentEx}
            practiceCode={practiceCode}
            setPracticeCode={setPracticeCode}
            practiceLang={practiceLang}
            setPracticeLang={setPracticeLang}
            onRunCode={handleRunCode}
            running={running}
            runResult={runResult}
          />

          {/* Action & Status Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <button className="btn-primary" onClick={handleRunCode} disabled={running} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
              {running ? 'Running Solution...' : '▶ Run Solution'}
            </button>

            {runResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: runResult.passed ? '#d4edda' : '#f8d7da',
                  color: runResult.passed ? '#155724' : '#721c24'
                }}>
                  {runResult.passed ? '✓ PASS' : '✗ FAIL'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                  ({runResult.durationMs}ms)
                </span>
              </div>
            )}
          </div>

          {/* Output Details Box (Scrollable max-height) */}
          {runResult?.details && (
            <div style={{
              padding: 14,
              borderRadius: 8,
              background: runResult.passed ? '#f8f9fa' : '#fff5f5',
              color: runResult.passed ? '#212529' : '#c92a2a',
              fontSize: '0.85rem',
              fontFamily: 'Consolas, Monaco, monospace',
              border: runResult.passed ? '1px solid #e9ecef' : '1px solid #ffc9c9',
              maxHeight: 200,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {runResult.details}
            </div>
          )}

          {/* SM-2 Retention Rating Section */}
          {runResult?.passed && (
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #e9ecef' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', marginBottom: 10, textAlign: 'center' }}>
                Rate your recall performance for SRS schedule:
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-rating again" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRateExercise('Again')}>Again (&lt;1m)</button>
                <button className="btn-rating" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRateExercise('Hard')}>Hard (&lt;1m)</button>
                <button className="btn-rating" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRateExercise('Good')}>Good (&lt;10m)</button>
                <button className="btn-rating" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRateExercise('Easy')}>Easy (1d+)</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConvertFollowupModal({ followup, parentCard, currentDeckId, onClose, onConverted }) {
  const [activeTab, setActiveTab] = useState('link') // 'link' | 'create'
  const [existingCards, setExistingCards] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingCards, setLoadingCards] = useState(true)

  const [decks, setDecks] = useState([])
  const [targetDeckId, setTargetDeckId] = useState(currentDeckId || '')
  const [validationSpec, setValidationSpec] = useState('')
  const [type, setType] = useState('basic')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    import('../api.js').then(m => Promise.all([
      m.getDecks().catch(() => []),
      m.getAllCards().catch(() => [])
    ])).then(([dData, cData]) => {
      if (!mounted) return
      setDecks(dData || [])
      if (!targetDeckId && dData && dData.length > 0) setTargetDeckId(dData[0].id)
      setExistingCards(cData || [])
      setLoadingCards(false)
    })
    return () => { mounted = false }
  }, [targetDeckId])

  const handleLinkExistingCard = async (existingCardId) => {
    setSaving(true)
    try {
      const m = await import('../api.js')
      await m.linkFollowupToCard(parentCard.id, followup.id, existingCardId)
      alert('Follow-up question successfully linked to existing card!')
      if (onConverted) onConverted()
      onClose()
    } catch (err) {
      alert('Link to card failed: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAndLink = async (e) => {
    e.preventDefault()
    if (!targetDeckId) return
    setSaving(true)
    try {
      const m = await import('../api.js')
      // 1. Create card in selected target deck with locked followup question as prompt
      const newCard = await m.createCard(targetDeckId, followup.questionText, validationSpec, type)

      // 2. Link followup question to new card
      await m.linkFollowupToCard(parentCard.id, followup.id, newCard.id)
      alert('Follow-up question converted to a new standalone card and linked!')
      if (onConverted) onConverted()
      onClose()
    } catch (err) {
      alert('Convert failed: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const filteredCards = existingCards.filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return c.prompt.toLowerCase().includes(q) ||
           (c.validationSpec && c.validationSpec.toLowerCase().includes(q))
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
        {/* Header Bar */}
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>🎴 Resolve Follow-up Question</h3>
            <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>Question: "{followup.questionText.length > 50 ? followup.questionText.substring(0, 50) + '...' : followup.questionText}"</span>
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
              borderBottom: activeTab === 'link' ? '3px solid #0d6efd' : 'none',
              background: activeTab === 'link' ? '#fff' : '#f8f9fa',
              fontWeight: activeTab === 'link' ? 600 : 400,
              color: activeTab === 'link' ? '#0d6efd' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('link')}
          >
            🔗 Link to Existing Card ({existingCards.length})
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
            + Create New Standalone Card
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'link' ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <input
                  className="form-control"
                  placeholder="Type keyword to search existing cards by prompt or answer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {loadingCards ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>Loading cards catalog...</div>
              ) : filteredCards.length === 0 ? (
                <div className="empty-state">No matching cards found. Try another search or create a new card in the tab above!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredCards.map(c => (
                    <div
                      key={c.id}
                      style={{
                        padding: 12,
                        border: '1px solid #dee2e6',
                        borderRadius: 8,
                        background: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <strong style={{ fontSize: '0.95rem' }}>{c.prompt}</strong>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#e7f5ff', color: '#1864ab' }}>
                            {c.type}
                          </span>
                        </div>
                        {c.validationSpec && (
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6c757d', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Answer: {c.validationSpec}
                          </p>
                        )}
                      </div>

                      <button
                        className="btn-primary"
                        disabled={saving}
                        style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                        onClick={() => handleLinkExistingCard(c.id)}
                      >
                        Link to this Card 🔗
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateAndLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Read-Only Question Prompt Field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Question / Prompt</label>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#6c757d', color: '#fff' }}>
                    🔒 Read-Only Question Prompt
                  </span>
                </div>
                <input
                  className="form-control"
                  value={followup.questionText}
                  disabled
                  readOnly
                  style={{
                    background: '#e9ecef',
                    color: '#495057',
                    fontWeight: 500,
                    cursor: 'not-allowed',
                    border: '1px solid #ced4da'
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: 4, display: 'block' }}>
                  The original followup question prompt is locked and cannot be modified.
                </span>
              </div>

              {/* Target Deck & Card Type */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Target Deck</label>
                  <select
                    className="form-control"
                    value={targetDeckId}
                    onChange={e => setTargetDeckId(e.target.value)}
                    required
                  >
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Card Type</label>
                  <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                    <option value="basic">basic</option>
                    <option value="micro-coding">micro-coding</option>
                  </select>
                </div>
              </div>

              {/* Validation Spec / Answer Field */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Validation Spec / Answer</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder='Answer or JSON spec (e.g. {"answer":"4"})'
                  value={validationSpec}
                  onChange={e => setValidationSpec(e.target.value)}
                  style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.9rem' }}
                />
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid #e9ecef' }}>
                <button type="button" className="btn-study-tool" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Converting Card...' : 'Save & Link Standalone Card 🎴'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function CardPreviewModal({ modalData, onClose, onUnlinked }) {
  // Normalize modalData: could be single card or { cards, initialIndex, followup, parentCard }
  const cardsList = modalData.cards ? modalData.cards : [modalData]
  const followup = modalData.followup
  const parentCard = modalData.parentCard

  const [currentIndex, setCurrentIndex] = useState(modalData.initialIndex || 0)
  const [unlinking, setUnlinking] = useState(false)

  const currentCard = cardsList[currentIndex] || cardsList[0]

  const handleUnlink = async () => {
    if (!followup || !parentCard || !currentCard) return
    if (!window.confirm(`Unlink this card ("${currentCard.prompt}") from the follow-up question?`)) return
    setUnlinking(true)
    try {
      const m = await import('../api.js')
      await m.unlinkFollowupCard(parentCard.id, followup.id, currentCard.id)
      alert('Card unlinked successfully!')
      if (onUnlinked) onUnlinked()
      onClose()
    } catch (err) {
      alert('Failed to unlink card: ' + (err.message || err))
    } finally {
      setUnlinking(false)
    }
  }

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
          maxWidth: 680,
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>🎴 Linked Answer Card</h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#0d6efd', color: '#fff' }}>
              {currentCard?.type || 'basic'}
            </span>
          </div>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

        {/* Carousel Stepper Bar (if multiple cards) */}
        {cardsList.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', background: '#e7f5ff', borderBottom: '1px solid #a5d8ff' }}>
            <button
              className="btn-study-tool"
              style={{ fontSize: '0.85rem', padding: '4px 12px' }}
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            >
              ‹ Prev Answer Card
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1864ab' }}>
              Card {currentIndex + 1} of {cardsList.length}
            </span>
            <button
              className="btn-study-tool"
              style={{ fontSize: '0.85rem', padding: '4px 12px' }}
              disabled={currentIndex === cardsList.length - 1}
              onClick={() => setCurrentIndex(prev => Math.min(cardsList.length - 1, prev + 1))}
            >
              Next Answer Card ›
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {followup && (
            <div style={{ padding: '8px 12px', background: '#f8f9fa', borderRadius: 6, borderLeft: '4px solid #0d6efd', fontSize: '0.85rem', color: '#495057' }}>
              <strong>Follow-up Question:</strong> "{followup.questionText}"
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>Card Question / Prompt</label>
            <div style={{ padding: 14, background: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6', fontSize: '1rem', fontWeight: 500, color: '#212529' }}>
              {currentCard?.prompt}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>Card Validation Spec / Answer</label>
            <div style={{ padding: 14, background: '#e7f5ff', borderRadius: 8, border: '1px solid #a5d8ff', fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.95rem', color: '#1864ab', whiteSpace: 'pre-wrap' }}>
              {currentCard?.validationSpec || 'No specific answer text configured.'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTop: '1px solid #e9ecef' }}>
            {followup ? (
              <button
                type="button"
                className="btn-study-tool"
                style={{ borderColor: '#dc3545', color: '#dc3545', fontSize: '0.85rem' }}
                disabled={unlinking}
                onClick={handleUnlink}
              >
                {unlinking ? 'Unlinking...' : 'Unlink this Card 🗑'}
              </button>
            ) : <div />}

            <Link to={`/decks/${currentCard?.deckId}`} style={{ textDecoration: 'none' }} onClick={onClose}>
              <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.9rem' }}>
                Open Target Deck ➔
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImportCardsModal({ deckId, onClose, onImportSuccess }) {
  const [importTab, setImportTab] = useState('file') // 'file' | 'text'
  const [selectedFile, setSelectedFile] = useState(null)
  const [rawText, setRawText] = useState('')
  const [textFormat, setTextFormat] = useState('csv')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorMsg('')
    }
  }

  const handleImport = async (e) => {
    if (e) e.preventDefault()
    setImporting(true)
    setErrorMsg('')
    setImportResult(null)

    try {
      const api = await import('../api.js')
      let res
      if (importTab === 'file') {
        if (!selectedFile) {
          setErrorMsg('Please select a file to import.')
          setImporting(false)
          return
        }
        res = await api.importCardsFile(deckId, selectedFile)
      } else {
        if (!rawText.trim()) {
          setErrorMsg('Please paste content to import.')
          setImporting(false)
          return
        }
        res = await api.importCardsText(deckId, rawText, textFormat)
      }

      setImportResult(res)
      if (onImportSuccess) onImportSuccess(res)
    } catch (err) {
      setErrorMsg(err.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, pb: 12, borderBottom: '1px solid #e9ecef' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>📥 Import Cards into Deck</h3>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

        {/* Format Documentation Notice */}
        <div style={{ background: '#e7f5ff', border: '1px solid #a5d8ff', borderRadius: 8, padding: 14, fontSize: '0.85rem', color: '#1864ab', marginBottom: 16 }}>
          <strong>Supported Flat File Formats:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
            <li><strong>CSV / TSV (.csv, .tsv, .txt):</strong> <code>Prompt, Answer</code> OR <code>Prompt, Type, ValidationSpec</code></li>
            <li><strong>JSON (.json):</strong> <code>[ &#123; "prompt": "...", "type": "basic", "validationSpec": "..." &#125; ]</code></li>
          </ul>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: 16 }}>
          <button
            style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: importTab === 'file' ? '3px solid #0d6efd' : '3px solid transparent', color: importTab === 'file' ? '#0d6efd' : '#495057' }}
            onClick={() => { setImportTab('file'); setErrorMsg(''); setImportResult(null); }}
          >
            📁 File Upload (.csv, .tsv, .json)
          </button>
          <button
            style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: importTab === 'text' ? '3px solid #0d6efd' : '3px solid transparent', color: importTab === 'text' ? '#0d6efd' : '#495057' }}
            onClick={() => { setImportTab('text'); setErrorMsg(''); setImportResult(null); }}
          >
            ✍️ Raw Text Paste
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#ffe3e3', color: '#e03131', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16, border: '1px solid #ffc9c9' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {importResult ? (
          <div style={{ background: '#d3f9d8', color: '#2b8a3e', padding: 16, borderRadius: 8, border: '1px solid #b2f2bb', marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 700 }}>🎉 Import Successful!</h4>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Successfully imported <strong>{importResult.importedCount}</strong> cards into this deck. (Skipped: {importResult.skippedCount})
            </p>

            {importResult.cards && importResult.cards.length > 0 && (
              <div style={{ marginTop: 12, maxHeight: 150, overflowY: 'auto', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #b2f2bb' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#333', marginBottom: 6 }}>Imported Cards Preview:</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#495057' }}>
                  {importResult.cards.map((c, i) => (
                    <li key={i}><strong>{c.prompt}</strong> ({c.type})</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={onClose}>Done & Refresh Queue</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {importTab === 'file' ? (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Flat File</label>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json"
                  className="form-control"
                  onChange={handleFileChange}
                  style={{ padding: 8 }}
                />
                {selectedFile && (
                  <div style={{ fontSize: '0.8rem', color: '#495057', marginTop: 6 }}>
                    Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Paste Raw Flat Text</label>
                  <select className="form-control" style={{ width: 'auto', padding: '2px 8px', fontSize: '0.8rem' }} value={textFormat} onChange={e => setTextFormat(e.target.value)}>
                    <option value="csv">CSV (Comma-separated)</option>
                    <option value="tsv">TSV (Tab-separated)</option>
                    <option value="json">JSON Array</option>
                  </select>
                </div>
                <textarea
                  className="form-control"
                  rows={8}
                  placeholder={textFormat === 'json' ? '[\n  { "prompt": "What is binary search?", "type": "basic", "validationSpec": "O(log n)" }\n]' : 'Question 1, Answer 1\nQuestion 2, Answer 2'}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-study-tool" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={importing}>
                {importing ? 'Importing Cards...' : '📥 Import Cards Now'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
