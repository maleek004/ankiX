import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MarkdownViewer from './MarkdownViewer'
import MarkdownField from './MarkdownField'
import CopyModal from './CopyModal'
import AuthModal from './AuthModal'
import ExercisePracticeModal from '../pages/Exercises'
import { getTagBadge, langBadgeFor, normalizeTag, POPULAR_TOPIC_TAGS } from '../utils/tagUtils'
import * as api from '../api'

export default function CardDetailModal({ card, onClose, onCardUpdated }) {
  const { activeStudyGroup } = useStudyGroup() || {}
  const navigate = useNavigate()

  const [currentCard, setCurrentCard] = useState(card)
  const [activeTab, setActiveTab] = useState('card') // 'card' | 'followups' | 'exercises'

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editPrompt, setEditPrompt] = useState(card?.prompt || '')
  const [editAnswer, setEditAnswer] = useState(card?.answer || card?.validationSpec || '')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Followups state
  const [followups, setFollowups] = useState([])
  const [followupsLoading, setFollowupsLoading] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [submittingFollowup, setSubmittingFollowup] = useState(false)
  const [convertingFollowup, setConvertingFollowup] = useState(null)
  const [previewAnswerCards, setPreviewAnswerCards] = useState(null)

  // Linked exercises state
  const [linkedExercises, setLinkedExercises] = useState([])
  const [exercisesLoading, setExercisesLoading] = useState(false)
  const [activePracticeModal, setActivePracticeModal] = useState(null)
  const [isLinkerOpen, setIsLinkerOpen] = useState(false)

  // Copy modal & Auth modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [authModalConfig, setAuthModalConfig] = useState({ isOpen: false, title: '', subtitle: '', intent: null })

  const token = localStorage.getItem('ankix_token')
  const isGuest = !token
  const canCreate = api.canCreateContent(activeStudyGroup?.role)

  useEffect(() => {
    setCurrentCard(card)
    setEditPrompt(card?.prompt || '')
    setEditAnswer(card?.answer || card?.validationSpec || '')
  }, [card])

  const loadFollowups = useCallback(async () => {
    if (!currentCard?.id) return
    setFollowupsLoading(true)
    try {
      const data = await api.getFollowups(currentCard.id)
      setFollowups(data || [])
    } catch (err) {
      console.warn('Could not load followups:', err.message || err)
    } finally {
      setFollowupsLoading(false)
    }
  }, [currentCard?.id])

  const loadLinkedExercises = useCallback(async () => {
    if (!currentCard?.id) return
    setExercisesLoading(true)
    try {
      const data = await api.getCardExercises(currentCard.id)
      setLinkedExercises(data || [])
    } catch (err) {
      console.warn('Could not load card exercises:', err.message || err)
    } finally {
      setExercisesLoading(false)
    }
  }, [currentCard?.id])

  useEffect(() => {
    loadFollowups()
    loadLinkedExercises()
  }, [loadFollowups, loadLinkedExercises])

  if (!currentCard) return null

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault()
    if (!editPrompt.trim() || !editAnswer.trim()) return
    setIsSavingEdit(true)
    try {
      await api.updateCard(currentCard.id, editPrompt.trim(), editAnswer.trim(), currentCard.type || 'basic')
      const updated = {
        ...currentCard,
        prompt: editPrompt.trim(),
        answer: editAnswer.trim()
      }
      setCurrentCard(updated)
      setIsEditing(false)
      if (onCardUpdated) {
        onCardUpdated(updated)
      }
    } catch (err) {
      alert('Failed to update card: ' + (err.message || err))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleSubmitFollowup = async (e) => {
    e.preventDefault()
    if (!newQuestion.trim()) return
    if (isGuest) {
      setAuthModalConfig({
        isOpen: true,
        title: 'Sign In to Post Follow-Up Questions',
        subtitle: 'Create a free account or sign in to ask questions on flashcards and join community discussions.',
        intent: { returnUrl: `/decks/${currentCard.deckId}`, action: 'followup' }
      })
      return
    }

    setSubmittingFollowup(true)
    try {
      const created = await api.addFollowup(currentCard.id, newQuestion.trim())
      setFollowups(prev => [...prev, created])
      setNewQuestion('')
    } catch (err) {
      alert('Could not add follow-up: ' + (err.message || err))
    } finally {
      setSubmittingFollowup(false)
    }
  }

  const handleOpenLinkedCards = async (followup) => {
    try {
      let cardIds = []
      if (Array.isArray(followup.linkedCardIds)) {
        cardIds = followup.linkedCardIds
      } else if (typeof followup.linkedCardIds === 'string' && followup.linkedCardIds.trim()) {
        try {
          const parsed = JSON.parse(followup.linkedCardIds)
          cardIds = Array.isArray(parsed) ? parsed : [parsed]
        } catch {
          cardIds = followup.linkedCardIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
        }
      } else if (followup.linkedCardId) {
        cardIds = [followup.linkedCardId]
      }

      if (cardIds.length === 0) return
      const cards = await Promise.all(cardIds.map(id => api.getCard(id).catch(() => null)))
      const validCards = cards.filter(Boolean)
      if (validCards.length === 0) {
        alert('Could not load linked answer cards.')
        return
      }
      setPreviewAnswerCards({
        cards: validCards,
        initialIndex: 0,
        followup,
        parentCard: currentCard
      })
    } catch (err) {
      alert('Could not load answer cards: ' + (err.message || err))
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
          width: '90%',
          maxWidth: 780,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#212529', display: 'flex', alignItems: 'center', gap: 8 }}>
              🎴 Flashcard Preview
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#e7f5ff', color: '#1864ab' }}>
              {currentCard.type || 'basic'}
            </span>
            {currentCard.deckTitle && (
              <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                in <strong>{currentCard.deckTitle}</strong>
              </span>
            )}
          </div>
          <button
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d', padding: '0 4px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #dee2e6', background: '#fcfcfd', padding: '0 16px' }}>
          <button
            style={{
              padding: '12px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'card' ? '3px solid #0d6efd' : '3px solid transparent',
              color: activeTab === 'card' ? '#0d6efd' : '#64748b'
            }}
            onClick={() => setActiveTab('card')}
          >
            📖 Card Details
          </button>
          <button
            style={{
              padding: '12px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'followups' ? '3px solid #0d6efd' : '3px solid transparent',
              color: activeTab === 'followups' ? '#0d6efd' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => setActiveTab('followups')}
          >
            💬 Follow-ups
            {followups.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: activeTab === 'followups' ? '#0d6efd' : '#e2e8f0', color: activeTab === 'followups' ? '#fff' : '#475569', padding: '1px 6px', borderRadius: 10 }}>
                {followups.length}
              </span>
            )}
          </button>
          <button
            style={{
              padding: '12px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'exercises' ? '3px solid #0d6efd' : '3px solid transparent',
              color: activeTab === 'exercises' ? '#0d6efd' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => setActiveTab('exercises')}
          >
            ⚡ Linked Exercises
            {linkedExercises.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: activeTab === 'exercises' ? '#0d6efd' : '#e2e8f0', color: activeTab === 'exercises' ? '#fff' : '#475569', padding: '1px 6px', borderRadius: 10 }}>
                {linkedExercises.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* TAB 1: CARD DETAILS */}
          {activeTab === 'card' && (
            <div>
              {isEditing ? (
                <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>✏️ Edit Flashcard</h4>
                    <button
                      type="button"
                      className="btn-study-tool"
                      style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                      onClick={() => setIsEditing(false)}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <MarkdownField
                    label="Question / Prompt"
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                    placeholder="Enter question or prompt in Markdown..."
                    required
                    rows={3}
                  />
                  <MarkdownField
                    label="Answer"
                    value={editAnswer}
                    onChange={e => setEditAnswer(e.target.value)}
                    placeholder="Enter answer in Markdown..."
                    required
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-study-tool"
                      onClick={() => setIsEditing(false)}
                      disabled={isSavingEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSavingEdit || !editPrompt.trim() || !editAnswer.trim()}
                    >
                      {isSavingEdit ? 'Saving...' : '💾 Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Action Bar for Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canCreate && (
                        <button
                          className="btn-study-tool"
                          style={{ fontSize: '0.85rem', padding: '5px 12px', fontWeight: 600 }}
                          onClick={() => setIsEditing(true)}
                        >
                          ✏️ Edit Card
                        </button>
                      )}
                      <button
                        className="btn-study-tool"
                        style={{ fontSize: '0.85rem', padding: '5px 12px', borderColor: '#0d6efd', color: '#0d6efd', fontWeight: 600 }}
                        onClick={() => setCopyModalOpen(true)}
                      >
                        📋 Copy Card
                      </button>
                      {canCreate && (
                        <button
                          className="btn-study-tool"
                          style={{ fontSize: '0.85rem', padding: '5px 12px', borderColor: '#0d6efd', color: '#0d6efd', fontWeight: 600 }}
                          onClick={() => setIsLinkerOpen(true)}
                        >
                          🔗 Link Exercises
                        </button>
                      )}
                    </div>

                    <button
                      className="btn-primary"
                      style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                      onClick={() => {
                        onClose()
                        navigate(`/decks/${currentCard.deckId}`)
                      }}
                    >
                      Study Deck ➔
                    </button>
                  </div>

                  {/* Front Prompt */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Prompt / Question
                    </label>
                    <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '1rem', color: '#0f172a' }}>
                      <MarkdownViewer content={currentCard.prompt} />
                    </div>
                  </div>

                  {/* Back Answer */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Answer
                    </label>
                    <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: '0.95rem', color: '#0369a1' }}>
                      <MarkdownViewer content={currentCard.answer || currentCard.validationSpec || 'No specific answer text configured.'} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FOLLOW-UPS */}
          {activeTab === 'followups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Ask Form */}
              <form onSubmit={handleSubmitFollowup} style={{ display: 'flex', gap: 10 }}>
                <input
                  className="form-control"
                  placeholder="Ask a question this card sparked in your mind..."
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  disabled={submittingFollowup}
                  style={{ flex: 1, padding: '10px 14px' }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingFollowup || !newQuestion.trim()}
                  style={{ padding: '8px 20px', whiteSpace: 'nowrap' }}
                >
                  {submittingFollowup ? 'Posting...' : '💬 Ask Question'}
                </button>
              </form>

              {/* Followups List */}
              {followupsLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Loading follow-up questions...</div>
              ) : followups.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <p style={{ margin: 0, color: '#64748b' }}>No follow-up questions yet. Be the first to ask!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {followups.map(f => (
                    <div
                      key={f.id}
                      style={{
                        padding: 14,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {api.getEffectiveDisplayName(f.authorDisplayName, f.authorDisplayName)}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {new Date(f.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b', fontWeight: 500 }}>
                        "{f.questionText}"
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                        {(f.linkedCardIds?.length > 0 || f.linkedCardId) && (
                          <button
                            className="btn-study-tool"
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: '#16a34a',
                              borderColor: '#86efac',
                              background: '#f0fdf4',
                              cursor: 'pointer',
                              padding: '3px 10px'
                            }}
                            onClick={() => handleOpenLinkedCards(f)}
                          >
                            ✓ Answered by {(f.linkedCardIds?.length || 1)} card{(f.linkedCardIds?.length > 1) ? 's' : ''} ➔
                          </button>
                        )}

                        {canCreate && (
                          <button
                            className="btn-study-tool"
                            style={{ fontSize: '0.8rem', padding: '3px 10px', borderColor: '#0d6efd', color: '#0d6efd', fontWeight: 600 }}
                            onClick={() => setConvertingFollowup(f)}
                          >
                            + Answer with Card 🎴
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LINKED EXERCISES */}
          {activeTab === 'exercises' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  Coding exercises connected to this flashcard for hands-on practice.
                </span>
                {canCreate && (
                  <button
                    className="btn-study-tool"
                    style={{ fontSize: '0.85rem', padding: '4px 12px', borderColor: '#0d6efd', color: '#0d6efd', fontWeight: 600 }}
                    onClick={() => setIsLinkerOpen(true)}
                  >
                    🔗 Link / Manage Exercises
                  </button>
                )}
              </div>

              {exercisesLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Loading linked exercises...</div>
              ) : linkedExercises.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <p style={{ margin: 0, color: '#64748b' }}>No exercises linked to this card yet.</p>
                  {canCreate && (
                    <button
                      className="btn-primary"
                      style={{ marginTop: 12, fontSize: '0.85rem', padding: '6px 14px' }}
                      onClick={() => setIsLinkerOpen(true)}
                    >
                      + Link an Exercise Now
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {linkedExercises.map((ex, idx) => (
                    <div
                      key={ex.id}
                      style={{
                        padding: 14,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>⚡ {ex.title}</strong>
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
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{ex.description}</p>
                        )}
                      </div>

                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={() => setActivePracticeModal({ exercises: linkedExercises, initialIndex: idx })}
                      >
                        ▶ Practice Code
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', background: '#f8f9fa', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
            Card ID #{currentCard.id} • Deck #{currentCard.deckId}
          </span>
          <button className="btn-study-tool" onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>

      {/* Copy Modal */}
      <CopyModal
        isOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        itemType="card"
        item={currentCard}
        onSuccess={() => alert('Card copied to deck successfully!')}
      />

      {/* Exercise Linker Modal */}
      {isLinkerOpen && (
        <CardExerciseLinkerModal
          card={currentCard}
          onClose={() => setIsLinkerOpen(false)}
          onUpdated={loadLinkedExercises}
        />
      )}

      {/* Answer Follow-up with Card Modal */}
      {convertingFollowup && (
        <ConvertFollowupModal
          followup={convertingFollowup}
          parentCard={currentCard}
          currentDeckId={currentCard.deckId}
          onClose={() => setConvertingFollowup(null)}
          onConverted={loadFollowups}
        />
      )}

      {/* Linked Answer Cards Carousel Modal */}
      {previewAnswerCards && (
        <LinkedCardsPreviewModal
          modalData={previewAnswerCards}
          onClose={() => setPreviewAnswerCards(null)}
          onUnlinked={loadFollowups}
        />
      )}

      {/* Practice Modal */}
      {activePracticeModal && (
        <ExercisePracticeModal
          exercises={activePracticeModal.exercises}
          initialIndex={activePracticeModal.initialIndex}
          onClose={() => setActivePracticeModal(null)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        {...authModalConfig}
        onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

function CardExerciseLinkerModal({ card, onClose, onUpdated }) {
  const { activeStudyGroup } = useStudyGroup() || {}
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'create'
  const [exercises, setExercises] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [linkingId, setLinkingId] = useState(null)

  // Creation form state
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('csharp')
  const [exerciseType, setExerciseType] = useState('CodeExecution')
  const [description, setDescription] = useState('')
  const [starterCode, setStarterCode] = useState('')
  const [solutionCode, setSolutionCode] = useState('')
  const [mcqOpt1, setMcqOpt1] = useState('')
  const [mcqOpt2, setMcqOpt2] = useState('')
  const [mcqOpt3, setMcqOpt3] = useState('')
  const [mcqOpt4, setMcqOpt4] = useState('')
  const [mcqCorrect, setMcqCorrect] = useState(0)
  const [exactAnswer, setExactAnswer] = useState('')
  const [exactCaseSensitive, setExactCaseSensitive] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [allExs, cardExs] = await Promise.all([
        api.getExercises('', activeStudyGroup?.id).catch(() => []),
        api.getCardExercises(card.id).catch(() => [])
      ])
      setExercises(allExs || [])
      setLinkedIds(new Set((cardExs || []).map(e => e.id)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [card.id, activeStudyGroup?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleLink = async (exerciseId) => {
    const isLinked = linkedIds.has(exerciseId)
    setLinkingId(exerciseId)
    try {
      if (isLinked) {
        await api.unlinkCardExercise(card.id, exerciseId)
        setLinkedIds(prev => { const next = new Set(prev); next.delete(exerciseId); return next })
      } else {
        await api.linkCardExercise(card.id, exerciseId)
        setLinkedIds(prev => new Set(prev).add(exerciseId))
      }
      if (onUpdated) onUpdated()
    } catch (err) {
      alert('Link action failed: ' + (err.message || err))
    } finally {
      setLinkingId(null)
    }
  }

  const handleCreateAndLink = async (e) => {
    e.preventDefault()
    if (!title.trim()) return

    let exerciseSpec = null
    if (exerciseType === 'MultipleChoice') {
      const rawOpts = [mcqOpt1, mcqOpt2, mcqOpt3, mcqOpt4]
      const selectedText = rawOpts[mcqCorrect]
      const opts = rawOpts.map(s => s.trim()).filter(Boolean)
      if (opts.length < 2) {
        alert('Please provide at least 2 options for Multiple Choice exercise.')
        return
      }
      let correctIdx = opts.indexOf(selectedText?.trim())
      if (correctIdx === -1) correctIdx = 0
      exerciseSpec = JSON.stringify({ options: opts, correctIndex: correctIdx })
    } else if (exerciseType === 'ExactString') {
      if (!exactAnswer.trim()) {
        alert('Please provide the correct answer for Exact String exercise.')
        return
      }
      exerciseSpec = JSON.stringify({ acceptedAnswers: [exactAnswer.trim()], caseSensitive: exactCaseSensitive })
    }

    setCreating(true)
    try {
      const finalLang = exerciseType === 'CodeExecution' ? language : normalizeTag(language)
      const newEx = await api.createExercise({
        title,
        language: finalLang,
        exerciseType,
        exerciseSpec,
        description,
        starterCode,
        solutionCode,
        studyGroupId: activeStudyGroup?.id
      })
      await api.linkCardExercise(card.id, newEx.id)
      alert(`Created and linked "${title}" to card!`)
      if (onUpdated) onUpdated()
      onClose()
    } catch (err) {
      alert('Create & link failed: ' + (err.message || err))
    } finally {
      setCreating(false)
    }
  }

  const filteredExercises = exercises.filter(e => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return e.title.toLowerCase().includes(q) ||
           (e.description && e.description.toLowerCase().includes(q)) ||
           (e.language && e.language.toLowerCase().includes(q))
  })

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.7)',
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
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>🔗 Link Coding Exercises</h3>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6' }}>
          <button
            style={{ padding: '10px 16px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: activeTab === 'search' ? '3px solid #0d6efd' : '3px solid transparent', color: activeTab === 'search' ? '#0d6efd' : '#495057' }}
            onClick={() => setActiveTab('search')}
          >
            🔍 Existing Exercises ({exercises.length})
          </button>
          <button
            style={{ padding: '10px 16px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: activeTab === 'create' ? '3px solid #0d6efd' : '3px solid transparent', color: activeTab === 'create' ? '#0d6efd' : '#495057' }}
            onClick={() => setActiveTab('create')}
          >
            ✨ Create & Link New Exercise
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'search' ? (
            <div>
              <input
                className="form-control"
                placeholder="Search coding exercises..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ marginBottom: 16 }}
              />
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>Loading exercises...</div>
              ) : filteredExercises.length === 0 ? (
                <div className="empty-state">No matching exercises found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredExercises.map(ex => {
                    const isLinked = linkedIds.has(ex.id)
                    return (
                      <div key={ex.id} style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <strong style={{ fontSize: '0.95rem' }}>⚡ {ex.title}</strong>
                            {ex.language && (
                              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: langBadgeFor(ex.language).bg, color: langBadgeFor(ex.language).color, fontWeight: 600 }}>
                                {langBadgeFor(ex.language).label}
                              </span>
                            )}
                          </div>
                          {ex.description && <p style={{ margin: 0, fontSize: '0.8rem', color: '#6c757d' }}>{ex.description}</p>}
                        </div>
                        <button
                          className={isLinked ? 'btn-study-tool' : 'btn-primary'}
                          style={{ fontSize: '0.8rem', padding: '6px 12px', minWidth: 90 }}
                          disabled={linkingId === ex.id}
                          onClick={() => handleToggleLink(ex.id)}
                        >
                          {linkingId === ex.id ? 'Saving...' : isLinked ? '✓ Linked (Unlink)' : '+ Link to Card'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateExercise} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Exercise Title</label>
                <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Implement Binary Search" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: exerciseType === 'CodeExecution' ? '1fr 1fr' : '1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Exercise Format</label>
                  <select className="form-control" value={exerciseType} onChange={e => {
                    setExerciseType(e.target.value)
                    if (e.target.value !== 'CodeExecution') {
                      setLanguage('general')
                    } else {
                      setLanguage('csharp')
                    }
                  }}>
                    <option value="CodeExecution">⚡ Code Execution</option>
                    <option value="MultipleChoice">🔘 Multiple Choice</option>
                    <option value="ExactString">✏️ Exact String / Short Answer</option>
                  </select>
                </div>
                {exerciseType === 'CodeExecution' ? (
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Language Runtime</label>
                    <select className="form-control" value={language} onChange={e => setLanguage(e.target.value)}>
                      <option value="csharp">C#</option>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="go">Go</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Topic / Domain Tag <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6c757d' }}>(Select or type custom tag)</span>
                    </label>
                    <input
                      list="popular-topic-tags-detail-linker"
                      className="form-control"
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      placeholder="e.g. general, linux, kubernetes, react..."
                      required
                    />
                    <datalist id="popular-topic-tags-detail-linker">
                      {POPULAR_TOPIC_TAGS.map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                <textarea className="form-control" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Exercise problem statement..." />
              </div>

              {exerciseType === 'CodeExecution' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Starter Code</label>
                    <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={starterCode} onChange={e => setStarterCode(e.target.value)} placeholder="// Write code..." />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Solution Code</label>
                    <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={solutionCode} onChange={e => setSolutionCode(e.target.value)} placeholder="// Correct solution..." />
                  </div>
                </>
              )}

              {exerciseType === 'MultipleChoice' && (
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Options (select correct radio)</label>
                  {[mcqOpt1, mcqOpt2, mcqOpt3, mcqOpt4].map((opt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <input type="radio" name="mcqCorrect" checked={mcqCorrect === i} onChange={() => setMcqCorrect(i)} />
                      <input
                        className="form-control"
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={e => {
                          if (i === 0) setMcqOpt1(e.target.value)
                          if (i === 1) setMcqOpt2(e.target.value)
                          if (i === 2) setMcqOpt3(e.target.value)
                          if (i === 3) setMcqOpt4(e.target.value)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {exerciseType === 'ExactString' && (
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Accepted Answer</label>
                  <input className="form-control" value={exactAnswer} onChange={e => setExactAnswer(e.target.value)} placeholder="Expected exact string..." />
                  <label style={{ fontSize: '0.8rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={exactCaseSensitive} onChange={e => setExactCaseSensitive(e.target.checked)} />
                    Case sensitive matching
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-study-tool" onClick={() => setActiveTab('search')}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating || !title.trim()}>
                  {creating ? 'Creating...' : 'Create & Link Exercise'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function ConvertFollowupModal({ followup, parentCard, currentDeckId, onClose, onConverted }) {
  const { activeStudyGroup } = useStudyGroup() || {}
  const [activeTab, setActiveTab] = useState('link')
  const [decks, setDecks] = useState([])
  const [targetDeckId, setTargetDeckId] = useState(currentDeckId || '')
  const [existingCards, setExistingCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newPrompt, setNewPrompt] = useState(followup?.questionText || '')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.getDecks(activeStudyGroup?.id).catch(() => []),
      api.getAllCards(activeStudyGroup?.id).catch(() => [])
    ]).then(([dData, cData]) => {
      if (!mounted) return
      setDecks(dData || [])
      if (!targetDeckId && dData && dData.length > 0) setTargetDeckId(dData[0].id)
      setExistingCards(cData || [])
      setLoadingCards(false)
    })
    return () => { mounted = false }
  }, [targetDeckId, activeStudyGroup?.id])

  const handleLinkExistingCard = async (existingCardId) => {
    setSaving(true)
    try {
      await api.linkFollowupToCard(parentCard.id, followup.id, existingCardId)
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
    if (!targetDeckId || !newPrompt.trim() || !answer.trim()) return
    setSaving(true)
    try {
      const newCard = await api.createCard(targetDeckId, newPrompt.trim(), answer.trim(), 'basic')
      await api.linkFollowupToCard(parentCard.id, followup.id, newCard.id)
      alert('Follow-up converted to a new standalone card and linked!')
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
    return (c.prompt && c.prompt.toLowerCase().includes(q)) ||
           (c.answer && c.answer.toLowerCase().includes(q)) ||
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
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          padding: 24
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#212529' }}>Turn Follow-up into Flashcard</h3>
          <button style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: 16 }}>
          <button
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'link' ? '3px solid #0d6efd' : '3px solid transparent',
              color: activeTab === 'link' ? '#0d6efd' : '#495057'
            }}
            onClick={() => setActiveTab('link')}
          >
            🔗 Link to Existing Card
          </button>
          <button
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'create' ? '3px solid #0d6efd' : '3px solid transparent',
              color: activeTab === 'create' ? '#0d6efd' : '#495057'
            }}
            onClick={() => setActiveTab('create')}
          >
            ✨ Create New Card & Link
          </button>
        </div>

        {activeTab === 'link' ? (
          <div>
            <input
              className="form-control"
              placeholder="Search existing cards by prompt or answer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            {loadingCards ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>Loading cards catalog...</div>
            ) : filteredCards.length === 0 ? (
              <div className="empty-state">No matching cards found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
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
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <strong style={{ fontSize: '0.95rem', display: 'block' }}>{c.prompt}</strong>
                      {(c.answer || c.validationSpec) && (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6c757d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Answer: {c.answer || c.validationSpec}
                        </p>
                      )}
                    </div>
                    <button
                      className="btn-primary"
                      disabled={saving}
                      style={{ padding: '6px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                      onClick={() => handleLinkExistingCard(c.id)}
                    >
                      Link 🔗
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateAndLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <MarkdownField
              label="Question / Prompt"
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              placeholder="Enter question or prompt in Markdown..."
              required
              rows={3}
            />
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>Target Deck</label>
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
            <MarkdownField
              label="Answer"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type answer in Markdown..."
              required
              rows={4}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid #e9ecef' }}>
              <button type="button" className="btn-study-tool" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving || !newPrompt.trim() || !answer.trim()}>
                {saving ? 'Converting...' : 'Save & Link Card 🎴'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function LinkedCardsPreviewModal({ modalData, onClose, onUnlinked }) {
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
      await api.unlinkFollowupCard(parentCard.id, followup.id, currentCard.id)
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
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.7)',
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
        <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>🎴 Linked Answer Card</h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#0d6efd', color: '#fff' }}>
              {currentCard?.type || 'basic'}
            </span>
          </div>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }} onClick={onClose}>✕</button>
        </div>

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

        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {followup && (
            <div style={{ padding: '8px 12px', background: '#f8f9fa', borderRadius: 6, borderLeft: '4px solid #0d6efd', fontSize: '0.85rem', color: '#495057' }}>
              <strong>Follow-up Question:</strong> "{followup.questionText}"
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>Card Question / Prompt</label>
            <div style={{ padding: 14, background: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6', fontSize: '1rem', fontWeight: 500, color: '#212529' }}>
              <MarkdownViewer content={currentCard?.prompt} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>Card Answer</label>
            <div style={{ padding: 14, background: '#e7f5ff', borderRadius: 8, border: '1px solid #a5d8ff', fontSize: '0.95rem', color: '#1864ab' }}>
              <MarkdownViewer content={currentCard?.answer || currentCard?.validationSpec || 'No specific answer text configured.'} />
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

            <Link
              to={`/decks/${currentCard?.deckId}`}
              className="btn-primary"
              style={{ textDecoration: 'none', padding: '8px 18px', fontSize: '0.9rem', display: 'inline-block' }}
              onClick={onClose}
            >
              Open Target Deck ➔
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
