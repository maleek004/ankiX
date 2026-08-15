import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'

export default function Login(){
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')

  const submit = async (e) => {
    setIsLoading(true)
    e.preventDefault()
    try{
      await auth.login(email, password)
      window.location.href = '/decks'
    }catch(err){
      alert('Login failed: ' + (err.message || err))
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Log In to AnkiX</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={{ marginTop: 6 }} />
          </div>
          <button disabled={isLoading} type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.9rem' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#2563eb', textDecoration: 'none' }}>
            Sign up
          </Link>
        </div>
        <SocialButtons mode="login" />
      </div>
    </div>
  )
}


