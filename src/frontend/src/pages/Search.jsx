import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { globalSearch, getEffectiveDisplayName } from '../api'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import ExercisePracticeModal from './Exercises'

export default function Search() {
  const { activeStudyGroup } = useStudyGroup() || {}
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all') // 'all' | 'decks' | 'cards' | 'exercises' | 'followups'
  const [searchScope, setSearchScope] = useState(activeStudyGroup ? 'current' : 'all_joined') // 'current' | 'all_joined'
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({ decks: [], cards: [], exercises: [], followups: [] })
  const [activePracticeExercise, setActivePracticeExercise] = useState(null)

  const navigate = useNavigate()

  const targetGroupId = (searchScope === 'current' && activeStudyGroup) ? activeStudyGroup.id : null

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults({ decks: [], cards: [], exercises: [], followups: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      globalSearch(query, targetGroupId)
        .then(data => setResults(data || { decks: [], cards: [], exercises: [], followups: [] }))
        .catch(err => console.error(err))
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [query, targetGroupId])

  const totalDecks = results.decks?.length || 0
  const totalCards = results.cards?.length || 0
  const totalExercises = results.exercises?.length || 0
  const totalFollowups = results.followups?.length || 0
  const totalResults = totalDecks + totalCards + totalExercises + totalFollowups

  return (
    <div style={{ maxWidth: 960, margin: '30px auto', padding: '0 16px' }}>
      {/* Search Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>🔍 Platform Search</h2>
        <p style={{ color: '#6c757d', fontSize: '0.95rem', marginTop: 4 }}>
          {searchScope === 'current' && activeStudyGroup
            ? `Searching strictly within "${activeStudyGroup.name}"`
            : `Searching across all study groups you have joined`}
        </p>

        {/* Scope selector toggle if activeStudyGroup is set */}
        {activeStudyGroup && (
          <div style={{ display: 'inline-flex', gap: 6, marginTop: 10, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
            <button
              className="btn"
              style={{
                padding: '4px 12px',
                fontSize: '0.85rem',
                borderRadius: 6,
                fontWeight: 600,
                background: searchScope === 'current' ? '#fff' : 'transparent',
                color: searchScope === 'current' ? '#0d6efd' : '#64748b',
                boxShadow: searchScope === 'current' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
              onClick={() => setSearchScope('current')}
            >
              📦 Current Group ({activeStudyGroup.name})
            </button>
            <button
              className="btn"
              style={{
                padding: '4px 12px',
                fontSize: '0.85rem',
                borderRadius: 6,
                fontWeight: 600,
                background: searchScope === 'all_joined' ? '#fff' : 'transparent',
                color: searchScope === 'all_joined' ? '#0d6efd' : '#64748b',
                boxShadow: searchScope === 'all_joined' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
              onClick={() => setSearchScope('all_joined')}
            >
              🌐 All Joined Groups
            </button>
          </div>
        )}
      </div>

      {/* Large Input Field */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="form-control"
          placeholder={
            searchScope === 'current' && activeStudyGroup
              ? `Search decks, cards, exercises, follow-ups in ${activeStudyGroup.name}...`
              : "Search decks, cards, exercises, follow-ups in your joined study groups..."
          }
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          style={{
            padding: '14px 20px',
            fontSize: '1.1rem',
            borderRadius: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}
        />
      </div>

      {/* Category Pills */}
      {query.trim().length >= 2 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <button
            className="btn-study-tool"
            style={{ background: activeCategory === 'all' ? '#0d6efd' : '#fff', color: activeCategory === 'all' ? '#fff' : '#495057', borderColor: '#0d6efd' }}
            onClick={() => setActiveCategory('all')}
          >
            All Results ({totalResults})
          </button>
          <button
            className="btn-study-tool"
            style={{ background: activeCategory === 'decks' ? '#0d6efd' : '#fff', color: activeCategory === 'decks' ? '#fff' : '#495057', borderColor: '#0d6efd' }}
            onClick={() => setActiveCategory('decks')}
          >
            📚 Decks ({totalDecks})
          </button>
          <button
            className="btn-study-tool"
            style={{ background: activeCategory === 'cards' ? '#0d6efd' : '#fff', color: activeCategory === 'cards' ? '#fff' : '#495057', borderColor: '#0d6efd' }}
            onClick={() => setActiveCategory('cards')}
          >
            🎴 Flashcards ({totalCards})
          </button>
          <button
            className="btn-study-tool"
            style={{ background: activeCategory === 'exercises' ? '#0d6efd' : '#fff', color: activeCategory === 'exercises' ? '#fff' : '#495057', borderColor: '#0d6efd' }}
            onClick={() => setActiveCategory('exercises')}
          >
            ⚡ Coding Exercises ({totalExercises})
          </button>
          <button
            className="btn-study-tool"
            style={{ background: activeCategory === 'followups' ? '#0d6efd' : '#fff', color: activeCategory === 'followups' ? '#fff' : '#495057', borderColor: '#0d6efd' }}
            onClick={() => setActiveCategory('followups')}
          >
            💬 Follow-ups ({totalFollowups})
          </button>
        </div>
      )}

      {/* Results Container */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>Searching platform catalog...</div>
      ) : query.trim().length < 2 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          Type at least 2 characters to search across AnkiX.
        </div>
      ) : totalResults === 0 ? (
        <div className="empty-state">No matching results found for "{query}". Try another search term!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Decks Category */}
          {(activeCategory === 'all' || activeCategory === 'decks') && totalDecks > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#495057', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                📚 Decks ({totalDecks})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {results.decks.map(d => (
                  <div
                    key={d.id}
                    className="card"
                    style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    onClick={() => navigate(`/decks/${d.id}`)}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#0d6efd' }}>{d.title}</h4>
                      {d.description && <p style={{ margin: 0, fontSize: '0.85rem', color: '#6c757d' }}>{d.description}</p>}
                    </div>
                    <div style={{ marginTop: 12, fontSize: '0.75rem', fontWeight: 600, color: '#495057' }}>
                      {d.cardCount} Cards
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flashcards Category */}
          {(activeCategory === 'all' || activeCategory === 'cards') && totalCards > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#495057', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                🎴 Flashcards ({totalCards})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.cards.map(c => (
                  <div
                    key={c.id}
                    style={{
                      padding: 14,
                      background: '#fff',
                      border: '1px solid #dee2e6',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/decks/${c.deckId}`)}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: '0.95rem' }}>{c.prompt}</strong>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#e7f5ff', color: '#1864ab' }}>
                          {c.type}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                          in <strong>{c.deckTitle}</strong>
                        </span>
                      </div>
                      {c.validationSpec && (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6c757d', fontFamily: 'Consolas, Monaco, monospace' }}>
                          Answer: {c.validationSpec}
                        </p>
                      )}
                    </div>

                    <button className="btn-study-tool" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      Study Card ➔
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coding Exercises Category */}
          {(activeCategory === 'all' || activeCategory === 'exercises') && totalExercises > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#495057', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚡ Coding Exercises ({totalExercises})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.exercises.map(ex => (
                  <div
                    key={ex.id}
                    style={{
                      padding: 14,
                      background: '#fff',
                      border: '1px solid #dee2e6',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: '0.95rem' }}>{ex.title}</strong>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#fff3bf', color: '#f59f00' }}>
                          {ex.language}
                        </span>
                      </div>
                      {ex.description && <p style={{ margin: 0, fontSize: '0.85rem', color: '#6c757d' }}>{ex.description}</p>}
                    </div>

                    <button
                      className="btn-primary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                      onClick={() => setActivePracticeExercise(ex)}
                    >
                      ▶ Practice Code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-ups Category */}
          {(activeCategory === 'all' || activeCategory === 'followups') && totalFollowups > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#495057', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                💬 Follow-up Questions ({totalFollowups})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.followups.map(f => (
                  <div
                    key={f.id}
                    style={{
                      padding: 14,
                      background: '#fff',
                      border: '1px solid #dee2e6',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/decks/${f.deckId}`)}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: '0.95rem' }}>"{f.questionText}"</strong>
                        {f.isAnswered ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#d3f9d8', color: '#2b8a3e' }}>
                            ✓ Answered
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#f1f3f5', color: '#495057' }}>
                            Pending
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                        Asked by {getEffectiveDisplayName(f.authorDisplayName, f.authorDisplayName)} in <strong>{f.deckTitle}</strong>
                      </span>
                    </div>

                    <button className="btn-study-tool" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      Open Deck ➔
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Floating Practice Modal for Code Exercises */}
      {activePracticeExercise && (
        <ExercisePracticeModal
          exercises={[activePracticeExercise]}
          initialIndex={0}
          onClose={() => setActivePracticeExercise(null)}
        />
      )}
    </div>
  )
}
