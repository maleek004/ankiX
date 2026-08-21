import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { resolvePostLoginRedirect } from '../utils/intent'

export default function OAuthCallback() {
  const auth = useAuth()
  const [status, setStatus] = useState('Authenticating with OAuth provider...')

  useEffect(() => {
    async function handleCallback() {
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

      const code = searchParams.get('code') || hashParams.get('code')
      const idToken = searchParams.get('id_token') || hashParams.get('id_token')
      const error = searchParams.get('error') || hashParams.get('error')
      const errorDesc = searchParams.get('error_description') || hashParams.get('error_description')

      if (error) {
        setStatus(`OAuth Error: ${errorDesc || error}`)
        return
      }

      if (!code && !idToken) {
        setStatus('Invalid callback: Authorization code or identity token missing.')
        return
      }

      try {
        const redirectUri = `${window.location.origin}/oauth/callback`
        if (idToken) {
          await auth.oauthLogin('google', { idToken })
        } else {
          await auth.oauthLogin('github', { code, redirectUri })
        }
        window.location.href = resolvePostLoginRedirect()
      } catch (err) {
        setStatus(`Social sign-in failed: ${err.message || err}`)
      }
    }

    handleCallback()
  }, [auth])

  return (
    <div style={{ maxWidth: 450, margin: '80px auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: '30px' }}>
        <h3>Social Sign-In</h3>
        <p style={{ color: '#666', marginTop: 12 }}>{status}</p>
        {status.includes('failed') || status.includes('Error') || status.includes('Invalid') ? (
          <a href="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: 16 }}>
            Return to Login
          </a>
        ) : (
          <div className="spinner" style={{ marginTop: 20 }}></div>
        )}
      </div>
    </div>
  )
}
