import React, { useState, useEffect } from 'react'

export const WAKEUP_STAGES = [
  { maxSec: 3, icon: '⚙️', message: 'Running solution against test cases...', hint: 'Dispatching to cloud runner' },
  { maxSec: 9, icon: '☕', message: 'Server was taking a quick nap... waking it up', hint: 'Spinning up container dyno' },
  { maxSec: 18, icon: '⚡', message: 'Slapping the server awake... giving it some espresso', hint: 'Initial connection in progress' },
  { maxSec: 30, icon: '👻', message: 'Jump-scaring the code runner into consciousness', hint: 'Allocating sandbox memory' },
  { maxSec: 45, icon: '🚀', message: 'Containers warming up! Compiling & running test harness...', hint: 'Almost ready to execute' },
  { maxSec: Infinity, icon: '🏃', message: 'Almost there! Server is stretching its legs...', hint: 'Finalizing execution sandbox' }
]

export function getWakeupStage(seconds) {
  return WAKEUP_STAGES.find(s => seconds < s.maxSec) || WAKEUP_STAGES[WAKEUP_STAGES.length - 1]
}

export default function WakeupProgressTicker({ running = true, progressInfo = null, onCancel = null }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!running) {
      setSeconds(0)
      return
    }

    setSeconds(0)
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setSeconds(elapsed)
    }, 250)

    return () => clearInterval(interval)
  }, [running])

  if (!running) return null

  const currentStage = getWakeupStage(seconds)
  const isWakingUp = seconds >= 3
  const attempt = progressInfo?.attempt || 1
  const maxAttempts = progressInfo?.maxAttempts || 5

  // Progress percentage (estimated based on standard 45s cold start)
  const progressPercent = Math.min(95, Math.max(5, Math.round((seconds / 40) * 100)))

  return (
    <div
      style={{
        marginTop: 12,
        padding: '16px 18px',
        borderRadius: 10,
        background: isWakingUp
          ? 'linear-gradient(135deg, #fff9db 0%, #fff3bf 100%)'
          : '#f8f9fa',
        border: isWakingUp ? '1px solid #ffe066' : '1px solid #e9ecef',
        boxShadow: isWakingUp ? '0 4px 14px rgba(245, 159, 0, 0.12)' : 'none',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: '1.4rem',
              lineHeight: 1,
              animation: isWakingUp ? 'bouncePulse 1.5s infinite ease-in-out' : 'spinSlow 2s infinite linear'
            }}
          >
            {currentStage.icon}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isWakingUp ? '#873800' : '#212529' }}>
              {currentStage.message}
            </div>
            <div style={{ fontSize: '0.78rem', color: isWakingUp ? '#b05700' : '#6c757d', marginTop: 2 }}>
              {currentStage.hint} • {seconds}s elapsed {attempt > 1 ? `(Attempt ${attempt}/${maxAttempts})` : ''}
            </div>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid #ced4da',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.75rem',
              color: '#6c757d',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Dynamic Animated Progress Bar */}
      <div
        style={{
          width: '100%',
          height: 6,
          borderRadius: 4,
          background: isWakingUp ? '#faecc8' : '#e9ecef',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            borderRadius: 4,
            background: isWakingUp
              ? 'linear-gradient(90deg, #f59f00, #fab005, #fd7e14)'
              : '#0d6efd',
            transition: 'width 0.3s ease-out'
          }}
        />
      </div>

      <style>{`
        @keyframes bouncePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
        @keyframes spinSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
