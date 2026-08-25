import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import ExerciseRenderer from '../components/ExerciseComponents'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import CopyModal from '../components/CopyModal'
import AuthModal from '../components/AuthModal'
import MarkdownViewer from '../components/MarkdownViewer'
import MarkdownField from '../components/MarkdownField'
import CardExerciseLinkerModal from '../components/CardExerciseLinkerModal'
import ConvertFollowupModal from '../components/ConvertFollowupModal'
import LinkedCardsPreviewModal from '../components/LinkedCardsPreviewModal'
import { getTagBadge, langBadgeFor, normalizeTag, POPULAR_TOPIC_TAGS } from '../utils/tagUtils'
import * as api from '../api'

export default function Deck(){
  const { activeStudyGroup } = useStudyGroup() || {}
  const { id } = useParams()
  const [copyModalCard, setCopyModalCard] = useState(null)
  const [authModalConfig, setAuthModalConfig] = useState({ isOpen: false, title: '', subtitle: '', intent: null })

  const token = localStorage.getItem('ankix_token')
  const isGuest = !token

  const [deck, setDeck]           = useState(null)
  const [queue, setQueue]         = useState({ newCount:0, learningCount:0, reviewCount:0, dueCards:[] })
  const [allCards, setAllCards]   = useState([])  // for the edit drawer
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer]     = useState(false)
  const [userCode, setUserCode]         = useState('')

  const [loading, setLoading]           = useState(true)
  const [isResetting, setIsResetting]   = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState(null)

  // Add Card Drawer state
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false)
  const [newPrompt, setNewPrompt]             = useState('')
  const [newAnswer, setNewAnswer]             = useState('')
  const [isAddingCard, setIsAddingCard]       = useState(false)

  // Inline Edit Current Card state
  const [isEditingCurrent, setIsEditingCurrent] = useState(false)
  const [editPrompt, setEditPrompt]             = useState('')
  const [editAnswer, setEditAnswer]             = useState('')
  const [isSavingEdit, setIsSavingEdit]         = useState(false)

  // Followups & Linked Exercises
  const [showFollowups, setShowFollowups]             = useState(false)
  const [showLinkedExercises, setShowLinkedExercises] = useState(false)
  const [followups, setFollowups]                     = useState([])
  const [followupsLoading, setFollowupsLoading]       = useState(false)
  const [newQuestion, setNewQuestion]                 = useState('')
  const [submittingFollowup, setSubmittingFollowup]   = useState(false)

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
    setLoading(true)
    try {
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
      setShowLinkedExercises(false)
      setFollowups([])
      setLinkedExercises([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    setCanCreate(api.canCreateContent(activeStudyGroup?.role))
    loadQueue()
  }, [id, loadQueue, activeStudyGroup?.role])

  const dueCards   = isGuest ? (allCards || []) : (queue.dueCards || [])
  const currentCard = dueCards[currentIndex]

  // Reset followup panel and fetch linked exercises whenever the card changes
  useEffect(() => {
    setShowFollowups(false)
    setShowLinkedExercises(false)
    setIsEditingCurrent(false)
    setFollowups([])
    setNewQuestion('')
    setLinkedExercises([])

    const currentCardId = dueCards?.[currentIndex]?.id
    if (currentCardId) {
      api.getCardExercises(currentCardId)
        .then(exs => setLinkedExercises(exs || []))
        .catch(() => setLinkedExercises([]))
    }
  }, [currentIndex, dueCards])

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
    setShowLinkedExercises(false)
  }

  const handleToggleLinkedExercises = () => {
    setShowLinkedExercises(prev => !prev)
    setShowFollowups(false)
  }

  const handleSubmitFollowup = async (e) => {
    e.preventDefault()
    if (!newQuestion.trim() || !currentCard) return
    if (isGuest) {
      setAuthModalConfig({
        isOpen: true,
        title: 'Sign In to Post Follow-Up Questions',
        subtitle: 'Create a free account or sign in to ask questions on flashcards and join community discussions.',
        intent: { returnUrl: `/decks/${id}`, action: 'followup' }
      })
      return
    }
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
  // After rating: advance to next card. In guest mode, ratings are ephemeral without SM-2 sync.
  const rateCard = async (outcome) => {
    if (isGuest) {
      const nextIndex = currentIndex + 1
      if (nextIndex >= dueCards.length) {
        setCurrentIndex(dueCards.length)
      } else {
        setCurrentIndex(nextIndex)
        setShowAnswer(false)
        setUserCode('')
      }
      return
    }

    setSubmittingRating(true)
    try {
      await api.submitReview(currentCard.id, outcome)
    } catch(err) {
      console.warn('Review submission failed (continuing study):', err.message || err)
    } finally {
      setSubmittingRating(false)
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

  // ── Card Edit & Management ────────────────────────────────────────────────
  const handleStartEdit = () => {
    if (!currentCard) return
    setEditPrompt(currentCard.prompt || '')
    setEditAnswer(currentCard.answer || currentCard.validationSpec || '')
    setIsEditingCurrent(true)
  }

  const handleCancelEdit = () => {
    setIsEditingCurrent(false)
    if (currentCard) {
      setEditPrompt(currentCard.prompt || '')
      setEditAnswer(currentCard.answer || currentCard.validationSpec || '')
    }
  }

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault()
    if (!currentCard || !editPrompt.trim() || !editAnswer.trim()) return
    setIsSavingEdit(true)
    try {
      await api.updateCard(currentCard.id, editPrompt.trim(), editAnswer.trim(), currentCard.type || 'basic')
      const updated = { ...currentCard, prompt: editPrompt.trim(), answer: editAnswer.trim() }
      setAllCards(prev => prev.map(c => c.id === currentCard.id ? updated : c))
      setQueue(prev => ({
        ...prev,
        dueCards: (prev.dueCards || []).map(c => c.id === currentCard.id ? updated : c)
      }))
      setIsEditingCurrent(false)
    } catch (err) {
      alert('Update card failed: ' + (err.message || err))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleAddCard = async (e) => {
    e.preventDefault()
    if (!newPrompt.trim() || !newAnswer.trim()) return
    setIsAddingCard(true)
    try {
      const c = await api.createCard(id, newPrompt.trim(), newAnswer.trim(), 'basic')
      setAllCards(prev => [...prev, c])
      setNewPrompt('')
      setNewAnswer('')
      await loadQueue() // refresh queue counts
    } catch (err) {
      alert('Create card failed: ' + (err.message || err))
    } finally {
      setIsAddingCard(false)
    }
  }

  const handleDeleteCurrentCard = async () => {
    if (!currentCard) return
    if (!confirm('Are you sure you want to delete this card?')) return
    const cardId = currentCard.id
    setDeletingCardId(cardId)
    try {
      await api.deleteCard(id, cardId)
      setAllCards(prev => prev.filter(c => c.id !== cardId))
      setQueue(prev => ({
        ...prev,
        dueCards: (prev.dueCards || []).filter(c => c.id !== cardId)
      }))
      setIsEditingCurrent(false)
      await loadQueue()
    } catch (err) {
      alert('Delete failed: ' + (err.message || err))
    } finally {
      setDeletingCardId(null)
    }
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
    setIsResetting(true)
    try{
      await api.resetDeckProgress(id)
      await loadQueue()
      alert('Deck progress reset successfully! All cards are now back in your New Queue.')
    }catch(err){ alert('Reset progress failed: ' + (err.message || err)) }
    finally { setIsResetting(false) }
  }

  return (
    <div className="study-container">
      {/* Top Toolbar */}
      <div className="study-top-bar">
        <div className="study-toolbar-left">
          {canCreate && (
            <>
              {currentCard && (
                <button
                  className="btn-study-tool"
                  onClick={() => isEditingCurrent ? handleCancelEdit() : handleStartEdit()}
                >
                  {isEditingCurrent ? 'Cancel Edit' : 'Edit'}
                </button>
              )}
              <button
                className="btn-study-tool"
                onClick={() => setIsAddDrawerOpen(prev => !prev)}
              >
                {isAddDrawerOpen ? 'Close Add' : '+ Add Card'}
              </button>
              <button
                className="btn-study-tool"
                style={{ fontWeight: 600, color: '#0d6efd', borderColor: '#0d6efd' }}
                onClick={() => setShowImportModal(true)}
              >
                📥 Import Cards
              </button>
            </>
          )}
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

      {/* Add Card Drawer — bottom sheet on mobile */}
      {isAddDrawerOpen && canCreate && (
        <div
          className="mobile-bottom-sheet-overlay"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddDrawerOpen(false) }}
        >
          <div
            className="mobile-bottom-sheet-content"
            style={{ background: '#fff', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 750, maxHeight: '85vh', overflowY: 'auto', padding: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}
          >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Add New Card to Deck</h3>
            <button
              type="button"
              className="btn-study-tool"
              style={{ fontSize: '0.8rem', padding: '2px 8px' }}
              onClick={() => setIsAddDrawerOpen(false)}
            >
              ✕ Close
            </button>
          </div>
          <form onSubmit={handleAddCard}>
            <MarkdownField
              label="Question / Prompt"
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              placeholder="Type card question or prompt using Markdown (supports ```code, **bold**, etc.)..."
              required
              rows={3}
            />
            <MarkdownField
              label="Answer"
              value={newAnswer}
              onChange={e => setNewAnswer(e.target.value)}
              placeholder="Type answer in Markdown with syntax-highlighted code blocks, explanations, etc..."
              required
              rows={4}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={isAddingCard || !newPrompt.trim() || !newAnswer.trim()}
              >
                {isAddingCard ? 'Adding Card...' : 'Add Flashcard'}
              </button>
              <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                Form stays open for rapid card entry.
              </span>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Card Viewer Area */}
      {loading ? (
        <div className="empty-state">
          <h3>Fetching deck cards...</h3>
        </div>
      ) : allCards.length === 0 ? (
        <div className="empty-state">
          <h3>No cards in this deck yet.</h3>
          <p>Click the <strong>+ Add Card</strong> button above to add cards!</p>
        </div>
      ) : dueCards.length === 0 || currentIndex >= dueCards.length ? (
        <div className="empty-state">
          <h2>🎉 {isGuest ? 'Deck Preview Completed!' : 'All done!'}</h2>
          <p style={{ fontSize: '1.1rem', color: '#495057', maxWidth: 500, margin: '8px auto 20px' }}>
            {isGuest
              ? `You have previewed all ${allCards.length} cards in this deck. In Guest Mode, review ratings and spaced repetition intervals are not saved.`
              : 'No cards due right now. Check back soon — learning cards reappear in minutes!'}
          </p>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            {isGuest ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '10px 22px', fontSize: '0.95rem' }}
                  onClick={() => setAuthModalConfig({
                    isOpen: true,
                    title: 'Activate Full Spaced Repetition (SM-2)',
                    subtitle: 'Create a free account to track review logs, schedule cards with SM-2, and maintain daily learning streaks.',
                    intent: { returnUrl: `/decks/${id}`, action: 'study_deck' }
                  })}
                >
                  🚀 Unlock SM-2 & Streaks Free
                </button>
                <button
                  className="btn-study-tool"
                  onClick={() => {
                    setCurrentIndex(0)
                    setShowAnswer(false)
                    setUserCode('')
                  }}
                >
                  🔄 Restart Preview
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={loadQueue}>🔄 Sync & Check Due Cards</button>
                <button 
                  className="btn-study-tool" 
                  style={{ color: '#dc3545', borderColor: '#dc3545' }} 
                  disabled={isResetting}
                  onClick={handleResetProgress}
                >
                  {isResetting ? 'Resetting...' : '⚠️ Reset Progress (Move Cards to New)'}
                </button>
              </div>
            )}
            <Link to="/decks" className="btn-study-tool" style={{ textDecoration: 'none' }}>Return to Decks</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {isEditingCurrent ? (
            <div className="form-card" style={{ width: '100%', maxWidth: 750, margin: '0 auto 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Edit Flashcard</h3>
                <button
                  type="button"
                  className="btn-study-tool"
                  style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                  onClick={handleCancelEdit}
                >
                  ✕ Cancel
                </button>
              </div>
              <form onSubmit={handleSaveEdit}>
                <MarkdownField
                  label="Question / Prompt"
                  value={editPrompt}
                  onChange={e => setEditPrompt(e.target.value)}
                  placeholder="Type card question or prompt using Markdown..."
                  required
                  rows={3}
                />
                <MarkdownField
                  label="Answer"
                  value={editAnswer}
                  onChange={e => setEditAnswer(e.target.value)}
                  placeholder="Type answer in Markdown..."
                  required
                  rows={4}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSavingEdit || !editPrompt.trim() || !editAnswer.trim()}
                  >
                    {isSavingEdit ? 'Saving...' : '💾 Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="btn-study-tool"
                    onClick={handleCancelEdit}
                    disabled={isSavingEdit}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card-viewer-area">
              {/* Front Prompt */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                <div className="card-prompt" style={{ flex: 1 }}>
                  <MarkdownViewer content={currentCard.prompt} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  {canCreate && (
                    <button
                      className="btn-study-tool"
                      style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                      onClick={handleStartEdit}
                    >
                      ✏️ Edit
                    </button>
                  )}
                  <button
                    className="btn-study-tool"
                    style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap', borderColor: '#0d6efd', color: '#0d6efd' }}
                    onClick={() => setCopyModalCard(currentCard)}
                  >
                    📋 Copy Card
                  </button>
                  {canCreate && (
                    <>
                      <button
                        className="btn-study-tool"
                        style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap', borderColor: '#0d6efd', color: '#0d6efd' }}
                        onClick={() => setLinkerModalCard(currentCard)}
                      >
                        🔗 Link Exercises
                      </button>
                      <button
                        className="btn-study-tool"
                        style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap', borderColor: '#dc3545', color: '#dc3545' }}
                        disabled={deletingCardId === currentCard.id}
                        onClick={handleDeleteCurrentCard}
                      >
                        {deletingCardId === currentCard.id ? 'Deleting...' : '🗑️ Delete'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Answer Section — revealed after Show Answer */}
              {showAnswer && (
                <>
                  <hr className="card-divider" />
                  <div className="card-answer">
                    <MarkdownViewer content={currentCard.answer || currentCard.validationSpec || 'Correct answer verified.'} />
                  </div>

                  {/* ── Followups & Linked Exercises Toggles (Only visible after answer is shown) ── */}
                  <div className="followups-wrapper">
                    <div className="followups-header">
                      <button className="btn-followups-toggle" onClick={handleToggleFollowups}>
                        {showFollowups ? '▲ Hide Follow-ups' : '▼ Follow-ups'}
                        {followups.length > 0 && !showFollowups && (
                          <span className="followups-badge">{followups.length}</span>
                        )}
                      </button>

                      {linkedExercises.length > 0 && (
                        <button className="btn-followups-toggle" onClick={handleToggleLinkedExercises}>
                          {showLinkedExercises ? '▲ Hide Linked Exercises' : '▼ Linked Exercises'}
                          {!showLinkedExercises && (
                            <span className="followups-badge">{linkedExercises.length}</span>
                          )}
                        </button>
                      )}
                    </div>

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
                                  <span className="followup-author">{api.getEffectiveDisplayName(f.authorDisplayName, f.authorDisplayName)}</span>
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

                    {showLinkedExercises && (
                      <div className="followups-panel">
                        <ul className="followups-list">
                          {linkedExercises.map((ex, idx) => (
                            <li key={ex.id} className="followup-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <strong style={{ fontSize: '0.95rem', color: '#212529' }}>⚡ {ex.title}</strong>
                                  {ex.language && (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      background: langBadgeFor(ex.language).bg,
                                      color: langBadgeFor(ex.language).color,
                                      fontWeight: 600
                                    }}>
                                      {langBadgeFor(ex.language).label}
                                    </span>
                                  )}
                                </div>
                                {ex.description && (
                                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6c757d' }}>{ex.description}</p>
                                )}
                              </div>
                              <button
                                className="btn-study-tool"
                                style={{ fontSize: '0.8rem', padding: '4px 12px', color: '#0d6efd', borderColor: '#0d6efd', fontWeight: 600, whiteSpace: 'nowrap' }}
                                onClick={() => setActivePracticeModal({ exercises: linkedExercises, initialIndex: idx })}
                              >
                                ▶ Practice ➔
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {!isEditingCurrent && (
            <div className="study-bottom-bar">
              {!showAnswer ? (
                <button className="btn-show-answer" onClick={() => setShowAnswer(true)}>
                  Show Answer
                </button>
              ) : (
                <div className="rating-buttons-group">
                  <div className="rating-col">
                    <span className="rating-interval">&lt;1m</span>
                    <button className="btn-rating again" disabled={submittingRating} onClick={() => rateCard('Again')}>Again</button>
                  </div>
                  <div className="rating-col">
                    <span className="rating-interval">&lt;1m</span>
                    <button className="btn-rating" disabled={submittingRating} onClick={() => rateCard('Hard')}>Hard</button>
                  </div>
                  <div className="rating-col">
                    <span className="rating-interval">&lt;10m</span>
                    <button className="btn-rating" disabled={submittingRating} onClick={() => rateCard('Good')}>Good</button>
                  </div>
                  <div className="rating-col">
                    <span className="rating-interval">1d+</span>
                    <button className="btn-rating" disabled={submittingRating} onClick={() => rateCard('Easy')}>Easy</button>
                  </div>
                </div>
              )}
            </div>
          )}
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
        <LinkedCardsPreviewModal
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

      {/* Copy Card Modal */}
      <CopyModal
        isOpen={!!copyModalCard}
        onClose={() => setCopyModalCard(null)}
        itemType="card"
        item={copyModalCard}
        onSuccess={() => {
          alert('Card copied to deck successfully!')
          loadQueue()
        }}
      />

      <AuthModal
        {...authModalConfig}
        onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

function ExercisePracticeModal({ exercises, initialIndex = 0, onClose }) {
  const [activeIdx, setActiveIdx] = useState(initialIndex)
  const currentEx = exercises[activeIdx]

  const [practiceCode, setPracticeCode] = useState(currentEx?.starterCode || currentEx?.solutionCode || '')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [rating, setRating] = useState(false)

  useEffect(() => {
    let mounted = true
    if (currentEx) {
      if (!currentEx.starterCode && !currentEx.solutionCode) {
        import('../api.js').then(m => m.getExercise(currentEx.id))
          .then(fullEx => {
            if (!mounted) return
            setPracticeCode(fullEx.starterCode || fullEx.solutionCode || '')
          })
          .catch(() => {
            if (!mounted) return
            setPracticeCode(currentEx.starterCode || currentEx.solutionCode || '')
          })
      } else {
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
    setEnrolling(true)
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
    } finally {
      setEnrolling(false)
    }
  }

  const handleRunCode = async (submittedPayload) => {
    if (!currentEx) return
    setRunning(true)
    try {
      const codeToSubmit = typeof submittedPayload === 'string' ? submittedPayload : practiceCode
      const m = await import('../api.js')
      const targetLang = currentEx.language || 'csharp'
      const res = await m.runExerciseCode(currentEx.id, codeToSubmit, targetLang)
      setRunResult(res)
    } catch (err) {
      alert('Run failed: ' + (err.message || err))
    } finally {
      setRunning(false)
    }
  }

  const handleRateExercise = async (outcome) => {
    if (!currentEx) return
    setRating(true)
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
    } finally {
      setRating(false)
    }
  }

  if (!currentEx) return null

  const badge = langBadgeFor(currentEx.language)

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
              disabled={enrolling}
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
              {enrolling ? 'Updating...' : (isEnrolled ? '✓ In Collection' : '+ Add to My Exercises')}
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
              <strong style={{ display: 'block', marginBottom: 6 }}>Instructions:</strong>
              <MarkdownViewer content={currentEx.description} style={{ color: '#333' }} />
            </div>
          )}

          <ExerciseRenderer
            key={currentEx.id}
            exercise={currentEx}
            practiceCode={practiceCode}
            setPracticeCode={setPracticeCode}
            onRunCode={handleRunCode}
            running={running}
            runResult={runResult}
          />

          {/* Result Status Badge */}
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
                <button className="btn-rating again" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={rating} onClick={() => handleRateExercise('Again')}>Again (&lt;1m)</button>
                <button className="btn-rating" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={rating} onClick={() => handleRateExercise('Hard')}>Hard (&lt;1m)</button>
                <button className="btn-rating" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={rating} onClick={() => handleRateExercise('Good')}>Good (&lt;10m)</button>
                <button className="btn-rating" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={rating} onClick={() => handleRateExercise('Easy')}>Easy (1d+)</button>
              </div>
            </div>
          )}
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
    <div className="mobile-bottom-sheet-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="mobile-bottom-sheet-content" style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, pb: 12, borderBottom: '1px solid #e9ecef' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>📥 Import Cards into Deck</h3>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

        {/* Format Documentation Notice */}
        <div style={{ background: '#e7f5ff', border: '1px solid #a5d8ff', borderRadius: 8, padding: 14, fontSize: '0.85rem', color: '#1864ab', marginBottom: 16 }}>
          <strong>Supported Flat File Formats:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
            <li><strong>CSV / TSV (.csv, .tsv, .txt):</strong> <code>Prompt, Answer</code> (supports multi-line Markdown)</li>
            <li><strong>JSON (.json):</strong> <code>[ &#123; "prompt": "...", "answer": "..." &#125; ]</code></li>
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
                  placeholder={textFormat === 'json' ? '[\n  { "prompt": "What is binary search?", "answer": "O(log n)" }\n]' : 'Question 1, Answer 1\nQuestion 2, Answer 2'}
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
