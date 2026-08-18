import React, { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { sendVerificationEmail } from '../api'

export default function EmailVerificationBanner() {
  const auth = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState('')

  const isOAuth = (auth?.user?.authProvider && auth.user.authProvider !== 'local') ||
                  (auth?.user?.AuthProvider && auth.user.AuthProvider !== 'local') ||
                  Boolean(auth?.user?.googleId || auth?.user?.GoogleId || auth?.user?.gitHubId || auth?.user?.GitHubId)

  const isVerified = auth?.user?.isEmailVerified === true ||
                     auth?.user?.IsEmailVerified === true ||
                     auth?.user?.email_verified === 'true' ||
                     isOAuth

  if (!auth?.user || isVerified || dismissed) {
    return null
  }

  const handleResend = async () => {
    setSending(true)
    setError('')
    try {
      await sendVerificationEmail(auth.user.email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send verification email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      backgroundColor: '#fffbeb',
      borderBottom: '1px solid #fef3c7',
      color: '#92400e',
      padding: '8px 16px',
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      zIndex: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>⚠️</span>
        <span>
          Your email address (<strong>{auth.user.email}</strong>) is not yet verified.
        </span>
        {sent ? (
          <span style={{ color: '#166534', fontWeight: 600, marginLeft: 6 }}>
            ✓ Verification email sent! Please check your inbox.
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            style={{
              background: 'none',
              border: 'none',
              color: '#b45309',
              fontWeight: 600,
              textDecoration: 'underline',
              cursor: sending ? 'wait' : 'pointer',
              padding: 0,
              marginLeft: 6
            }}
          >
            {sending ? 'Sending...' : 'Resend Verification Link'}
          </button>
        )}
        {error && <span style={{ color: '#b91c1c', marginLeft: 6 }}>({error})</span>}
      </div>

      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#92400e',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '0 4px',
          lineHeight: 1
        }}
        title="Dismiss notice"
      >
        ×
      </button>
    </div>
  )
}
