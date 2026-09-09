import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useStudyGroup } from '../studyGroup/StudyGroupProvider'
import AuthModal from '../components/AuthModal'
import * as api from '../api'

export default function JoinGroup() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const { setActiveStudyGroup } = useStudyGroup() || {}

  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [joinSuccessMessage, setJoinSuccessMessage] = useState('')

  const isAuthenticated = Boolean(auth?.user)

  useEffect(() => {
    let isMounted = true
    async function fetchInvite() {
      if (!inviteCode) {
        setError('No invite code provided.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const data = await api.getStudyGroupInvitePreview(inviteCode)
        if (isMounted) {
          setInvite(data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'This invite link is invalid, expired, or has been revoked.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchInvite()
    return () => {
      isMounted = false
    }
  }, [inviteCode, isAuthenticated])

  const handleJoin = async () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true)
      return
    }

    setJoining(true)
    setError(null)
    try {
      const res = await api.acceptStudyGroupInvite(inviteCode)
      const groupName = invite.name || invite.studyGroupName || res?.studyGroupName || res?.name
      const groupSlug = invite.slug || invite.studyGroupSlug || res?.studyGroupSlug || res?.slug
      const groupRole = invite.role || invite.inviteRole || res?.role || 'Member'
      if (setActiveStudyGroup && invite) {
        setActiveStudyGroup({
          id: invite.studyGroupId || res?.studyGroupId,
          slug: groupSlug,
          name: groupName,
          role: groupRole
        })
      }
      setJoinSuccessMessage(res?.message || `Successfully joined ${groupName}!`)
      setTimeout(() => {
        navigate('/decks')
      }, 1200)
    } catch (err) {
      setError(err.message || 'Failed to accept invitation.')
    } finally {
      setJoining(false)
    }
  }

  const handleGoToGroup = () => {
    if (setActiveStudyGroup && invite) {
      setActiveStudyGroup({
        id: invite.studyGroupId,
        slug: invite.slug,
        name: invite.name,
        role: invite.userRole || invite.role || 'Member'
      })
    }
    navigate('/decks')
  }

  return (
    <div className="join-group-container" style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto' }} />
          <p style={{ color: 'var(--text-muted, #64748b)' }}>Resolving invite link...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 36, textAlign: 'center', borderTop: '4px solid var(--danger, #ef4444)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main, #0f172a)' }}>
            Invite Link Unavailable
          </h2>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.95rem', marginBottom: 24, lineHeight: 1.5 }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/study-groups" className="btn btn-primary" style={{ padding: '8px 20px' }}>
              Browse Study Groups
            </Link>
            <Link to="/decks" className="btn btn-secondary" style={{ padding: '8px 20px' }}>
              Public Decks
            </Link>
          </div>
        </div>
      ) : invite ? (() => {
        const groupName = invite.name || invite.studyGroupName || 'Study Group'
        const groupSlug = invite.slug || invite.studyGroupSlug || ''
        const groupRole = invite.role || invite.inviteRole || 'Member'
        const isMember = Boolean(invite.isAlreadyMember || invite.isMember)

        return (
          <div className="card" style={{ padding: 36, textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)' }}>
            {invite.avatarUrl ? (
              <img
                src={invite.avatarUrl}
                alt={groupName}
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px auto', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-light, #e0e7ff)',
                  color: 'var(--primary, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  margin: '0 auto 16px auto',
                  fontWeight: 700
                }}
              >
                {groupName?.charAt(0)?.toUpperCase() || '👥'}
              </div>
            )}

            <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, backgroundColor: '#f1f5f9', fontSize: '0.8rem', color: '#475569', marginBottom: 12, fontWeight: 600 }}>
              Study Group Invitation
            </div>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: 8 }}>
              Join {groupName}
            </h1>

            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.95rem', marginBottom: 20, lineHeight: 1.5 }}>
              {invite.description || 'Welcome to our study group cohort on AnkiX! Join now to collaborate, share decks, and study together.'}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 20,
                padding: '14px 0',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                marginBottom: 24,
                fontSize: '0.9rem',
                color: '#475569'
              }}
            >
              <div>
                <strong>{invite.memberCount ?? 0}</strong> {invite.memberCount === 1 ? 'member' : 'members'}
              </div>
              <div>•</div>
              <div>
                Role: <strong style={{ color: 'var(--primary, #4f46e5)' }}>{groupRole}</strong>
              </div>
            </div>

            {joinSuccessMessage ? (
              <div className="alert alert-success" style={{ marginBottom: 20, padding: 12, borderRadius: 8, backgroundColor: '#ecfdf5', color: '#065f46', fontWeight: 600 }}>
                ✅ {joinSuccessMessage} Redirecting to workspace...
              </div>
            ) : isMember ? (
              <div>
                <div style={{ padding: '10px 16px', borderRadius: 8, backgroundColor: '#f0fdf4', color: '#166534', marginBottom: 20, fontSize: '0.9rem', fontWeight: 600 }}>
                  ✨ You are already a member of this study group.
                </div>
                <button
                  onClick={handleGoToGroup}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px 20px', fontSize: '1rem', fontWeight: 600 }}
                >
                  Enter Group Decks
                </button>
              </div>
            ) : isAuthenticated ? (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 16 }}>
                  You've been invited to join <strong>{groupName}</strong> as a <strong>{groupRole}</strong>.
                </p>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px 20px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {joining ? <span className="spinner spinner-sm" /> : '👥'} {joining ? 'Joining...' : 'Accept & Join Group'}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 16 }}>
                  Sign in or create an account to join <strong>{groupName}</strong>.
                </p>
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px 20px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  🔑 Sign in to Join
                </button>
              </div>
            )}
          </div>
        )
      })() : null}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={`Sign in to join ${invite?.name || 'Study Group'}`}
        subtitle={`Create an account or log in to join as a ${invite?.role || 'Member'} and start studying.`}
        intent={{ returnUrl: `/join/${inviteCode}` }}
      />
    </div>
  )
}
