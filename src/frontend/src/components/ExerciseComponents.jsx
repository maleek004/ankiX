import React, { useState, useEffect } from 'react'
import MarkdownViewer from './MarkdownViewer'
import { getTagBadge, langBadgeFor } from '../utils/tagUtils'

export function MultipleChoiceExercise({ exercise, onRunCode, running, runResult }) {
  const [selectedIdx, setSelectedIdx] = useState(null)

  useEffect(() => {
    setSelectedIdx(null)
  }, [exercise?.id])

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
              style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
            />
            <div style={{ flex: 1, fontSize: '0.95rem', color: '#212529' }}>
              <MarkdownViewer content={opt} compact style={{ margin: 0, fontSize: 'inherit', lineHeight: 1.4 }} />
            </div>
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

  useEffect(() => {
    setAnswerInput('')
  }, [exercise?.id])

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
          {running ? 'Verifying...' : 'Check Answer ✏️'}
        </button>
      </div>
    </form>
  )
}

export function CodeEditorExercise({ exercise, practiceCode, setPracticeCode, onRunCode, running }) {
  const badge = langBadgeFor(exercise.language)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#495057' }}>
          Your Solution Code ({badge.label}):
        </label>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '2px 8px',
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
  const type = exercise?.exerciseType || 'CodeExecution'

  if (type === 'MultipleChoice') {
    return <MultipleChoiceExercise key={exercise?.id} exercise={exercise} onRunCode={onRunCode} running={running} runResult={runResult} />
  }

  if (type === 'ExactString') {
    return <ExactStringExercise key={exercise?.id} exercise={exercise} onRunCode={onRunCode} running={running} runResult={runResult} />
  }

  return (
    <CodeEditorExercise
      key={exercise?.id}
      exercise={exercise}
      practiceCode={practiceCode}
      setPracticeCode={setPracticeCode}
      onRunCode={onRunCode}
      running={running}
    />
  )
}
