import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import {
  getExercises,
  getExercise,
  createExercise,
  runExerciseCode,
  submitExerciseReview,
  canCreateContent,
  getMyCollectionExerciseIds,
  enrollExercise,
  unenrollExercise,
  getMyDueExercises
} from '../api.js'
import ExerciseRenderer from '../components/ExerciseComponents'

export default function Exercises() {
  const { activeStudyGroup } = useStudyGroup() || {}
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('queue') // 'queue' | 'all'
  const [exercises, setExercises] = useState([])
  const [dueQueue, setDueQueue] = useState([])
  const [enrolledIds, setEnrolledIds] = useState(new Set())
  const [activeLang, setActiveLang] = useState('')
  const [canCreate, setCanCreate] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add Exercise state
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('csharp')
  const [exerciseType, setExerciseType] = useState('CodeExecution') // 'CodeExecution' | 'MultipleChoice' | 'ExactString'
  const [description, setDescription] = useState('')
  const [starterCode, setStarterCode] = useState('')
  const [solutionCode, setSolutionCode] = useState('')
  const [testCasesSpec, setTestCasesSpec] = useState('')

  // MCQ state
  const [mcqOpt1, setMcqOpt1] = useState('')
  const [mcqOpt2, setMcqOpt2] = useState('')
  const [mcqOpt3, setMcqOpt3] = useState('')
  const [mcqOpt4, setMcqOpt4] = useState('')
  const [mcqCorrect, setMcqCorrect] = useState(0)

  // Exact String state
  const [exactAnswer, setExactAnswer] = useState('')
  const [exactCaseSensitive, setExactCaseSensitive] = useState(false)

  // Active practice workspace state
  const [activeExercise, setActiveExercise] = useState(null)
  const [practiceCode, setPracticeCode] = useState('')
  const [practiceLang, setPracticeLang] = useState('csharp')
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [queueIndex, setQueueIndex] = useState(0)

  const loadData = async () => {
    if (!activeStudyGroup) { navigate('/study-groups'); return }
    try {
      setCanCreate(canCreateContent(activeStudyGroup?.role))
      const [allEx, collectionIds, dueEx] = await Promise.all([
        getExercises(activeLang, activeStudyGroup?.id),
        getMyCollectionExerciseIds(),
        getMyDueExercises()
      ])
      setExercises(allEx || [])
      setEnrolledIds(new Set(collectionIds || []))
      setDueQueue(dueEx || [])
    } catch (err) {
      console.warn('Could not load exercise data:', err.message || err)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeLang])

  const handleToggleEnroll = async (exId, e) => {
    if (e) e.stopPropagation()
    const isEnrolled = enrolledIds.has(exId)
    try {
      if (isEnrolled) {
        await unenrollExercise(exId)
        setEnrolledIds(prev => {
          const next = new Set(prev)
          next.delete(exId)
          return next
        })
        setDueQueue(prev => prev.filter(e => e.id !== exId))
      } else {
        await enrollExercise(exId)
        setEnrolledIds(prev => new Set(prev).add(exId))
        const dueEx = await getMyDueExercises()
        setDueQueue(dueEx || [])
      }
    } catch (err) {
      alert('Failed to update collection: ' + (err.message || err))
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return

    let exerciseSpec = null
    if (exerciseType === 'MultipleChoice') {
      const opts = [mcqOpt1, mcqOpt2, mcqOpt3, mcqOpt4].map(s => s.trim()).filter(Boolean)
      if (opts.length < 2) {
        alert('Please provide at least 2 options for Multiple Choice exercise.')
        return
      }
      exerciseSpec = JSON.stringify({ options: opts, correctIndex: Number(mcqCorrect) })
    } else if (exerciseType === 'ExactString') {
      if (!exactAnswer.trim()) {
        alert('Please provide the correct answer for Exact String exercise.')
        return
      }
      exerciseSpec = JSON.stringify({ acceptedAnswers: [exactAnswer.trim()], caseSensitive: exactCaseSensitive })
    }

    try {
      const newEx = await createExercise({
        title,
        language,
        exerciseType,
        exerciseSpec,
        description,
        starterCode,
        solutionCode,
        testCasesSpec,
        studyGroupId: activeStudyGroup?.id
      })
      setExercises(prev => [newEx, ...prev])
      setTitle('')
      setDescription('')
      setStarterCode('')
      setSolutionCode('')
      setTestCasesSpec('')
      setMcqOpt1('')
      setMcqOpt2('')
      setMcqOpt3('')
      setMcqOpt4('')
      setExactAnswer('')
      setShowAddForm(false)
      // Auto enroll created exercise
      await handleToggleEnroll(newEx.id)
    } catch (err) {
      alert('Create exercise failed: ' + (err.message || err))
    }
  }

  const openPractice = async (ex, inQueueMode = false, qIdx = 0) => {
    try {
      const detail = await getExercise(ex.id)
      setActiveExercise(detail)
      setPracticeCode(detail.starterCode || detail.solutionCode || '')
      setPracticeLang(detail.language || 'csharp')
      setRunResult(null)
    } catch (err) {
      setActiveExercise(ex)
      setPracticeCode(ex.starterCode || '')
      setPracticeLang(ex.language || 'csharp')
      setRunResult(null)
    }
    if (inQueueMode) {
      setQueueIndex(qIdx)
    } else {
      setQueueIndex(-1)
    }
  }

  const handleRunCode = async (submittedPayload) => {
    if (!activeExercise) return
    setRunning(true)
    setRunResult(null)
    try {
      const codeToSubmit = typeof submittedPayload === 'string' ? submittedPayload : practiceCode
      const res = await runExerciseCode(activeExercise.id, codeToSubmit, practiceLang)
      setRunResult(res)
    } catch (err) {
      setRunResult({ passed: false, result: 'FAIL', details: 'Error: ' + (err.message || err), durationMs: 0 })
    } finally {
      setRunning(false)
    }
  }

  const handleRateExercise = async (outcome) => {
    if (!activeExercise) return
    try {
      await submitExerciseReview(activeExercise.id, outcome)
      setEnrolledIds(prev => new Set(prev).add(activeExercise.id))
      
      // Refresh due queue
      const updatedDue = await getMyDueExercises()
      setDueQueue(updatedDue || [])

      if (queueIndex >= 0 && updatedDue.length > 0) {
        const nextIdx = queueIndex < updatedDue.length ? queueIndex : 0
        openPractice(updatedDue[nextIdx], true, nextIdx)
      } else {
        setActiveExercise(null)
      }
    } catch (err) {
      alert('Failed to save exercise review: ' + (err.message || err))
    }
  }

  const langBadges = {
    csharp: { label: 'C#', color: '#68217a', bg: '#f3e8f8' },
    python: { label: 'Python', color: '#3572A5', bg: '#e8f4f8' },
    javascript: { label: 'JavaScript', color: '#f1e05a', bg: '#fffde8' },
    go: { label: 'Go', color: '#00ADD8', bg: '#e8f9fd' }
  }

  const typeBadges = {
    CodeExecution: { label: '⚡ Code Exec', bg: '#e7f5ff', color: '#1864ab' },
    MultipleChoice: { label: '🔘 MCQ', bg: '#fff3bf', color: '#f59f00' },
    ExactString: { label: '✏️ Short Answer', bg: '#e6fcb5', color: '#5c940d' }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '24px auto', padding: '0 16px' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>⚡ Personal Exercise Collection & Practice</h2>
          <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '0.9rem' }}>
            Build your personal exercise queue with Code Execution, Multiple Choice, and Short Answer exercises
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {canCreate && (
            <button className="btn-primary" onClick={() => setShowAddForm(true)} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
              + Add New Exercise
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('queue')}
          style={{
            padding: '10px 20px',
            fontSize: '0.95rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'queue' ? '3px solid #0d6efd' : '3px solid transparent',
            color: activeTab === 'queue' ? '#0d6efd' : '#495057'
          }}
        >
          ⚡ My Review Queue ({dueQueue.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '10px 20px',
            fontSize: '0.95rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'all' ? '3px solid #0d6efd' : '3px solid transparent',
            color: activeTab === 'all' ? '#0d6efd' : '#495057'
          }}
        >
          📚 All Platform Exercises ({exercises.length})
        </button>
      </div>

      {/* Tab 1: My Review Queue */}
      {activeTab === 'queue' && (
        <div>
          {dueQueue.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#2b8a3e' }}>🎉 All Caught Up!</h3>
              <p style={{ margin: 0, color: '#6c757d', fontSize: '0.95rem' }}>
                No exercises in your personal collection are due right now. Browse "All Platform Exercises" below or check out card exercises to add more!
              </p>
            </div>
          ) : (
            <div>
              <div style={{ background: '#e7f5ff', padding: 16, borderRadius: 8, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1.05rem', color: '#1864ab' }}>
                    You have {dueQueue.length} exercise{dueQueue.length > 1 ? 's' : ''} due for review!
                  </strong>
                  <div style={{ fontSize: '0.85rem', color: '#495057', marginTop: 2 }}>
                    Practice each exercise in your queue and rate your recall using SM-2.
                  </div>
                </div>

                <button
                  className="btn-primary"
                  style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 600 }}
                  onClick={() => openPractice(dueQueue[0], true, 0)}
                >
                  ▶ Start Review Session ⚡
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {dueQueue.map((ex, idx) => {
                  const badge = langBadges[ex.language] || { label: ex.language, color: '#333', bg: '#eee' }
                  const typeB = typeBadges[ex.exerciseType || 'CodeExecution'] || typeBadges.CodeExecution
                  return (
                    <div
                      key={ex.id}
                      className="form-card"
                      style={{
                        padding: 18,
                        borderLeft: `4px solid ${badge.color}`,
                        background: '#fff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{ex.title}</h4>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: typeB.bg, color: typeB.color }}>
                              {typeB.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                              {badge.label}
                            </span>
                          </div>
                        </div>

                        {ex.description && (
                          <p style={{ fontSize: '0.85rem', color: '#495057', margin: '4px 0 16px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {ex.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f3f5' }}>
                        <span style={{ fontSize: '0.75rem', color: '#2b8a3e', fontWeight: 600, background: '#d3f9d8', padding: '2px 8px', borderRadius: 4 }}>
                          Due for Review
                        </span>
                        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => openPractice(ex, true, idx)}>
                          Practice Queue ⚡
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: All Platform Exercises */}
      {activeTab === 'all' && (
        <div>
          {/* Language & Difficulty Ordering Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn-study-tool"
                style={{ background: activeLang === '' ? '#0d6efd' : '#fff', color: activeLang === '' ? '#fff' : '#495057', borderColor: '#0d6efd' }}
                onClick={() => setActiveLang('')}
              >
                All Languages
              </button>
              {Object.keys(langBadges).map(l => (
                <button
                  key={l}
                  className="btn-study-tool"
                  style={{ background: activeLang === l ? '#0d6efd' : '#fff', color: activeLang === l ? '#fff' : '#495057', borderColor: '#0d6efd' }}
                  onClick={() => setActiveLang(l)}
                >
                  {langBadges[l].label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: '0.8rem', color: '#6c757d', fontStyle: 'italic' }}>
              ⚡ Sorted by study group difficulty: Easiest ➔ Hardest
            </span>
          </div>

          {exercises.length === 0 ? (
            <div className="empty-state">No exercises found. Add one or select another language filter!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {exercises.map(ex => {
                const badge = langBadges[ex.language] || { label: ex.language, color: '#333', bg: '#eee' }
                const typeB = typeBadges[ex.exerciseType || 'CodeExecution'] || typeBadges.CodeExecution
                const isEnrolled = enrolledIds.has(ex.id)
                const ease = ex.averageEaseFactor ?? 2.50
                const reviews = ex.totalReviewsCount || 0
                const diff = !reviews ? { label: '🌱 New', bg: '#f1f3f5', color: '#495057' }
                  : ease >= 2.55 ? { label: '🟢 Easy', bg: '#d3f9d8', color: '#2b8a3e' }
                  : ease >= 2.35 ? { label: '🟡 Medium', bg: '#fff3bf', color: '#f59f00' }
                  : { label: '🔴 Hard', bg: '#ffe3e3', color: '#e03131' }

                return (
                  <div
                    key={ex.id}
                    className="form-card"
                    style={{
                      padding: 18,
                      borderLeft: `4px solid ${badge.color}`,
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{ex.title}</h4>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: typeB.bg, color: typeB.color }}>
                            {typeB.label}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: diff.bg, color: diff.color }} title={`Average Ease Factor: ${ease}`}>
                            {diff.label} {reviews ? `(${ease})` : ''}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {ex.description && (
                        <p style={{ fontSize: '0.85rem', color: '#495057', margin: '4px 0 16px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ex.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f3f5' }}>
                      <button
                        className="btn-study-tool"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.8rem',
                          background: isEnrolled ? '#d3f9d8' : '#e7f5ff',
                          color: isEnrolled ? '#2b8a3e' : '#1864ab',
                          borderColor: isEnrolled ? '#2b8a3e' : '#1864ab',
                          fontWeight: 600
                        }}
                        onClick={(e) => handleToggleEnroll(ex.id, e)}
                      >
                        {isEnrolled ? '✓ In Collection' : '+ Add to Collection'}
                      </button>

                      <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => openPractice(ex)}>
                        Practice ⚡
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add New Exercise Modal */}
      {showAddForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '90%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>+ Add New Exercise</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Title</label>
                <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Reverse String in Python" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Exercise Format</label>
                  <select className="form-control" value={exerciseType} onChange={e => setExerciseType(e.target.value)}>
                    <option value="CodeExecution">⚡ Code Execution</option>
                    <option value="MultipleChoice">🔘 Multiple Choice (MCQ)</option>
                    <option value="ExactString">✏️ Exact String / Short Answer</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Language Tag</label>
                  <select className="form-control" value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="csharp">C#</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="go">Go</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Instructions / Problem Statement</label>
                <textarea className="form-control" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Exercise instructions or question text..." />
              </div>

              {/* Dynamic inputs based on exerciseType */}
              {exerciseType === 'CodeExecution' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Starter Code</label>
                    <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={starterCode} onChange={e => setStarterCode(e.target.value)} placeholder="def solution():..." />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Solution Code (Test Assertions)</label>
                    <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={solutionCode} onChange={e => setSolutionCode(e.target.value)} placeholder="reference solution or assertion code..." />
                  </div>
                </>
              )}

              {exerciseType === 'MultipleChoice' && (
                <div style={{ background: '#f8f9fa', padding: 14, borderRadius: 8, border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Multiple Choice Options:</label>
                  <input className="form-control" placeholder="Option A" value={mcqOpt1} onChange={e => setMcqOpt1(e.target.value)} required />
                  <input className="form-control" placeholder="Option B" value={mcqOpt2} onChange={e => setMcqOpt2(e.target.value)} required />
                  <input className="form-control" placeholder="Option C (Optional)" value={mcqOpt3} onChange={e => setMcqOpt3(e.target.value)} />
                  <input className="form-control" placeholder="Option D (Optional)" value={mcqOpt4} onChange={e => setMcqOpt4(e.target.value)} />
                  
                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>Correct Option:</label>
                    <select className="form-control" value={mcqCorrect} onChange={e => setMcqCorrect(Number(e.target.value))}>
                      <option value={0}>Option A (First Option)</option>
                      <option value={1}>Option B (Second Option)</option>
                      {mcqOpt3 && <option value={2}>Option C (Third Option)</option>}
                      {mcqOpt4 && <option value={3}>Option D (Fourth Option)</option>}
                    </select>
                  </div>
                </div>
              )}

              {exerciseType === 'ExactString' && (
                <div style={{ background: '#f8f9fa', padding: 14, borderRadius: 8, border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 4 }}>Correct Answer (Exact Match):</label>
                    <input className="form-control" placeholder="e.g. const" value={exactAnswer} onChange={e => setExactAnswer(e.target.value)} required />
                  </div>
                  <label style={{ fontSize: '0.85rem', color: '#495057', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={exactCaseSensitive} onChange={e => setExactCaseSensitive(e.target.checked)} />
                    Case-sensitive matching
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn-study-tool" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save & Add to Collection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Practice Modal Overlay */}
      {activeExercise && (
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
          onClick={e => { if (e.target === e.currentTarget) setActiveExercise(null) }}
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
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>⚡ {activeExercise.title}</h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: langBadges[activeExercise.language]?.bg || '#eee',
                  color: langBadges[activeExercise.language]?.color || '#333'
                }}>
                  {langBadges[activeExercise.language]?.label || activeExercise.language}
                </span>

                <button
                  className="btn-study-tool"
                  style={{
                    padding: '3px 10px',
                    fontSize: '0.75rem',
                    background: enrolledIds.has(activeExercise.id) ? '#d3f9d8' : '#e7f5ff',
                    color: enrolledIds.has(activeExercise.id) ? '#2b8a3e' : '#1864ab',
                    borderColor: enrolledIds.has(activeExercise.id) ? '#2b8a3e' : '#1864ab',
                    fontWeight: 600
                  }}
                  onClick={() => handleToggleEnroll(activeExercise.id)}
                >
                  {enrolledIds.has(activeExercise.id) ? '✓ In Collection' : '+ Add to My Exercises'}
                </button>
              </div>

              <button
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d', padding: '0 4px' }}
                onClick={() => setActiveExercise(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeExercise.description && (
                <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: '0.9rem', border: '1px solid #e9ecef' }}>
                  <strong>Instructions:</strong>
                  <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', color: '#333' }}>{activeExercise.description}</p>
                </div>
              )}

              {/* Multi-Modal Exercise Renderer */}
              <ExerciseRenderer
                exercise={activeExercise}
                practiceCode={practiceCode}
                setPracticeCode={setPracticeCode}
                practiceLang={practiceLang}
                setPracticeLang={setPracticeLang}
                onRunCode={handleRunCode}
                running={running}
                runResult={runResult}
              />

              {/* Status & Output Box */}
              {runResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
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

                  {runResult.details && (
                    <div style={{
                      padding: 12,
                      borderRadius: 8,
                      background: runResult.passed ? '#f8f9fa' : '#fff5f5',
                      color: runResult.passed ? '#212529' : '#c92a2a',
                      fontSize: '0.85rem',
                      fontFamily: 'Consolas, Monaco, monospace',
                      border: runResult.passed ? '1px solid #e9ecef' : '1px solid #ffc9c9',
                      maxHeight: 180,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {runResult.details}
                    </div>
                  )}
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
      )}
    </div>
  )
}
