import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import { getEffectiveDisplayName } from '../api'

export default function NavBar() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeStudyGroup, clearStudyGroup } = useStudyGroup() || {}
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const closeDrawer = () => setDrawerOpen(false)

  const isAdmin = auth?.user?.role === 'Admin' || auth?.user?.role === 'SuperAdmin'

  return (
    <>
      {/* ── Desktop & Mobile Header Bar ── */}
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link to="/" className="navbar-brand" onClick={closeDrawer}>
            AnkiX
          </Link>
          {/* Desktop nav links (hidden on mobile via CSS) */}
          <nav>
            <ul className="navbar-nav">
              {auth?.user && activeStudyGroup ? (
                <>
                  <li>
                    <Link
                      to="/study-groups"
                      className="nav-link"
                      onClick={() => clearStudyGroup()}
                      style={{
                        background: 'rgba(99,102,241,0.12)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontWeight: 600
                      }}
                      title="Switch study group"
                    >
                      📦 {activeStudyGroup.name} ▾
                    </Link>
                  </li>
                  <li><Link to="/decks" className="nav-link">Decks</Link></li>
                  <li><Link to="/exercises" className="nav-link">Exercises</Link></li>
                </>
              ) : auth?.user ? (
                <>
                  <li><Link to="/study-groups" className="nav-link">👥 Study Groups</Link></li>
                  <li><Link to="/decks" className="nav-link">Decks</Link></li>
                  <li><Link to="/exercises" className="nav-link">Exercises</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/study-groups" className="nav-link">👥 Study Groups</Link></li>
                  <li><Link to="/decks" className="nav-link">Decks</Link></li>
                  <li><Link to="/exercises" className="nav-link">Exercises</Link></li>
                </>
              )}
              {isAdmin && (
                <li><Link to="/admin" className="nav-link">🛡️ Admin</Link></li>
              )}
              <li><Link to="/search" className="nav-link">🔍 Search</Link></li>
            </ul>
          </nav>
        </div>

        {/* Desktop right section (hidden on mobile via CSS) */}
        <div className="navbar-right">
          {auth?.user ? (
            <>
              <span>{getEffectiveDisplayName(auth.user.displayName, auth.user.email)}</span>
              <button className="btn-logout" onClick={auth.logout}>Log Out</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: 12, fontWeight: 600 }}>Guest</span>
              <Link to="/login" className="nav-link">Log In</Link>
              <Link to="/register" className="nav-link">Account</Link>
            </>
          )}
        </div>

        {/* Hamburger button (mobile only, shown via CSS) */}
        <button
          className="navbar-hamburger"
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          ☰
        </button>
      </header>

      {/* ── Mobile Slide-Out Drawer ── */}
      {/* Backdrop */}
      <div
        className={`mobile-nav-backdrop${drawerOpen ? ' open' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <nav className={`mobile-nav-drawer${drawerOpen ? ' open' : ''}`} aria-label="Mobile navigation">
        <div className="mobile-nav-drawer-header">
          <Link to="/" className="navbar-brand" onClick={closeDrawer}>
            AnkiX
          </Link>
          <button
            className="mobile-nav-drawer-close"
            aria-label="Close navigation menu"
            onClick={closeDrawer}
          >
            ✕
          </button>
        </div>

        <ul className="mobile-nav-links">
          {auth?.user && activeStudyGroup ? (
            <>
              <li>
                <Link
                  to="/study-groups"
                  className="nav-link"
                  onClick={() => { clearStudyGroup(); closeDrawer() }}
                >
                  📦 {activeStudyGroup.name} — Switch Group
                </Link>
              </li>
              <li><Link to="/decks" className="nav-link" onClick={closeDrawer}>📚 Decks</Link></li>
              <li><Link to="/exercises" className="nav-link" onClick={closeDrawer}>⚡ Exercises</Link></li>
            </>
          ) : (
            <>
              <li><Link to="/study-groups" className="nav-link" onClick={closeDrawer}>👥 Study Groups</Link></li>
              <li><Link to="/decks" className="nav-link" onClick={closeDrawer}>📚 Decks</Link></li>
              <li><Link to="/exercises" className="nav-link" onClick={closeDrawer}>⚡ Exercises</Link></li>
            </>
          )}
          {isAdmin && (
            <li><Link to="/admin" className="nav-link" onClick={closeDrawer}>🛡️ Admin</Link></li>
          )}
          <li><Link to="/search" className="nav-link" onClick={closeDrawer}>🔍 Search</Link></li>
        </ul>

        <div className="mobile-nav-footer">
          {auth?.user ? (
            <>
              <span className="mobile-nav-user-info">
                {getEffectiveDisplayName(auth.user.displayName, auth.user.email)}
              </span>
              <button
                className="btn-logout"
                style={{ width: '100%', minHeight: 44, textAlign: 'center' }}
                onClick={() => { auth.logout(); closeDrawer() }}
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="btn-primary"
                style={{ textAlign: 'center', textDecoration: 'none', padding: '12px 0', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                onClick={closeDrawer}
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="btn-study-tool"
                style={{ textAlign: 'center', textDecoration: 'none', padding: '12px 0', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                onClick={closeDrawer}
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
