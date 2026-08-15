import React, { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword, verifyResetToken } from '../api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setIsVerifying(false)
      setError('No reset token was provided in the URL.')
      return
    }

    const checkToken = async () => {
      try {
        const res = await verifyResetToken(token)
        if (res.valid) {
          setTokenValid(true)
          if (res.email) setUserEmail(res.email)
        }
      } catch (err) {
        setTokenValid(false)
        setError(err.message || 'The reset link is invalid or has expired.')
      } finally {
        setIsVerifying(false)
      }
    }

    checkToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try requesting a new link.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <div className="form-card">
          <p style={{ color: '#64748b' }}>Verifying reset token...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Reset Your Password</h2>

        {success ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 6,
            padding: '16px',
            marginBottom: 20
          }}>
            <p style={{ color: '#166534', margin: 0, fontWeight: 500 }}>
              Your password has been successfully updated! You can now log in with your new credentials.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                Go to Log In
              </Link>
            </div>
          </div>
        ) : !tokenValid ? (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '16px',
            marginBottom: 20
          }}>
            <p style={{ color: '#991b1b', margin: 0, fontWeight: 500 }}>
              {error || 'This password reset link is invalid or has expired (links expire in 15 minutes).'}
            </p>
            <div style={{ marginTop: 16 }}>
              <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                Request a New Reset Link
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {userEmail && (
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 16 }}>
                Resetting password for: <strong>{userEmail}</strong>
              </p>
            )}

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
              <label>New Password (min 8 characters)</label>
              <input
                className="form-control"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                className="form-control"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: 8 }}
            >
              {isLoading ? 'Updating Password...' : 'Update Password'}
            </button>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>
                Back to Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
