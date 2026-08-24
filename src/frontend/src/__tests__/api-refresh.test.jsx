import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from '../api'

describe('Story 5.6: Persistent Active Session & Silent Refresh Engine', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores refresh token on login and clears it on logout', async () => {
    const mockAuthResponse = {
      accessToken: 'access_jwt_123',
      refreshToken: 'refresh_token_abc',
      expiresInSeconds: 3600,
      user: { id: 1, email: 'learner@example.com', displayName: 'Learner' }
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockAuthResponse),
      json: async () => mockAuthResponse
    })

    const res = await api.login('learner@example.com', 'Pass123!')
    expect(res.accessToken).toBe('access_jwt_123')
    expect(localStorage.getItem('ankix_token')).toBe('access_jwt_123')
    expect(localStorage.getItem('ankix_refresh_token')).toBe('refresh_token_abc')
    expect(JSON.parse(localStorage.getItem('ankix_user')).email).toBe('learner@example.com')

    // Mock revoke on logout
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Revoked' })
    })

    api.logout()
    expect(localStorage.getItem('ankix_token')).toBeNull()
    expect(localStorage.getItem('ankix_refresh_token')).toBeNull()
    expect(localStorage.getItem('ankix_user')).toBeNull()
  })

  it('safeFetch intercepts 401, refreshes tokens silently, and replays request with new token', async () => {
    localStorage.setItem('ankix_token', 'old_expired_jwt')
    localStorage.setItem('ankix_refresh_token', 'active_refresh_token')

    const refreshedAuth = {
      accessToken: 'new_fresh_jwt_456',
      refreshToken: 'new_rotated_refresh_token',
      expiresInSeconds: 3600,
      user: { id: 1, email: 'learner@example.com', displayName: 'Learner' }
    }

    const deckData = [{ id: 1, title: 'C# Mastery' }]

    // 1st fetch: 401 Unauthorized (initial request with expired token)
    // 2nd fetch: 200 OK (POST /auth/refresh-token)
    // 3rd fetch: 200 OK (replayed request with new token)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(refreshedAuth),
        json: async () => refreshedAuth
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(deckData),
        json: async () => deckData
      })

    global.fetch = fetchMock

    const res = await api.safeFetch('/api/decks', {
      headers: { Authorization: 'Bearer old_expired_jwt' }
    })

    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toEqual(deckData)

    // Token rotated and updated in localStorage
    expect(localStorage.getItem('ankix_token')).toBe('new_fresh_jwt_456')
    expect(localStorage.getItem('ankix_refresh_token')).toBe('new_rotated_refresh_token')

    // Verify 3 calls occurred with correct payloads
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const refreshCall = fetchMock.mock.calls[1]
    expect(refreshCall[0]).toContain('/auth/refresh-token')
    expect(JSON.parse(refreshCall[1].body)).toEqual({ refreshToken: 'active_refresh_token' })

    const replayedCall = fetchMock.mock.calls[2]
    expect(replayedCall[1].headers['Authorization']).toBe('Bearer new_fresh_jwt_456')
    expect(replayedCall[1]._retry).toBe(true)
  })

  it('deduplicates concurrent 401 requests onto a single refresh call', async () => {
    localStorage.setItem('ankix_token', 'old_expired_jwt')
    localStorage.setItem('ankix_refresh_token', 'active_refresh_token')

    const refreshedAuth = {
      accessToken: 'new_fresh_jwt_789',
      refreshToken: 'new_rotated_refresh_token_2',
      expiresInSeconds: 3600,
      user: { id: 1, email: 'learner@example.com' }
    }

    let refreshCallCount = 0

    global.fetch = vi.fn(async (url, options = {}) => {
      const urlStr = url.toString()
      if (urlStr.includes('/auth/refresh-token')) {
        refreshCallCount++
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(refreshedAuth),
          json: async () => refreshedAuth
        }
      }
      if (options._retry) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true, url: urlStr }),
          json: async () => ({ success: true, url: urlStr })
        }
      }
      // First try returns 401
      return {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }
    })

    // Fire 3 simultaneous requests
    const [res1, res2, res3] = await Promise.all([
      api.safeFetch('/api/decks', { headers: { Authorization: 'Bearer old_token' } }),
      api.safeFetch('/api/exercises', { headers: { Authorization: 'Bearer old_token' } }),
      api.safeFetch('/api/auth/profile', { headers: { Authorization: 'Bearer old_token' } })
    ])

    expect(res1.ok).toBe(true)
    expect(res2.ok).toBe(true)
    expect(res3.ok).toBe(true)

    // Exactly ONE refresh token request was executed
    expect(refreshCallCount).toBe(1)
    expect(localStorage.getItem('ankix_token')).toBe('new_fresh_jwt_789')
  })

  it('triggers onAuthFailure and clears tokens when refresh fails', async () => {
    localStorage.setItem('ankix_token', 'expired_jwt')
    localStorage.setItem('ankix_refresh_token', 'revoked_token')

    const authFailureHandler = vi.fn()
    const unsubscribe = api.onAuthFailure(authFailureHandler)

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Refresh token has been revoked.' }),
        json: async () => ({ message: 'Refresh token has been revoked.' })
      })

    const res = await api.safeFetch('/api/auth/profile', {
      headers: { Authorization: 'Bearer expired_jwt' }
    })

    expect(res.status).toBe(401)
    expect(authFailureHandler).toHaveBeenCalled()
    expect(localStorage.getItem('ankix_token')).toBeNull()
    expect(localStorage.getItem('ankix_refresh_token')).toBeNull()

    unsubscribe()
  })
})
