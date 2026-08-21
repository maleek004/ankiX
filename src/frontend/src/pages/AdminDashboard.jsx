import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { getAdminMetrics } from '../api'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin'

  const loadMetrics = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    setError(null)
    try {
      const data = await getAdminMetrics()
      setMetrics(data)
      setLastRefreshedAt(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load platform metrics')
    } finally {
      if (!isBackground) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadMetrics()
    }
  }, [isAdmin, loadMetrics])

  useEffect(() => {
    if (!autoRefresh || !isAdmin) return
    const interval = setInterval(() => {
      loadMetrics(true)
    }, 30000) // 30s auto-refresh
    return () => clearInterval(interval)
  }, [autoRefresh, isAdmin, loadMetrics])

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: 16, padding: 40, boxShadow: '0 10px 25px rgba(239,68,68,0.08)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#991b1b', margin: '0 0 8px' }}>403 Access Denied</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 24px', lineHeight: 1.6 }}>
            The Platform Super-Admin Command Center is restricted to authorized platform administrators.
          </p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  const summary = metrics?.summary || {}
  const roles = metrics?.rolesBreakdown || {}
  const trends = metrics?.trends || {}

  const totalContent = (summary.totalDecks || 0) + (summary.totalCards || 0) + (summary.totalExercises || 0)
  const totalRuns = (summary.totalCardRuns || 0) + (summary.totalExerciseRuns || 0)
  const onlinePercent = summary.totalUsers > 0
    ? Math.round(((summary.onlineUsers || 0) / summary.totalUsers) * 100)
    : 0

  return (
    <div style={{ maxWidth: 1140, margin: '30px auto', padding: '0 20px' }}>
      {/* Dashboard Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
              🛡️ Super-Admin Command Center
            </h1>
            <span style={{
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              padding: '2px 10px',
              borderRadius: 20,
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Live Telemetry
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.92rem' }}>
            Real-time platform operational metrics, historical trends, and learner presence.
          </p>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.85rem',
            color: '#475569',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Auto-refresh (30s)
          </label>

          <button
            className="btn-study-tool"
            onClick={() => loadMetrics(false)}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ↻ {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>

          <Link
            to="/admin/users"
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', padding: '8px 14px' }}
          >
            👥 User Management →
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', marginBottom: 24, fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {loading && !metrics ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 600 }}>Aggregating system-wide telemetry...</div>
        </div>
      ) : (
        <>
          {/* KPI Summary Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
            marginBottom: 30
          }}>
            {/* Tile 1: Study Groups */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '20px 22px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Study Groups</span>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: 8, fontSize: '0.85rem' }}>👥</span>
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                  {summary.totalStudyGroups ?? 0}
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#059669', fontWeight: 600 }}>● Active spaces</span>
                <span>across platform</span>
              </div>
            </div>

            {/* Tile 2: Content Inserts */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '20px 22px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Content Created</span>
                  <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '4px 8px', borderRadius: 8, fontSize: '0.85rem' }}>🗂️</span>
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                  {totalContent.toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                  📚 {summary.totalDecks ?? 0} Decks
                </span>
                <span style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                  🃏 {summary.totalCards ?? 0} Cards
                </span>
                <span style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                  💻 {summary.totalExercises ?? 0} Exercises
                </span>
              </div>
            </div>

            {/* Tile 3: Activity Velocity */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '20px 22px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Activity Velocity</span>
                  <span style={{ background: '#fffbeb', color: '#d97706', padding: '4px 8px', borderRadius: 8, fontSize: '0.85rem' }}>⚡</span>
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                  {totalRuns.toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                  🔁 {(summary.totalCardRuns ?? 0).toLocaleString()} Card Reviews
                </span>
                <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                  ▶️ {(summary.totalExerciseRuns ?? 0).toLocaleString()} Code Runs
                </span>
              </div>
            </div>

            {/* Tile 4: Real-Time Presence */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '20px 22px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>User Presence</span>
                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: 8, fontSize: '0.85rem' }}>🟢</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>
                    {summary.onlineUsers ?? 0}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                    / {summary.totalUsers ?? 0} online ({onlinePercent}%)
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 6, width: '100%', background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${onlinePercent}%`, background: '#10b981', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{summary.onlineUsers ?? 0} active now</span>
                  <span>{summary.offlineUsers ?? 0} offline</span>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Trends & Visualizations Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 22,
            marginBottom: 30
          }}>
            {/* Chart 1: Study Groups Growth Trend */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 22,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                    📈 Study Groups Growth
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Monthly space creations</span>
                </div>
              </div>

              {trends.studyGroups && trends.studyGroups.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, paddingTop: 20, borderBottom: '1px solid #e2e8f0' }}>
                  {trends.studyGroups.map((pt, idx) => {
                    const maxVal = Math.max(...trends.studyGroups.map(p => p.count), 1)
                    const heightPct = Math.max(12, Math.round((pt.count / maxVal) * 100))
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>
                          {pt.count}
                        </span>
                        <div
                          style={{
                            width: '80%',
                            height: `${heightPct}%`,
                            background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease'
                          }}
                          title={`${pt.period}: ${pt.count} groups`}
                        />
                        <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6, whiteSpace: 'nowrap' }}>
                          {pt.period}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No historical trend points recorded yet.
                </div>
              )}
            </div>

            {/* Chart 2: Activity Runs Velocity */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 22,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                    ⚡ Activity Velocity
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Card reviews vs code exercise runs</span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem' }}>
                  <span style={{ color: '#d97706', fontWeight: 600 }}>■ Card Runs</span>
                  <span style={{ color: '#4f46e5', fontWeight: 600 }}>■ Code Runs</span>
                </div>
              </div>

              {trends.activityRuns && trends.activityRuns.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, paddingTop: 20, borderBottom: '1px solid #e2e8f0' }}>
                  {trends.activityRuns.map((pt, idx) => {
                    const maxVal = Math.max(...trends.activityRuns.map(p => p.totalRuns || (p.cardRuns + p.exerciseRuns)), 1)
                    const cardHeight = Math.round((pt.cardRuns / maxVal) * 100)
                    const exHeight = Math.round((pt.exerciseRuns / maxVal) * 100)
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          {pt.totalRuns}
                        </span>
                        <div style={{ width: '80%', display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%', justifyContent: 'center' }}>
                          <div
                            style={{
                              width: '50%',
                              height: `${Math.max(8, cardHeight)}%`,
                              background: '#f59e0b',
                              borderRadius: '3px 3px 0 0'
                            }}
                            title={`Card Runs: ${pt.cardRuns}`}
                          />
                          <div
                            style={{
                              width: '50%',
                              height: `${Math.max(8, exHeight)}%`,
                              background: '#6366f1',
                              borderRadius: '3px 3px 0 0'
                            }}
                            title={`Code Runs: ${pt.exerciseRuns}`}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6, whiteSpace: 'nowrap' }}>
                          {pt.period}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No execution activity recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Grid: Roles Breakdown & System Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 22
          }}>
            {/* Roles Breakdown */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 22,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                    👥 Learner Role Distribution
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Platform authorization hierarchy</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#7c3aed' }}>🛡️ Super Admin</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{roles.superAdmin ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2563eb' }}>⚡ Admin</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{roles.admin ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#059669' }}>✍️ Contributor</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{roles.contributor ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>👤 Standard User</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{roles.user ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions & System Status */}
            <div style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 22,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                  ⚙️ Admin Shortcuts
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b' }}>
                  Quick links to administrative controls and governance.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link
                    to="/admin/users"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: '#f1f5f9',
                      color: '#0f172a',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '0.88rem'
                    }}
                  >
                    <span>👥 Manage User Roles & Accounts</span>
                    <span>→</span>
                  </Link>

                  <Link
                    to="/study-groups"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: '#f1f5f9',
                      color: '#0f172a',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '0.88rem'
                    }}
                  >
                    <span>📦 Inspect Study Groups</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {lastRefreshedAt && (
                <div style={{ marginTop: 20, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>
                  Telemetry aggregated: {lastRefreshedAt.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
