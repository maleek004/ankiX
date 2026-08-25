import React, { useState, useEffect } from 'react'
import MarkdownField from './MarkdownField'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import * as api from '../api'

export default function ConvertFollowupModal({ followup, parentCard, currentDeckId, onClose, onConverted }) {
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
      const validDecks = dData || []
      setDecks(validDecks)
      setTargetDeckId(prev => prev || (validDecks.length > 0 ? validDecks[0].id : ''))
      setExistingCards(cData || [])
      setLoadingCards(false)
    })
    return () => { mounted = false }
  }, [activeStudyGroup?.id])

  const handleLinkExistingCard = async (existingCardId) => {
    if (!parentCard?.id || !followup?.id || saving) return
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
    if (saving || !targetDeckId || !newPrompt.trim() || !answer.trim() || !parentCard?.id || !followup?.id) return
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
