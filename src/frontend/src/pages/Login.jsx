import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'
import { isValidEmail } from '../utils/validation'

export default function Login(){
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleEmailChange = (e) => {
    const val = e.target.value
    setEmail(val)
    if (emailError && isValidEmail(val)) {
      setEmailError('')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address (e.g. name@example.com)')
      return
    }

    setEmailError('')
    setIsLoading(true)
    try{
      await auth.login(email.trim(), password)
      window.location.href = '/decks'
    }catch(err){
      setErrorMessage(err.message || 'Login failed. Please check your credentials.')
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Log In to AnkiX</h2>

        {errorMessage && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: '0.9rem'
          }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="form-group">
            <label>Email</label>
            <input
              className="form-control"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => {
                if (email && !isValidEmail(email)) {
                  setEmailError('Please enter a valid email address (e.g. name@example.com)')
                } else {
                  setEmailError('')
                }
              }}
              style={emailError ? { borderColor: '#ef4444', backgroundColor: '#fff5f5' } : {}}
              required
            />
            {emailError && (
              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 4, fontWeight: 500 }}>
                {emailError}
              </div>
            )}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              required
              style={{ marginTop: 6 }}
            />
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
