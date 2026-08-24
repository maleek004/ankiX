import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import AuthModal from './AuthModal'

export default function GuestBanner() {
  const auth = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (auth?.user || dismissed) return null

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)',
          color: '#ffffff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          zIndex: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.1rem' }}>👀</span>
          <span style={{ fontWeight: 600 }}>Guest Preview Mode:</span>
          <span>
            You are browsing publicly. Flashcard reviews and code runs are ephemeral.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: '#ffffff',
              color: '#4f46e5',
              border: 'none',
              borderRadius: 6,
              padding: '5px 12px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Unlock Full Spaced Repetition
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 4px'
            }}
            title="Dismiss banner"
          >
            ✕
          </button>
        </div>
      </div>

      <AuthModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Activate Full Spaced Repetition"
        subtitle="Sign in or register in seconds to record review logs, schedule cards with SM-2, and participate in discussions."
      />
    </>
  )
}
