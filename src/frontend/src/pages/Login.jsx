import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'
import { isValidEmail } from '../utils/validation'
import { resolvePostLoginRedirect } from '../utils/intent'

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
    if (errorMessage) {
      setErrorMessage('')
    }
    if (emailError && isValidEmail(val)) {
      setEmailError('')
    }
  }

  const handlePasswordChange = (e) => {
    const val = e.target.value
    setPassword(val)
    if (errorMessage) {
      setErrorMessage('')
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
      window.location.href = resolvePostLoginRedirect('/decks')
    }catch(err){
      let msg = err.message || 'Invalid email or password. Please check your credentials.'
      try {
        if (typeof msg === 'string' && msg.trim().startsWith('{')) {
          const parsed = JSON.parse(msg)
          msg = parsed.message || parsed.detail || parsed.title || msg
        }
      } catch {}
      setErrorMessage(msg)
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Log In to AnkiX</h2>

        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '12px 14px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              lineHeight: 1.45
            }}
          >
            <svg
              style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: '#dc2626' }}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
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
              <label htmlFor="password" style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              className="form-control"
              type="password"
              value={password}
              onChange={handlePasswordChange}
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
