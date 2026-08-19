import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { resolvePostLoginRedirect } from '../utils/intent'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

export default function SocialButtons({ mode = 'login' }) {
  const auth = useAuth()
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [showPrompt, setShowPrompt] = useState(null)
  const [manualToken, setManualToken] = useState('')

  const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              setLoadingProvider('google')
              try {
                await auth.oauthLogin('google', { idToken: response.credential })
                window.location.href = resolvePostLoginRedirect('/decks')
              } catch (err) {
                alert(`Google sign-in failed: ${err.message || err}`)
              } finally {
                setLoadingProvider(null)
              }
            }
          }
        })
      } catch (err) {
        console.warn('Google GIS init error:', err)
      }
    }
  }, [googleClientId, auth])

  const handleGitHubLogin = () => {
    if (!githubClientId) {
      setShowPrompt('github')
      return
    }
    setLoadingProvider('github')
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`)
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=user:email`
  }

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      setShowPrompt('google')
      return
    }
    setLoadingProvider('google')
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`)
          window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid%20email%20profile&nonce=${Date.now()}`
        }
      })
    } else {
      setShowPrompt('google')
    }
  }

  const submitManualToken = async (e) => {
    e.preventDefault()
    if (!manualToken.trim() || !showPrompt) return
    setLoadingProvider(showPrompt)
    try {
      if (showPrompt === 'google') {
        await auth.oauthLogin('google', { idToken: manualToken.trim() })
      } else {
        await auth.oauthLogin('github', { code: manualToken.trim(), redirectUri: `${window.location.origin}/oauth/callback` })
      }
      window.location.href = resolvePostLoginRedirect('/decks')
    } catch (err) {
      alert(`OAuth Login Failed: ${err.message || err}`)
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div style={{ marginTop: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
        <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}></div>
        <span style={{ padding: '0 12px', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
          Or continue with
        </span>
        <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}></div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={!!loadingProvider}
          className="btn-secondary"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <GoogleIcon />
          <span>{loadingProvider === 'google' ? 'Redirecting...' : 'Google'}</span>
        </button>

        <button
          type="button"
          onClick={handleGitHubLogin}
          disabled={!!loadingProvider}
          className="btn-secondary"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            backgroundColor: '#24292e',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <GitHubIcon />
          <span>{loadingProvider === 'github' ? 'Redirecting...' : 'GitHub'}</span>
        </button>
      </div>

      {showPrompt && (
        <div style={{ marginTop: 16, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            {showPrompt === 'google' ? 'Google 1-Click Sign-In Setup' : 'GitHub 1-Click Sign-In Setup'}
          </div>
          <p style={{ color: '#64748b', margin: '0 0 10px 0', lineHeight: 1.5 }}>
            To enable instant 1-click authorization without manual tokens, set <code>VITE_{showPrompt.toUpperCase()}_CLIENT_ID</code> in <code>src/frontend/.env.local</code>.
          </p>
          <form onSubmit={submitManualToken} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="form-control"
              placeholder={showPrompt === 'google' ? 'Paste Google ID Token (Dev Test)' : 'Paste GitHub Code (Dev Test)'}
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              style={{ flex: 1, fontSize: '0.8rem' }}
              required
            />
            <button type="submit" className="btn-primary" disabled={!!loadingProvider} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              {loadingProvider ? 'Verifying...' : 'Submit'}
            </button>
            <button type="button" onClick={() => setShowPrompt(null)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 10px' }}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
