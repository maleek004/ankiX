import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'

export default function Register(){
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState('')

  const auth = useAuth()
  const submit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try{
      await auth.register(email, password, displayName)
      setRegistered(true)
    }catch(err){
      setError(err.message || 'Registration failed. Please try again.')
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Create an Account on AnkiX</h2>

        {registered ? (
          <div>
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              padding: '16px',
              marginBottom: 20
            }}>
              <p style={{ color: '#166534', margin: 0, fontWeight: 600, fontSize: '1rem' }}>
                🎉 Account created successfully!
              </p>
              <p style={{ color: '#15803d', margin: '8px 0 0 0', fontSize: '0.9rem', lineHeight: 1.5 }}>
                We've sent a verification link to <strong>{email}</strong>. Please check your inbox to verify your account.
              </p>
            </div>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
              Proceed to Log In
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: '0.9rem'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <div className="form-group">
                <label>Display Name</label>
                <input className="form-control" type="text" placeholder="e.g. Alex Smith" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Password (min 8 characters)</label>
                <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} />
              </div>
              <button disabled={isLoading} type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {isLoading ? "Registering..." : "Create Account"}
              </button>
            </form>

            <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.9rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
                Log in
              </Link>
            </div>

            <SocialButtons mode="register" />
          </>
        )}
      </div>
    </div>
  )
}



