import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function NavBar(){
  const auth = useAuth()
  const navigate = useNavigate()

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Link to="/" className="navbar-brand">
          AnkiX
        </Link>
        <nav>
          <ul className="navbar-nav">
            <li><Link to="/decks" className="nav-link">Decks</Link></li>
            <li><Link to="/exercises" className="nav-link">Exercises</Link></li>
            <li><span className="nav-link" onClick={() => alert('Search feature coming soon')}>Search</span></li>
          </ul>
        </nav>
      </div>

      <div className="navbar-right">
        {auth?.user ? (
          <>
            <span>{auth.user.displayName || auth.user.email}</span>
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
