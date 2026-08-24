import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SocialButtons from './SocialButtons'
import { savePendingIntent } from '../utils/intent'

export default function AuthModal({
  isOpen,
  onClose,
  title = 'Create a Free Account to Continue',
  subtitle = 'Save your spaced repetition progress, earn streaks, and participate in community discussions.',
  intent = null
}) {
  useEffect(() => {
    if (isOpen && intent) {
      savePendingIntent(intent)
    }
  }, [isOpen, intent])

  if (!isOpen) return null

  const handleAction = () => {
    if (intent) {
      savePendingIntent(intent)
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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="card mobile-bottom-sheet-content"
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: '28px 24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
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

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#0f172a' }}>
            {title}
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 20,
            background: '#f8fafc',
            padding: 12,
            borderRadius: 8,
            fontSize: '0.8rem',
            color: '#334155'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧠</span> <span>SM-2 Memory Engine</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span> <span>Interactive Exercises</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💬</span> <span>Card Q&A Follow-ups</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📦</span> <span>Join Study Groups</span>
          </div>
        </div>

        <SocialButtons mode="login" />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Link
            to="/register"
            onClick={handleAction}
            className="btn-primary"
            style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '10px 0' }}
          >
            Sign Up Free
          </Link>
          <Link
            to="/login"
            onClick={handleAction}
            className="btn-secondary"
            style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '10px 0' }}
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  )
}
