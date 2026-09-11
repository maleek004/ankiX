import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

const TOAST_ICONS = {
  success: (
    <svg style={{ width: 18, height: 18, flexShrink: 0, color: '#16a34a' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg style={{ width: 18, height: 18, flexShrink: 0, color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg style={{ width: 18, height: 18, flexShrink: 0, color: '#d97706' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg style={{ width: 18, height: 18, flexShrink: 0, color: '#2563eb' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  )
}

const TOAST_THEMES = {
  success: {
    bg: '#f0fdf4',
    border: '#bbf7d0',
    color: '#166534'
  },
  error: {
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#991b1b'
  },
  warning: {
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#92400e'
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    color: '#1e40af'
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const removeToast = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id))
      timersRef.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return null
    const id = Date.now() + Math.random().toString(36).substring(2, 9)
    const newToast = {
      id,
      message: typeof message === 'string' ? message : String(message),
      type: TOAST_THEMES[type] ? type : 'info',
      duration
    }

    setToasts(prev => {
      const next = [...prev, newToast]
      if (next.length > 4) {
        const discarded = next[0]
        if (timersRef.current.has(discarded.id)) {
          clearTimeout(timersRef.current.get(discarded.id))
          timersRef.current.delete(discarded.id)
        }
        return next.slice(1)
      }
      return next
    })

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id)
      }, duration)
      timersRef.current.set(id, timer)
    }

    return id
  }, [removeToast])

  const success = useCallback((msg, duration = 3500) => addToast(msg, 'success', duration), [addToast])
  const error = useCallback((msg, duration = 5000) => addToast(msg, 'error', duration), [addToast])
  const warning = useCallback((msg, duration = 4000) => addToast(msg, 'warning', duration), [addToast])
  const info = useCallback((msg, duration = 3500) => addToast(msg, 'info', duration), [addToast])

  const contextValue = {
    showToast: addToast,
    success,
    error,
    warning,
    info,
    removeToast
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <aside
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 'calc(100vw - 32px)',
          width: 380,
          pointerEvents: 'none'
        }}
      >
        {toasts.map(toast => {
          const theme = TOAST_THEMES[toast.type] || TOAST_THEMES.info
          const isErrorOrWarning = toast.type === 'error' || toast.type === 'warning'
          return (
            <div
              key={toast.id}
              role={isErrorOrWarning ? 'alert' : 'status'}
              aria-live={isErrorOrWarning ? 'assertive' : 'polite'}
              style={{
                pointerEvents: 'auto',
                backgroundColor: theme.bg,
                border: `1px solid ${theme.border}`,
                color: theme.color,
                borderRadius: 8,
                padding: '12px 14px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '0.9rem',
                lineHeight: 1.45,
                animation: 'ankixToastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                wordBreak: 'break-word'
              }}
            >
              <div style={{ marginTop: 1, flexShrink: 0 }}>
                {TOAST_ICONS[toast.type]}
              </div>
              <div style={{ flex: 1 }}>
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Close notification"
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.color,
                  opacity: 0.65,
                  cursor: 'pointer',
                  padding: '0 0 0 6px',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -1
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.65' }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </aside>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback if rendered outside of provider so component won't break
    return {
      showToast: (msg) => console.log('[Toast]', msg),
      success: (msg) => console.log('[Toast:success]', msg),
      error: (msg) => console.error('[Toast:error]', msg),
      warning: (msg) => console.warn('[Toast:warning]', msg),
      info: (msg) => console.info('[Toast:info]', msg),
      removeToast: () => {}
    }
  }
  return ctx
}
