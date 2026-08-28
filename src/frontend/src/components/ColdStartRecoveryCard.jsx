import React, { useState } from 'react'

export default function ColdStartRecoveryCard({ onRetry, details = '', isRetrying = false }) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div
      style={{
        marginTop: 14,
        padding: '16px 20px',
        borderRadius: 10,
        background: '#fffdf5',
        border: '1px solid #ffe066',
        boxShadow: '0 2px 10px rgba(245, 159, 0, 0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>💤</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#995b00', fontWeight: 700 }}>
            Code Runner took a bit longer to wake up
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#6d4b00', lineHeight: 1.45 }}>
            Our free-tier cloud execution containers go to sleep when idle to conserve energy.
            The wake-up signal has already been delivered, and the server is likely ready right now.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={onRetry}
              disabled={isRetrying}
              style={{
                padding: '8px 18px',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: '#d97706',
                borderColor: '#b45309',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {isRetrying ? 'Connecting to Server...' : '🔄 Run Solution Again'}
            </button>

            {details && (
              <button
                type="button"
                onClick={() => setShowDetails(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#854d0e',
                  fontSize: '0.8rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showDetails ? 'Hide Diagnostic Info ▲' : 'View Diagnostic Info ▾'}
              </button>
            )}
          </div>

          {showDetails && details && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 6,
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#78350f',
                fontSize: '0.78rem',
                fontFamily: 'Consolas, Monaco, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 140,
                overflowY: 'auto'
              }}
            >
              {typeof details === 'string'
                ? details
                : (details?.message || (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
