import React, { useState, useEffect } from 'react'
import * as api from '../api'

export default function CopyModal({ isOpen, onClose, itemType, item, onSuccess }) {
  const [groups, setGroups] = useState([])
  const [decks, setDecks] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const currentUser = api.getUser()
  const isGlobalAdminOrContrib = currentUser && (
    currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'contributor'
  )

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSelectedGroupId('')
    setSelectedDeckId('')
    setDecks([])
    fetchTargetGroups()
  }, [isOpen])

  const fetchTargetGroups = async () => {
    setLoadingGroups(true)
    try {
      const allGroups = await api.getStudyGroups()
      // Filter groups where user can manage content
      const writableGroups = (allGroups || []).filter(g => {
        if (isGlobalAdminOrContrib) return true
        const r = g.userRole?.toLowerCase()
        return r === 'owner' || r === 'admin' || r === 'contributor'
      })
      setGroups(writableGroups)
      if (writableGroups.length > 0) {
        const firstId = writableGroups[0].id
        setSelectedGroupId(firstId)
        if (itemType === 'card') {
          fetchDecksForGroup(firstId)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load study groups')
    } finally {
      setLoadingGroups(false)
    }
  }

  const handleGroupChange = (e) => {
    const groupId = e.target.value
    setSelectedGroupId(groupId)
    setSelectedDeckId('')
    if (itemType === 'card' && groupId) {
      fetchDecksForGroup(groupId)
    }
  }

  const fetchDecksForGroup = async (groupId) => {
    setLoadingDecks(true)
    try {
      const groupDecks = await api.getDecks(groupId)
      setDecks(groupDecks || [])
      if (groupDecks && groupDecks.length > 0) {
        setSelectedDeckId(groupDecks[0].id)
      }
    } catch (err) {
      setError(err.message || 'Failed to load decks')
    } finally {
      setLoadingDecks(false)
    }
  }

  const handleCopy = async () => {
    setError(null)
    setSubmitting(true)
    try {
      if (itemType === 'card') {
        if (!selectedDeckId) throw new Error('Please select a target deck.')
        await api.copyCardToDeck(item.id, selectedDeckId)
      } else {
        if (!selectedGroupId) throw new Error('Please select a target study group.')
        await api.copyExerciseToGroup(item.id, selectedGroupId)
      }
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to copy item')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !item) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px',
        maxWidth: '500px', width: '100%', padding: '1.5rem', color: '#f3f4f6',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            Copy {itemType === 'card' ? 'Card' : 'Exercise'}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.5rem',
            cursor: 'pointer', padding: 0
          }}>&times;</button>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Copy <strong style={{ color: '#e5e7eb' }}>"{itemType === 'card' ? (item.prompt || `Card #${item.id}`) : item.title}"</strong> to a deck or group where you have contributor permissions.
        </p>

        {error && (
          <div style={{
            backgroundColor: '#7f1d1d', border: '1px solid #991b1b', color: '#fca5a5',
            padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {loadingGroups ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>Loading study groups...</div>
        ) : groups.length === 0 ? (
          <div style={{
            backgroundColor: '#374151', padding: '1rem', borderRadius: '6px',
            color: '#d1d5db', fontSize: '0.9rem'
          }}>
            You don't have contributor or admin access to any study groups to copy this item to.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#d1d5db', marginBottom: '0.25rem' }}>
                Target Study Group:
              </label>
              <select
                value={selectedGroupId}
                onChange={handleGroupChange}
                style={{
                  width: '100%', padding: '0.6rem', borderRadius: '6px',
                  backgroundColor: '#111827', border: '1px solid #374151', color: '#f3f4f6'
                }}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.userRole || 'Admin/Contributor'})
                  </option>
                ))}
              </select>
            </div>

            {itemType === 'card' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#d1d5db', marginBottom: '0.25rem' }}>
                  Target Deck:
                </label>
                {loadingDecks ? (
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Loading decks...</div>
                ) : decks.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                    No decks found in this study group. Create a deck first.
                  </div>
                ) : (
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem', borderRadius: '6px',
                      backgroundColor: '#111827', border: '1px solid #374151', color: '#f3f4f6'
                    }}
                  >
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: '#374151',
              border: 'none', color: '#f3f4f6', cursor: 'pointer', fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={submitting || groups.length === 0 || (itemType === 'card' && decks.length === 0)}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '6px', backgroundColor: '#3b82f6',
              border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 600,
              opacity: (submitting || groups.length === 0 || (itemType === 'card' && decks.length === 0)) ? 0.6 : 1
            }}
          >
            {submitting ? 'Copying...' : 'Copy Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
