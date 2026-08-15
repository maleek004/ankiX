import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [isLoading, setIsLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setError('No verification token was provided.')
      return
    }

    const doVerify = async () => {
      try {
        await verifyEmail(token)
        setVerified(true)
      } catch (err) {
        setError(err.message || 'Verification token is invalid or has expired.')
      } finally {
        setIsLoading(false)
      }
    }

    doVerify()
  }, [token])

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Email Verification</h2>

        {isLoading ? (
          <p style={{ color: '#64748b' }}>Verifying your email address...</p>
        ) : verified ? (
          <div>
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              padding: '16px',
              marginBottom: 20
            }}>
              <p style={{ color: '#166534', margin: 0, fontWeight: 500 }}>
                Your email address has been successfully verified!
              </p>
            </div>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
              Proceed to Log In
            </Link>
          </div>
        ) : (
          <div>
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              padding: '16px',
              marginBottom: 20
            }}>
              <p style={{ color: '#991b1b', margin: 0, fontWeight: 500 }}>
                {error || 'Email verification link is invalid or has expired.'}
              </p>
            </div>
            <Link to="/login" className="btn-secondary" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
              Back to Log In
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
