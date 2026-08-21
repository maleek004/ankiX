import React, { useState } from 'react'

const LANG_BADGES = {
  csharp:     { label: 'C#',         color: '#68217a', bg: '#f3e8f8' },
  python:     { label: 'Python',     color: '#3572A5', bg: '#e8f4f8' },
  javascript: { label: 'JavaScript', color: '#b5a000', bg: '#fffde8' },
  go:         { label: 'Go',         color: '#00ADD8', bg: '#e8f9fd' },
}

function langBadgeFor(lang) {
  return LANG_BADGES[lang] || { label: lang || 'Unknown', color: '#495057', bg: '#e9ecef' }
}

export function MultipleChoiceExercise({ exercise, onRunCode, running, runResult }) {
  const [selectedIdx, setSelectedIdx] = useState(null)

  let spec = { options: [], correctIndex: 0 }
  try {
    if (exercise.exerciseSpec) {
      spec = typeof exercise.exerciseSpec === 'string' ? JSON.parse(exercise.exerciseSpec) : exercise.exerciseSpec
    }
  } catch (err) {
    console.error('Failed to parse MCQ spec:', err)
  }

  const options = spec.options || []

  const handleSubmit = () => {
    if (selectedIdx === null) return
    onRunCode(String(selectedIdx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#495057' }}>Select the correct answer:</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt, idx) => (
          <label
            key={idx}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: selectedIdx === idx ? '2px solid #0d6efd' : '1px solid #dee2e6',
              background: selectedIdx === idx ? '#e7f5ff' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontWeight: selectedIdx === idx ? 600 : 400,
              transition: 'all 0.15s ease'
            }}
          >
            <input
              type="radio"
              name={`mcq-${exercise.id}`}
              checked={selectedIdx === idx}
              onChange={() => setSelectedIdx(idx)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.95rem', color: '#212529' }}>{opt}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 8 }}>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={running || selectedIdx === null}
          style={{ padding: '8px 22px', fontSize: '0.9rem' }}
        >
          {running ? 'Verifying Answer...' : 'Check Answer 🔘'}
        </button>
      </div>
    </div>
  )
}

export function ExactStringExercise({ exercise, onRunCode, running, runResult }) {
  const [answerInput, setAnswerInput] = useState('')

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    if (!answerInput.trim()) return
    onRunCode(answerInput.trim())
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#495057', display: 'block', marginBottom: 8 }}>
          Type your answer:
        </label>
        <input
          className="form-control"
          placeholder="Type your exact response here..."
          value={answerInput}
          onChange={e => setAnswerInput(e.target.value)}
          autoFocus
          style={{ padding: '12px 16px', fontSize: '1rem', borderRadius: 8, fontFamily: 'Consolas, Monaco, monospace' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={running || !answerInput.trim()}
          style={{ padding: '8px 22px', fontSize: '0.9rem' }}
        >
          {running ? 'Checking...' : 'Submit Answer ✏️'}
        </button>
      </div>
    </form>
  )
}

export function CodeEditorExercise({ exercise, practiceCode, setPracticeCode, onRunCode, running }) {
  const badge = langBadgeFor(exercise.language)

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057' }}>Code Solution</label>
        {/* Runtime is locked to the exercise's authored language — read-only badge */}
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 4,
          background: badge.bg,
          color: badge.color,
          letterSpacing: '0.02em'
        }}>
          🔒 {badge.label}
        </span>
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

      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 12 }}>
        <button className="btn-primary" onClick={() => onRunCode(practiceCode)} disabled={running} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
          {running ? 'Running Solution...' : '▶ Run Solution'}
        </button>
      </div>
    </div>
  )
}

export default function ExerciseRenderer({ exercise, practiceCode, setPracticeCode, practiceLang, setPracticeLang, onRunCode, running, runResult }) {
  const type = exercise.exerciseType || 'CodeExecution'

  if (type === 'MultipleChoice') {
    return <MultipleChoiceExercise exercise={exercise} onRunCode={onRunCode} running={running} runResult={runResult} />
  }

  if (type === 'ExactString') {
    return <ExactStringExercise exercise={exercise} onRunCode={onRunCode} running={running} runResult={runResult} />
  }

  return (
    <CodeEditorExercise
      exercise={exercise}
      practiceCode={practiceCode}
      setPracticeCode={setPracticeCode}
      onRunCode={onRunCode}
      running={running}
    />
  )
}

