import React, { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from './SocialButtons'
import { isValidEmail } from '../utils/validation'

export default function ReAuthModal({
  isOpen,
  onClose,
  onSuccess
}) {
  const auth = useAuth()
  const currentEmail = auth?.user?.email || ''
  const [email, setEmail] = useState(currentEmail)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Sync initial email when modal opens
  React.useEffect(() => {
    if (isOpen && auth?.user?.email) {
      setEmail(auth.user.email)
    }
  }, [isOpen, auth?.user?.email])

  if (!isOpen) return null

  const submit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    const targetEmail = (email || currentEmail).trim()
    if (!targetEmail || !isValidEmail(targetEmail)) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    if (!password) {
      setErrorMessage('Please enter your password.')
      return
    }

    setIsLoading(true)
    try {
      await auth.login(targetEmail, password)
      setPassword('')
      setErrorMessage('')
      if (onSuccess) onSuccess()
      if (onClose) onClose()
    } catch (err) {
      let msg = err.message || 'Authentication failed. Please check your password.'
      try {
        if (typeof msg === 'string' && msg.trim().startsWith('{')) {
          const parsed = JSON.parse(msg)
          msg = parsed.message || parsed.detail || msg
        }
      } catch {}
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="mobile-bottom-sheet-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="card mobile-bottom-sheet-content"
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'none',
            border: 'none',
            fontSize: 20,
            color: '#94a3b8',
            cursor: 'pointer'
          }}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🔒</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', color: '#0f172a' }}>
            Session Expired
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', lineHeight: 1.45 }}>
            Please confirm your password to refresh your session without losing any unsaved work.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '10px 12px',
              borderRadius: 6,
              marginBottom: 14,
              fontSize: '0.85rem',
              lineHeight: 1.4
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label htmlFor="reauth-email" style={{ fontSize: '0.85rem' }}>Email</label>
            <input
              id="reauth-email"
              className="form-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ marginTop: 4 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="reauth-password" style={{ fontSize: '0.85rem' }}>Password</label>
            <input
              id="reauth-password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              required
              style={{ marginTop: 4 }}
            />
          </div>

          <button
            disabled={isLoading}
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '10px 0' }}
          >
            {isLoading ? 'Re-authenticating...' : 'Resume Session'}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <SocialButtons mode="login" />
        </div>
      </div>
    </div>
  )
}
