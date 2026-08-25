import React, { useState, useEffect, useCallback } from 'react'
import MarkdownField from './MarkdownField'
import MarkdownViewer from './MarkdownViewer'
import { getTagBadge, langBadgeFor, normalizeTag, POPULAR_TOPIC_TAGS } from '../utils/tagUtils'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import * as api from '../api'

export default function CardExerciseLinkerModal({ card, onClose, onUpdated }) {
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
    if (!card?.id) return
    setLoading(true)
    try {
      const [allExs, cardExs] = await Promise.all([
        api.getExercises('', activeStudyGroup?.id).catch(() => []),
        api.getCardExercises(card.id).catch(() => [])
      ])
      setExercises(allExs || [])
      setLinkedIds(new Set((cardExs || []).map(e => e.id)))
    } catch (err) {
      console.error('Error loading exercises in linker modal:', err)
    } finally {
      setLoading(false)
    }
  }, [card?.id, activeStudyGroup?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleLink = async (exerciseId) => {
    if (!card?.id) return
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
    if (creating || !title.trim() || !card?.id) return

    let exerciseSpec = null
    if (exerciseType === 'MultipleChoice') {
      const rawOpts = [mcqOpt1, mcqOpt2, mcqOpt3, mcqOpt4]
      const selectedText = rawOpts[mcqCorrect]?.trim()
      if (!selectedText) {
        alert('Please enter text for the selected correct option.')
        return
      }
      const opts = rawOpts.map(s => s.trim()).filter(Boolean)
      if (opts.length < 2) {
        alert('Please provide at least 2 options for Multiple Choice exercise.')
        return
      }
      let correctIdx = opts.indexOf(selectedText)
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
    return (e.title && e.title.toLowerCase().includes(q)) ||
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
            <form onSubmit={handleCreateAndLink} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              <MarkdownField
                label="Description / Instructions"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Exercise problem statement and instructions in Markdown..."
                rows={2}
              />

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
