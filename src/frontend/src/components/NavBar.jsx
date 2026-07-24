import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function NavBar(){
  const auth = useAuth()
  return (
    <nav style={{display:'flex',gap:12,alignItems:'center',padding:'8px 0'}}>
      <Link to="/">Home</Link>
      <Link to="/decks">Decks</Link>
      {auth?.user ? (
        <>
          <span>Hi {auth.user.displayName || auth.user.email}</span>
          <button onClick={auth.logout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  )
}
