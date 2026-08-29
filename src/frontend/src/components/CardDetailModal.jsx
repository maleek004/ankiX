import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MarkdownViewer from './MarkdownViewer'
import MarkdownField from './MarkdownField'
import CopyModal from './CopyModal'
import AuthModal from './AuthModal'
import ExercisePracticeModal from '../pages/Exercises'
import { getTagBadge, langBadgeFor, normalizeTag, POPULAR_TOPIC_TAGS } from '../utils/tagUtils'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import CardExerciseLinkerModal from './CardExerciseLinkerModal'
import ConvertFollowupModal from './ConvertFollowupModal'
import LinkedCardsPreviewModal from './LinkedCardsPreviewModal'
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
  const [isGhosting, setIsGhosting] = useState(false)

  const token = localStorage.getItem('ankix_token')
  const isGuest = !token
  const canCreate = api.canCreateContent(activeStudyGroup?.role)

  const handleToggleGhost = async () => {
    if (!currentCard?.id || isGuest) return
    setIsGhosting(true)
    try {
      if (currentCard.isGhosted) {
        await api.unghostCard(currentCard.id)
        const updated = { ...currentCard, isGhosted: false }
        setCurrentCard(updated)
        if (onCardUpdated) onCardUpdated(updated)
      } else {
        await api.ghostCard(currentCard.id)
        const updated = { ...currentCard, isGhosted: true }
        setCurrentCard(updated)
        if (onCardUpdated) onCardUpdated(updated)
      }
    } catch (err) {
      alert((currentCard.isGhosted ? 'Failed to restore card: ' : 'Failed to ghost card: ') + (err.message || err))
    } finally {
      setIsGhosting(false)
    }
  }

  useEffect(() => {
    setCurrentCard(card)
    setEditPrompt(card?.prompt || '')
    setEditAnswer(card?.answer || card?.validationSpec || '')

    if (card?.id && !isGuest && card.isGhosted === undefined) {
      api.getCard(card.id).then(fullCard => {
        if (fullCard && typeof fullCard.isGhosted === 'boolean') {
          setCurrentCard(prev => (prev?.id === card.id ? { ...prev, isGhosted: fullCard.isGhosted } : prev))
        }
      }).catch(() => {})
    }
  }, [card, isGuest])

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
            {currentCard.isGhosted && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f8d7da', color: '#842029' }}>
                👻 Ghosted
              </span>
            )}
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
                      {!isGuest && (
                        <button
                          className="btn-study-tool"
                          style={{
                            fontSize: '0.85rem',
                            padding: '5px 12px',
                            borderColor: currentCard.isGhosted ? '#198754' : '#6c757d',
                            color: currentCard.isGhosted ? '#198754' : '#495057',
                            fontWeight: 600
                          }}
                          disabled={isGhosting}
                          onClick={handleToggleGhost}
                          title={currentCard.isGhosted ? "Restore card to your active review queue" : "Ghost card — exclude from your personal study queue"}
                        >
                          {isGhosting
                            ? (currentCard.isGhosted ? 'Restoring...' : 'Ghosting...')
                            : (currentCard.isGhosted ? '✨ Restore Card' : '👻 Ghost Card')}
                        </button>
                      )}
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
