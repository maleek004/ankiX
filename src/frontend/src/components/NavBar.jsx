import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import { getEffectiveDisplayName } from '../api'

export default function NavBar(){
  const auth = useAuth()
  const navigate = useNavigate()
  const { activeStudyGroup, clearStudyGroup } = useStudyGroup() || {}

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Link to="/" className="navbar-brand">
          AnkiX
        </Link>
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
              <li><Link to="/study-groups" className="nav-link">👥 Study Groups</Link></li>
            ) : null}
            {auth?.user?.role === 'Admin' && (
              <li><Link to="/admin/users" className="nav-link">👥 Users</Link></li>
            )}
            {auth?.user && (
              <li><Link to="/search" className="nav-link">🔍 Search</Link></li>
            )}
          </ul>
        </nav>
      </div>

      <div className="navbar-right">
        {auth?.user ? (
          <>
            <span>{getEffectiveDisplayName(auth.user.displayName, auth.user.email)}</span>
            <button className="btn-logout" onClick={auth.logout}>Log Out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Log In</Link>
            <Link to="/register" className="nav-link">Account</Link>
          </>
        )}
      </div>
    </header>
  )
}
