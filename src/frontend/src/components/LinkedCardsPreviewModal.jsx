import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import MarkdownViewer from './MarkdownViewer'
import * as api from '../api'

export default function LinkedCardsPreviewModal({ modalData, onClose, onUnlinked }) {
  if (!modalData) return null

  const cardsList = modalData.cards ? modalData.cards : [modalData]
  const followup = modalData.followup
  const parentCard = modalData.parentCard

  const [currentIndex, setCurrentIndex] = useState(modalData.initialIndex || 0)
  const [unlinking, setUnlinking] = useState(false)

  const currentCard = cardsList[currentIndex] || cardsList[0]

  const handleUnlink = async () => {
    if (!followup?.id || !parentCard?.id || !currentCard?.id || unlinking) return
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
