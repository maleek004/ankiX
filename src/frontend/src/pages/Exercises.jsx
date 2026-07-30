import React, { useEffect, useState } from 'react'
import MarkdownRenderer from '../components/MarkdownRenderer'
import MarkdownEditor from '../components/MarkdownEditor'

export default function Exercises(){
  const [exercises, setExercises] = useState([])
  const [activeLang, setActiveLang] = useState('')
  const [canCreate, setCanCreate] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add Exercise state
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('csharp')
  const [description, setDescription] = useState('')
  const [starterCode, setStarterCode] = useState('')
  const [solutionCode, setSolutionCode] = useState('')
  const [testCasesSpec, setTestCasesSpec] = useState('')

  // Active practice workspace state
  const [activeExercise, setActiveExercise] = useState(null)
  const [practiceCode, setPracticeCode] = useState('')
  const [practiceLang, setPracticeLang] = useState('csharp')
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)

  const loadExercises = async (lang = activeLang) => {
    try {
      const data = await import('../api.js').then(m => m.getExercises(lang))
      setExercises(data || [])
    } catch (err) {
      console.warn('Could not fetch exercises:', err.message || err)
      setExercises([])
    }
  }

  useEffect(() => {
    let mounted = true
    import('../api.js').then(m => {
      if (mounted) setCanCreate(m.canCreateContent())
      return m.getExercises(activeLang)
    }).then(data => {
      if (mounted) setExercises(data || [])
    }).catch(() => { if (mounted) setExercises([]) })

    return () => { mounted = false }
  }, [activeLang])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const newEx = await import('../api.js').then(m => m.createExercise({
        title,
        language,
        description,
        starterCode,
        solutionCode,
        testCasesSpec
      }))
      setExercises(prev => [newEx, ...prev])
      setTitle('')
      setDescription('')
      setStarterCode('')
      setSolutionCode('')
      setTestCasesSpec('')
      setShowAddForm(false)
    } catch (err) {
      alert('Create exercise failed: ' + (err.message || err))
    }
  }

  const openPractice = async (ex) => {
    try {
      const detail = await import('../api.js').then(m => m.getExercise(ex.id))
      setActiveExercise(detail)
      setPracticeCode(detail.starterCode || detail.solutionCode || '// Write your solution here...')
      setPracticeLang(detail.language || 'csharp')
      setRunResult(null)
    } catch (err) {
      setActiveExercise(ex)
      setPracticeCode(ex.starterCode || '// Write your solution here...')
      setPracticeLang(ex.language || 'csharp')
      setRunResult(null)
    }
  }

  const handleRunCode = async () => {
    if (!activeExercise) return
    setRunning(true)
    setRunResult(null)
    try {
      const res = await import('../api.js').then(m => m.runExerciseCode(activeExercise.id, practiceCode, practiceLang))
      setRunResult(res)
    } catch (err) {
      setRunResult({ passed: false, result: 'FAIL', details: 'Error: ' + (err.message || err), durationMs: 0 })
    } finally {
      setRunning(false)
    }
  }

  const langBadges = {
    csharp: { label: 'C#', color: '#68217a', bg: '#f3e8f8' },
    python: { label: 'Python', color: '#3572A5', bg: '#e8f1f8' },
    javascript: { label: 'JS', color: '#f1e05a', bg: '#fefde8' },
    go: { label: 'Go', color: '#00ADD8', bg: '#e6f7fc' }
  }

  const handleRateExercise = async (outcome) => {
    if (!activeExercise) return
    try {
      const res = await import('../api.js').then(m => m.submitExerciseReview(activeExercise.id, outcome))
      alert(`Exercise rating submitted (${outcome})! Next review: ${new Date(res.nextReviewAt).toLocaleDateString()}`)
      setRunResult(null)
    } catch (err) {
      alert('Submit review failed: ' + (err.message || err))
    }
  }

  const handleReseed = async () => {
    if (!confirm('Are you sure you want to replace all database exercises with the 5 basic coding challenges and unit test assertion suites?')) return
    try {
      const res = await import('../api.js').then(m => m.reseedExercises())
      alert(res.message || 'Database exercises reset successfully!')
      const exs = await import('../api.js').then(m => m.getExercises())
      setExercises(exs || [])
      setActiveExercise(null)
    } catch (err) {
      alert('Reseed failed: ' + (err.message || err))
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>
      {/* Header Bar */}
      <div className="decks-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 500, fontSize: '1.5rem' }}>Standalone Exercises</h2>
          <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>Hands-on coding challenges (Go, Python, C#, JavaScript)</span>
        </div>
        {canCreate && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-study-tool" onClick={handleReseed} style={{ fontSize: '0.85rem' }}>
              🔄 Reset Exercises DB
            </button>
            <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Cancel' : '+ Add Exercise'}
            </button>
          </div>
        )}
      </div>

      {/* Language Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #dee2e6', pb: 12 }}>
        {['', 'csharp', 'python', 'javascript', 'go'].map(lang => (
          <button
            key={lang}
            className="btn-study-tool"
            style={{
              fontWeight: activeLang === lang ? 600 : 400,
              background: activeLang === lang ? '#0d6efd' : '#f8f9fa',
              color: activeLang === lang ? '#fff' : '#212529',
              borderColor: activeLang === lang ? '#0d6efd' : '#ced4da'
            }}
            onClick={() => setActiveLang(lang)}
          >
            {lang === '' ? 'All Languages' : (langBadges[lang]?.label || lang)}
          </button>
        ))}
      </div>

      {/* Add Exercise Form */}
      {showAddForm && canCreate && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Create Standalone Exercise</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Exercise Title</label>
                <input className="form-control" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Reverse String in-place" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Language</label>
                <select className="form-control" value={language} onChange={e=>setLanguage(e.target.value)}>
                  <option value="csharp">C#</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="go">Go</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description / Instructions</label>
              <MarkdownEditor value={description} onChange={setDescription} placeholder="Instructions in markdown, code blocks, or embedded images..." rows={3} />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Starter Code Template</label>
              <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={starterCode} onChange={e=>setStarterCode(e.target.value)} placeholder="initial function signature..." />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Solution Code (or Validation Spec)</label>
              <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace' }} value={solutionCode} onChange={e=>setSolutionCode(e.target.value)} placeholder="expected reference solution..." />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-study-tool" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Exercise</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Exercises Grid */}
      <div>
        {exercises.length === 0 ? (
          <div className="empty-state">No exercises found. Add one or select another language filter!</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {exercises.map(ex => {
              const badge = langBadges[ex.language] || { label: ex.language, color: '#333', bg: '#eee' }
              const isSelected = activeExercise?.id === ex.id
              return (
                <div
                  key={ex.id}
                  className="form-card"
                  style={{
                    padding: 18,
                    borderLeft: `4px solid ${badge.color}`,
                    background: isSelected ? '#f8f9fa' : '#fff',
                    boxShadow: isSelected ? '0 0 0 2px #0d6efd' : '0 2px 8px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{ex.title}</h4>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>

                    {ex.description && (
                      <p style={{ fontSize: '0.85rem', color: '#495057', margin: '4px 0 16px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ex.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f3f5' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                      🔗 {ex.linkedCardsCount ?? 0} linked cards
                    </span>
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
                  <MarkdownRenderer content={activeExercise.description} />
                </div>
              )}

              <div>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Code Solution</label>
                  <select
                    className="form-control"
                    style={{ width: 'auto', padding: '2px 8px', fontSize: '0.85rem' }}
                    value={practiceLang}
                    onChange={e => setPracticeLang(e.target.value)}
                  >
                    <option value="csharp">C#</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="go">Go</option>
                  </select>
                </div>

                <textarea
                  className="form-control"
                  rows={9}
                  style={{
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '0.9rem',
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    resize: 'vertical'
                  }}
                  value={practiceCode}
                  onChange={e => setPracticeCode(e.target.value)}
                />
              </div>

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
      )}
    </div>
  )
}
