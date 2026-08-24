import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { getProfile, updateProfile, sendVerificationEmail, getEffectiveDisplayName } from '../api'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit display name state
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(null)
  const [nameError, setNameError] = useState(null)

  // Resend verification state
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState(null)
  const [verificationError, setVerificationError] = useState(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const timersRef = useRef([])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  const setSafeTimeout = (fn, delay) => {
    const id = setTimeout(fn, delay)
    timersRef.current.push(id)
    return id
  }

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  useEffect(() => {
    let isMounted = true
    async function loadProfile() {
      try {
        setLoading(true)
        setError(null)
        const data = await getProfile()
        if (isMounted) {
          setProfileData(data)
          setDisplayNameInput(data.displayName || user?.displayName || '')
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load profile details')
          if (user) {
            setDisplayNameInput(user.displayName || '')
          }
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadProfile()
    return () => { isMounted = false }
  }, [user?.id])

  const handleUpdateDisplayName = async (e) => {
    e.preventDefault()
    if (savingName) return
    setNameSuccess(null)
    setNameError(null)

    const trimmed = displayNameInput.trim()
    if (trimmed.length < 2 || trimmed.length > 50) {
      setNameError('Display name must be between 2 and 50 characters.')
      return
    }

    try {
      setSavingName(true)
      const res = await updateProfile(trimmed)
      setProfileData(prev => ({
        ...prev,
        displayName: res.displayName
      }))
      setDisplayNameInput(res.displayName)
      updateUser({
        displayName: res.displayName
      })
      setNameSuccess('Display name updated successfully!')
      setSafeTimeout(() => setNameSuccess(null), 4000)
    } catch (err) {
      setNameError(err.message || 'Failed to update display name.')
    } finally {
      setSavingName(false)
    }
  }

  const handleResendVerification = async () => {
    if (sendingVerification || resendCooldown > 0) return
    const targetEmail = profileData?.email || user?.email
    if (!targetEmail) return
    try {
      setSendingVerification(true)
      setVerificationSuccess(null)
      setVerificationError(null)
      await sendVerificationEmail(targetEmail)
      setVerificationSuccess('Verification email sent! Please check your inbox.')
      setResendCooldown(30)
      setSafeTimeout(() => setVerificationSuccess(null), 5000)
    } catch (err) {
      setVerificationError(err.message || 'Failed to send verification email.')
    } finally {
      setSendingVerification(false)
    }
  }

  const currentDisplayName = profileData?.displayName || user?.displayName || ''
  const currentEmail = profileData?.email || user?.email || ''
  const effectiveName = getEffectiveDisplayName(currentDisplayName, currentEmail)
  const userRole = profileData?.role || user?.role || 'User'
  const authProvider = profileData?.authProvider || user?.authProvider || 'local'
  const isEmailVerified = profileData?.isEmailVerified ?? user?.isEmailVerified ?? false
  const createdAt = profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Recently'

  const initialLetter = (effectiveName && Array.from(effectiveName).length > 0 ? Array.from(effectiveName)[0] : 'U').toUpperCase()

  const providerLabels = {
    local: { label: 'Local Email', icon: '📧', color: '#6366f1' },
    google: { label: 'Google Account', icon: '🌐', color: '#ea4335' },
    github: { label: 'GitHub Account', icon: '🐙', color: '#24292f' }
  }
  const providerInfo = providerLabels[authProvider.toLowerCase()] || { label: authProvider, icon: '🔑', color: '#64748b' }

  const isNameChanged = displayNameInput.trim() !== (currentDisplayName || '')

  return (
    <div style={{ maxWidth: 800, margin: '32px auto', padding: '0 16px' }} className="profile-page">
      {/* ── Top Header / Avatar Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: 16,
        padding: '32px 24px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        boxShadow: '0 10px 25px rgba(79, 70, 229, 0.2)',
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          border: '3px solid rgba(255, 255, 255, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          fontWeight: 700,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }} data-testid="profile-avatar">
          {initialLetter}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 700, color: '#fff' }} data-testid="profile-effective-name">
            {effectiveName}
          </h1>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }} data-testid="profile-email">
            {currentEmail}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              🛡️ {userRole}
            </span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              {providerInfo.icon} {providerInfo.label}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* ── Display Name Customization Card ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✏️ Display Name Customization
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 16px' }}>
            Your display name is shown on flashcard contributions, review progress, and study group presence.
          </p>

          <form onSubmit={handleUpdateDisplayName}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="displayNameInput" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Display Name
              </label>
              <input
                id="displayNameInput"
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Enter your preferred display name"
                maxLength={50}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                disabled={savingName || loading}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Between 2 and 50 characters</span>
                <span>{displayNameInput.length} / 50</span>
              </div>
            </div>

            {nameSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: 6, fontSize: '0.875rem', marginBottom: 14 }} data-testid="profile-success-msg">
                ✅ {nameSuccess}
              </div>
            )}

            {nameError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: '0.875rem', marginBottom: 14 }} data-testid="profile-error-msg">
                ⚠️ {nameError}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={savingName || loading || !isNameChanged || displayNameInput.trim().length < 2}
              style={{
                width: '100%',
                padding: '10px 0',
                cursor: (savingName || loading || !isNameChanged || displayNameInput.trim().length < 2) ? 'not-allowed' : 'pointer',
                opacity: (savingName || loading || !isNameChanged || displayNameInput.trim().length < 2) ? 0.6 : 1
              }}
            >
              {savingName ? 'Saving...' : 'Save Display Name'}
            </button>
          </form>
        </div>

        {/* ── Account Details & Verification Status ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 Account Metadata
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Authentication Provider</span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: providerInfo.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                {providerInfo.icon} {providerInfo.label}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Email Status</span>
              {isEmailVerified ? (
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                  ✓ Verified
                </span>
              ) : (
                <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                  ⏳ Pending Verification
                </span>
              )}
            </div>

            {!isEmailVerified && authProvider.toLowerCase() === 'local' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#92400e' }}>
                  Please verify your email address to ensure full account access and notifications.
                </p>
                {verificationSuccess && (
                  <div style={{ fontSize: '0.8rem', color: '#166534', marginBottom: 6 }}>
                    ✅ {verificationSuccess}
                  </div>
                )}
                {verificationError && (
                  <div style={{ fontSize: '0.8rem', color: '#991b1b', marginBottom: 6 }}>
                    ⚠️ {verificationError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={sendingVerification || resendCooldown > 0}
                  className="btn-study-tool"
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    width: '100%',
                    cursor: (sendingVerification || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                    opacity: (sendingVerification || resendCooldown > 0) ? 0.7 : 1
                  }}
                >
                  {sendingVerification ? 'Sending...' : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Verification Email'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Member Since</span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                {createdAt}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Security</span>
              <Link to="/forgot-password" style={{ color: '#4f46e5', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
                Change / Reset Password →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Learning Snapshot Card ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          gridColumn: '1 / -1'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 Learning Activity Snapshot
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4f46e5' }} data-testid="profile-reviews-count">
                {profileData?.stats?.reviewsCount ?? 0}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
                Total Reviews Completed
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#059669' }} data-testid="profile-decks-count">
                {profileData?.stats?.decksCreatedCount ?? 0}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
                Authored Decks
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Link to="/decks" className="btn-study-tool" style={{ textDecoration: 'none', display: 'inline-block', fontSize: '0.875rem', padding: '8px 16px' }}>
                Browse Decks →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
