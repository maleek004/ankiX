import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Failed to submit password reset request.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Forgot Password</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: 20 }}>
          Enter the email address associated with your account, and we'll send you a link to reset your password.
        </p>

        {submitted ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 6,
            padding: '16px',
            marginBottom: 20
          }}>
            <p style={{ color: '#166534', margin: 0, fontWeight: 500 }}>
              If your email is registered, a password reset link has been dispatched. Please check your inbox (and spam folder) for instructions.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link to="/login" className="btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Back to Log In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
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

            <div className="form-group">
              <label>Email Address</label>
              <input
                className="form-control"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: 8 }}
            >
              {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>
                Remember your password? Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
