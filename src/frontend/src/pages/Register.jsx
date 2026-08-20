import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'
import { isValidEmail } from '../utils/validation'

export default function Register(){
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [error, setError] = useState('')

  const auth = useAuth()

  const handleDisplayNameChange = (e) => {
    setDisplayName(e.target.value)
    if (error) setError('')
  }

  const handleEmailChange = (e) => {
    const val = e.target.value
    setEmail(val)
    if (error) setError('')
    if (emailError && isValidEmail(val)) {
      setEmailError('')
    }
  }

  const handlePasswordChange = (e) => {
    const val = e.target.value
    setPassword(val)
    if (error) setError('')
    if (passwordError && val.length >= 8) {
      setPasswordError('')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setPasswordError('')

    let hasError = false
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address (e.g. name@example.com)')
      hasError = true
    }

    if (!password || password.length < 8) {
      setPasswordError('Password must be at least 8 characters long')
      hasError = true
    }

    if (hasError) return

    setIsLoading(true)
    try{
      await auth.register(email.trim(), password, displayName.trim())
      setRegistered(true)
    }catch(err){
      let msg = err.message || 'Registration failed. Please try again.'
      try {
        if (typeof msg === 'string' && msg.trim().startsWith('{')) {
          const parsed = JSON.parse(msg)
          msg = parsed.message || parsed.detail || parsed.title || msg
        }
      } catch {}
      setError(msg)
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
                We've dispatched a verification link to <strong>{email}</strong>. Please check your inbox (and spam folder) to verify your email.
              </p>
            </div>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
              Proceed to Log In
            </Link>
          </div>
        ) : (
          <>
            {error && (
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
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={submit} noValidate>
              <div className="form-group">
                <label htmlFor="reg-displayName">Display Name</label>
                <input
                  id="reg-displayName"
                  className="form-control"
                  type="text"
                  placeholder="e.g. Alex Smith"
                  value={displayName}
                  onChange={handleDisplayNameChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
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
                <label htmlFor="reg-password">Password (min 8 characters)</label>
                <input
                  id="reg-password"
                  className="form-control"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  style={passwordError ? { borderColor: '#ef4444', backgroundColor: '#fff5f5' } : {}}
                  required
                  minLength={8}
                />
                {passwordError && (
                  <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 4, fontWeight: 500 }}>
                    {passwordError}
                  </div>
                )}
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
