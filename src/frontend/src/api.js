const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api'

let refreshPromise = null
const authFailureListeners = new Set()

export function onAuthFailure(listener) {
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

export function triggerAuthFailure(context = {}) {
  authFailureListeners.forEach(fn => {
    try { fn(context) } catch {}
  })
}

export function getRefreshToken() {
  try {
    return localStorage.getItem('ankix_refresh_token') || null
  } catch {
    return null
  }
}

export async function refreshToken() {
  const rt = getRefreshToken()
  if (!rt) {
    throw new Error('No refresh token available')
  }

  const res = await fetch(`${API_BASE}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt })
  })

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Session refresh failed')
    const err = new Error(errorMsg)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  if (data?.accessToken) {
    localStorage.setItem('ankix_token', data.accessToken)
    if (data.refreshToken) {
      localStorage.setItem('ankix_refresh_token', data.refreshToken)
    }
    if (data.user) {
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
    }
  }
  return data
}

export async function safeFetch(url, options = {}) {
  try {
    let res = await fetch(url, options)

    const urlString = typeof url === 'string' ? url : (url?.url || url?.toString() || '')
    const isAuthEndpoint = urlString.includes('/auth/login') ||
                           urlString.includes('/auth/register') ||
                           urlString.includes('/auth/refresh-token') ||
                           urlString.includes('/auth/revoke-token') ||
                           urlString.includes('/auth/forgot-password') ||
                           urlString.includes('/auth/reset-password')

    if (res.status === 401 && !isAuthEndpoint && !options._retry) {
      const rt = getRefreshToken()
      if (rt) {
        try {
          if (!refreshPromise) {
            refreshPromise = refreshToken().finally(() => {
              refreshPromise = null
            })
          }

          const refreshData = await refreshPromise

          let updatedHeaders = {}
          if (options.headers) {
            const entries = options.headers instanceof Headers
              ? [...options.headers.entries()]
              : Array.isArray(options.headers)
                ? options.headers
                : Object.entries(options.headers)
            for (const [k, v] of entries) {
              if (k.toLowerCase() !== 'authorization') {
                updatedHeaders[k] = v
              }
            }
          }
          updatedHeaders['Authorization'] = `Bearer ${refreshData.accessToken}`

          const retryOptions = {
            ...options,
            headers: updatedHeaders,
            _retry: true
          }

          res = await fetch(url, retryOptions)
          if (res.status === 401) {
            triggerAuthFailure({ url: urlString, status: 401 })
          }
        } catch (refreshErr) {
          try {
            localStorage.removeItem('ankix_token')
            localStorage.removeItem('ankix_refresh_token')
          } catch {}
          triggerAuthFailure({ url: urlString, status: 401, error: refreshErr })
          return res
        }
      } else {
        triggerAuthFailure({ url: urlString, status: 401 })
      }
    }

    return res
  } catch (err) {
    if (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      const targetUrl = typeof url === 'string' ? url : (url?.url || url?.toString() || '')
      throw new Error(`Cannot reach backend API at '${targetUrl}'. Please check VITE_API_BASE in Vercel settings (must be HTTPS, e.g. https://your-backend.herokuapp.com/api) and ensure your backend server is awake.`)
    }
    throw err
  }
}

export async function parseApiError(res, fallbackMessage = 'An unexpected error occurred.') {
  try {
    const text = await res.text()
    if (!text || !text.trim()) return fallbackMessage

    // Try parsing as JSON
    try {
      const data = JSON.parse(text)
      if (typeof data === 'string' && data.trim()) return data.trim()
      if (data && typeof data === 'object') {
        if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
        if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim()
        if (data.errors && typeof data.errors === 'object') {
          const keys = Object.keys(data.errors)
          for (const key of keys) {
            const val = data.errors[key]
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string' && val[0].trim()) {
              return val[0].trim()
            }
            if (typeof val === 'string' && val.trim()) {
              return val.trim()
            }
          }
        }
        if (typeof data.title === 'string' && data.title.trim()) return data.title.trim()
        if (typeof data.error === 'string' && data.error.trim()) return data.error.trim()
      }
    } catch {
      // Non-JSON response: check if readable short text (not HTML document)
      const trimmed = text.trim()
      if (trimmed.length > 0 && trimmed.length < 300 && !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
        return trimmed
      }
    }
    return fallbackMessage
  } catch {
    return fallbackMessage
  }
}

export async function register(email, password, displayName){
  const res = await safeFetch(`${API_BASE}/auth/register`,{
    method:'POST',
    headers:{ 'Content-Type':'application/json'},
    body: JSON.stringify({ email, password, displayName: displayName || null })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Registration failed. Please try again.')
    throw new Error(msg)
  }
  return res.json()
}

export async function forgotPassword(email){
  const res = await safeFetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to process forgot password request')
    throw new Error(msg)
  }
  return res.json()
}

export async function verifyResetToken(token){
  const res = await safeFetch(`${API_BASE}/auth/verify-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Reset token is invalid or expired')
    throw new Error(msg)
  }
  return res.json()
}

export async function resetPassword(token, newPassword){
  const res = await safeFetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to reset password')
    throw new Error(msg)
  }
  return res.json()
}

export async function sendVerificationEmail(email){
  const res = await safeFetch(`${API_BASE}/auth/send-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to send verification email')
    throw new Error(msg)
  }
  return res.json()
}

export async function verifyEmail(token){
  const res = await safeFetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to verify email')
    throw new Error(msg)
  }
  return res.json()
}

export async function getProfile(){
  const res = await safeFetch(`${API_BASE}/auth/profile`, { headers: authHeaders() })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to fetch user profile')
    throw new Error(msg)
  }
  return res.json()
}

export async function updateProfile(displayName){
  const res = await safeFetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ displayName })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update profile')
    throw new Error(msg)
  }
  return res.json()
}

export async function getAdminUsers(){
  const res = await safeFetch(`${API_BASE}/admin/users`, { headers: authHeaders() })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to fetch admin users')
    throw new Error(msg)
  }
  return res.json()
}

export async function updateUserRole(userId, role){
  const res = await safeFetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ role })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update user role')
    throw new Error(msg)
  }
  return res.json()
}

export async function getAdminMetrics(){
  const res = await safeFetch(`${API_BASE}/admin/metrics`, { headers: authHeaders() })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to fetch admin metrics')
    throw new Error(msg)
  }
  return res.json()
}

export async function sendPresenceHeartbeat(){
  const res = await safeFetch(`${API_BASE}/presence/heartbeat`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update presence heartbeat')
    throw new Error(msg)
  }
  return res.json()
}

export async function login(email, password){
  const res = await safeFetch(`${API_BASE}/auth/login`,{
    method:'POST',
    headers:{ 'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Invalid email or password. Please check your credentials.')
    throw new Error(msg)
  }
  const data = await res.json()
  if(data?.accessToken){
    localStorage.setItem('ankix_token', data.accessToken)
    if(data?.refreshToken){
      localStorage.setItem('ankix_refresh_token', data.refreshToken)
    }
    if(data?.user){
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
    }
  }
  return data
}

export async function oauthLogin(provider, { idToken, code, redirectUri } = {}){
  const res = await safeFetch(`${API_BASE}/auth/oauth`,{
    method:'POST',
    headers:{ 'Content-Type':'application/json'},
    body: JSON.stringify({ provider, idToken, code, redirectUri })
  })

  if(!res.ok){
    const msg = await parseApiError(res, 'OAuth authentication failed')
    throw new Error(msg)
  }
  const data = await res.json()
  if(data?.accessToken){
    localStorage.setItem('ankix_token', data.accessToken)
    if(data?.refreshToken){
      localStorage.setItem('ankix_refresh_token', data.refreshToken)
    }
    if(data?.user){
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
    }
  }
  return data
}

export function getEffectiveDisplayName(displayName, email) {
  if (displayName && typeof displayName === 'string' && displayName.trim()) {
    const trimmed = displayName.trim()
    if (trimmed.includes('@') && !trimmed.includes(' ')) {
      return trimmed.split('@')[0]
    }
    return trimmed
  }
  if (email && typeof email === 'string' && email.trim()) {
    const trimmedEmail = email.trim()
    return trimmedEmail.includes('@') ? trimmedEmail.split('@')[0] : trimmedEmail
  }
  return 'User'
}

export function getToken(){
  return localStorage.getItem('ankix_token') || null
}

export function getUser(){
  const storedUser = localStorage.getItem('ankix_user')
  if(storedUser){
    try {
      const u = JSON.parse(storedUser)
      const displayName = getEffectiveDisplayName(u.displayName || u.DisplayName, u.email || u.Email)
      const isEmailVerified = u.isEmailVerified ?? u.IsEmailVerified ?? (u.authProvider !== 'local' && u.AuthProvider !== 'local' && (u.authProvider || u.AuthProvider)) ?? false
      return { ...u, displayName, isEmailVerified }
    } catch {}
  }
  const token = getToken()
  if(token){
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload['role'] || payload['Role']
      const email = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || payload['email']
      const id = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload['sub'] || payload['id']
      const rawDisplayName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || payload['displayName'] || payload['given_name'] || payload['name']
      const isEmailVerified = payload['isEmailVerified'] === 'true' || payload['email_verified'] === 'true'
      const displayName = getEffectiveDisplayName(rawDisplayName, email)
      return { id, email, role, displayName, isEmailVerified }
    } catch {}
  }
  return null
}

export function canCreateContent(studyGroupRole = null){
  const user = getUser()
  if(!user) return false
  const role = user.role || user.Role
  if(role) {
    const lowerRole = role.toLowerCase()
    if(lowerRole === 'admin' || lowerRole === 'contributor') return true
  }
  if(studyGroupRole) {
    const lowerGroupRole = studyGroupRole.toLowerCase()
    if(lowerGroupRole === 'owner' || lowerGroupRole === 'admin' || lowerGroupRole === 'contributor') return true
  }
  return false
}

export async function revokeToken(refreshTokenValue){
  const rt = refreshTokenValue || getRefreshToken()
  if(!rt) return
  try {
    const res = await fetch(`${API_BASE}/auth/revoke-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt })
    })
    if (!res.ok) {
      const msg = await parseApiError(res, 'Failed to revoke token')
      throw new Error(msg)
    }
    return await res.json()
  } catch (err) {
    // Non-blocking
  }
}

export function logout(){
  const rt = getRefreshToken()
  if (rt) {
    try {
      fetch(`${API_BASE}/auth/revoke-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
        keepalive: true
      }).catch(() => {})
    } catch {}
  }
  try {
    localStorage.removeItem('ankix_token')
    localStorage.removeItem('ankix_refresh_token')
    localStorage.removeItem('ankix_user')
    localStorage.removeItem('ankix_study_group')
    localStorage.removeItem('ankix_community')
  } catch {}
  try {
    sessionStorage.removeItem('ankix_pending_intent')
  } catch {}
}

/**
 * Returns headers with Authorization attached.
 * If token is missing but refresh token exists, returns headers without token
 * to allow safeFetch to intercept 401 and trigger silent refresh.
 * Throws only if completely unauthenticated.
 */
function authHeaders(){
  const token = getToken()
  const rt = getRefreshToken()
  if(!token && !rt) throw new Error('Not authenticated — please log in.')
  const headers = { 'Content-Type': 'application/json' }
  if(token){
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export function optionalAuthHeaders(){
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if(token){
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function getDecks(studyGroupId = null){
  const query = studyGroupId ? `?studyGroupId=${studyGroupId}` : ''
  const res = await safeFetch(`${API_BASE}/decks${query}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch decks')
  return res.json()
}

export async function createDeck(title, description = '', studyGroupId = null){
  const body = { title, description }
  if (studyGroupId) body.studyGroupId = studyGroupId
  const res = await safeFetch(`${API_BASE}/content/decks`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to create deck')
    throw new Error(msg)
  }
  return res.json()
}

export async function getDeck(id){
  const res = await safeFetch(`${API_BASE}/decks/${id}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch deck')
  return res.json()
}

export async function getCards(deckId){
  const res = await safeFetch(`${API_BASE}/decks/${deckId}/cards`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch cards')
  return res.json()
}

export async function getCard(cardId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch card')
  return res.json()
}

export async function getAllCards(studyGroupId = null){
  const query = studyGroupId ? `?studyGroupId=${studyGroupId}` : ''
  const res = await safeFetch(`${API_BASE}/cards${query}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch all cards')
  return res.json()
}

export async function createCard(deckId, prompt, answer, type = 'basic'){
  let p = prompt
  let a = answer
  let t = type
  if (typeof prompt === 'object' && prompt !== null) {
    p = prompt.prompt
    a = prompt.answer || prompt.validationSpec
    t = prompt.type
  }
  const cardType = t || 'basic'
  const res = await safeFetch(`${API_BASE}/content/cards`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      deckId: Number(deckId),
      type: cardType,
      prompt: p,
      answer: a
    })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to create card')
    throw new Error(msg)
  }
  return res.json()
}

export async function updateCard(cardId, prompt, answer, type = 'basic'){
  let p = prompt
  let a = answer
  let t = type
  if (typeof prompt === 'object' && prompt !== null) {
    p = prompt.prompt
    a = prompt.answer || prompt.validationSpec
    t = prompt.type
  }
  const cardType = t || 'basic'
  const res = await safeFetch(`${API_BASE}/content/cards/${cardId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      type: cardType,
      prompt: p,
      answer: a
    })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update card')
    throw new Error(msg)
  }
  return true
}

export async function copyCardToDeck(sourceCardId, targetDeckId){
  const res = await safeFetch(`${API_BASE}/content/cards/copy`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      sourceCardId: Number(sourceCardId),
      targetDeckId: Number(targetDeckId)
    })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to copy card to deck')
    throw new Error(msg)
  }
  return res.json()
}

export async function copyExerciseToGroup(sourceExerciseId, targetStudyGroupId){
  const res = await safeFetch(`${API_BASE}/exercises/copy`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      sourceExerciseId: Number(sourceExerciseId),
      targetStudyGroupId: targetStudyGroupId ? Number(targetStudyGroupId) : null
    })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to copy exercise to group')
    throw new Error(msg)
  }
  return res.json()
}

export async function deleteDeck(id){
  const res = await safeFetch(`${API_BASE}/content/decks/${id}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to delete deck')
    throw new Error(msg)
  }
  return true
}

export async function deleteCard(deckId, cardId){
  const res = await safeFetch(`${API_BASE}/content/cards/${cardId}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to delete card')
    throw new Error(msg)
  }
  return true
}

export async function submitReview(cardId, outcome){
  const res = await safeFetch(`${API_BASE}/reviews`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ cardId, outcome })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to submit review')
    throw new Error(msg)
  }
  return res.json()
}

export async function getFollowups(cardId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/followups`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch followups')
  return res.json()
}

export async function addFollowup(cardId, questionText){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/followups`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ questionText })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to add followup')
    throw new Error(msg)
  }
  return res.json()
}

export async function linkFollowupToCard(cardId, followupId, linkedCardId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/followups/${followupId}/link`,{
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ linkedCardId })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to link followup to card')
    throw new Error(msg)
  }
  return res.json()
}

export async function resetDeckProgress(deckId){
  const res = await safeFetch(`${API_BASE}/decks/${deckId}/reset`,{
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to reset deck progress')
    throw new Error(msg)
  }
  return res.json()
}

export async function getStudyQueue(deckId){
  const res = await safeFetch(`${API_BASE}/decks/${deckId}/study-queue`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study queue')
  return res.json()
}

export async function getExercises(language = '', studyGroupId = null){
  const params = []
  if (language) params.push(`language=${encodeURIComponent(language)}`)
  if (studyGroupId) params.push(`studyGroupId=${studyGroupId}`)
  const query = params.length ? `?${params.join('&')}` : ''
  const res = await safeFetch(`${API_BASE}/exercises${query}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch exercises')
  return res.json()
}

export async function getExercise(id){
  const res = await safeFetch(`${API_BASE}/exercises/${id}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch exercise details')
  return res.json()
}

export async function createExercise(exerciseData){
  const res = await safeFetch(`${API_BASE}/exercises`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(exerciseData)
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to create exercise')
    throw new Error(msg)
  }
  return res.json()
}

export async function updateExercise(id, exerciseData){
  const res = await safeFetch(`${API_BASE}/exercises/${id}`,{
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(exerciseData)
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update exercise')
    throw new Error(msg)
  }
  return true
}

export async function deleteExercise(id){
  const res = await safeFetch(`${API_BASE}/exercises/${id}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to delete exercise')
    throw new Error(msg)
  }
  return true
}

export async function getCardExercises(cardId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/exercises`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch card exercises')
  return res.json()
}

export async function linkCardExercise(cardId, exerciseId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/exercises/${exerciseId}`,{
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to link exercise to card')
    throw new Error(msg)
  }
  return res.json()
}

export async function unlinkCardExercise(cardId, exerciseId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/exercises/${exerciseId}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to unlink exercise from card')
    throw new Error(msg)
  }
  return true
}

export async function runCardCode(cardId, submittedCode, language = 'csharp'){
  const token = getToken()
  const endpoint = token ? `${API_BASE}/cards/${cardId}/run` : `${API_BASE}/cards/${cardId}/run-ephemeral`
  const res = await safeFetch(endpoint,{
    method: 'POST',
    headers: optionalAuthHeaders(),
    body: JSON.stringify({ submittedCode, language })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to run code')
    throw new Error(msg)
  }
  return res.json()
}

export async function runExerciseCode(exerciseId, submittedCode, language = 'csharp'){
  const token = getToken()
  const endpoint = token ? `${API_BASE}/exercises/${exerciseId}/run` : `${API_BASE}/exercises/${exerciseId}/run-ephemeral`
  const res = await safeFetch(endpoint,{
    method: 'POST',
    headers: optionalAuthHeaders(),
    body: JSON.stringify({ submittedCode, language })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to run exercise code')
    throw new Error(msg)
  }
  return res.json()
}

export async function submitExerciseReview(exerciseId, outcome){
  const res = await safeFetch(`${API_BASE}/exercises/${exerciseId}/reviews`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ outcome })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to submit exercise review')
    throw new Error(msg)
  }
  return res.json()
}

export async function getDueExercises(){
  const res = await safeFetch(`${API_BASE}/exercises/due`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch due exercises')
  return res.json()
}

export async function reseedExercises(){
  const res = await safeFetch(`${API_BASE}/exercises/reseed`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to reseed exercises')
  return res.json()
}

export async function unlinkFollowupCard(cardId, followupId, linkedCardId){
  const res = await safeFetch(`${API_BASE}/cards/${cardId}/followups/${followupId}/link/${linkedCardId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Unlink failed')
    throw new Error(msg)
  }
  return res.json()
}

export async function globalSearch(query, studyGroupId = null){
  if(!query || query.trim().length < 2) return { decks: [], cards: [], exercises: [], followups: [] }
  let url = `${API_BASE}/search?q=${encodeURIComponent(query.trim())}`
  if(studyGroupId) {
    url += `&studyGroupId=${encodeURIComponent(studyGroupId)}`
  }
  const res = await safeFetch(url, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Global search failed')
  return res.json()
}

export async function getMyCollectionExerciseIds(){
  const res = await safeFetch(`${API_BASE}/exercises/my-collection`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch collection')
  return res.json()
}

export async function enrollExercise(id){
  const res = await safeFetch(`${API_BASE}/exercises/${id}/enroll`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to add exercise to collection')
  return res.json()
}

export async function unenrollExercise(id){
  const res = await safeFetch(`${API_BASE}/exercises/${id}/enroll`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to remove exercise from collection')
  return res.json()
}

export async function getMyDueExercises(studyGroupId = null){
  const query = studyGroupId ? `?studyGroupId=${studyGroupId}` : ''
  const res = await safeFetch(`${API_BASE}/exercises/my-due${query}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch my due exercises')
  return res.json()
}

export async function importCardsFile(deckId, file){
  const formData = new FormData()
  formData.append('file', file)

  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await safeFetch(`${API_BASE}/decks/${deckId}/import-cards`, {
    method: 'POST',
    headers,
    body: formData
  })
  if (!res.ok) {
    const msg = await parseApiError(res, 'File import failed')
    throw new Error(msg)
  }
  return res.json()
}

export async function importCardsText(deckId, content, format = 'csv'){
  const res = await safeFetch(`${API_BASE}/decks/${deckId}/import-cards-text`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content, format })
  })
  if (!res.ok) {
    const msg = await parseApiError(res, 'Text import failed')
    throw new Error(msg)
  }
  return res.json()
}

export async function getStudyGroups(){
  const res = await safeFetch(`${API_BASE}/study-groups`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study groups')
  return res.json()
}
export const getCommunities = getStudyGroups

export async function getPublicStudyGroups(){
  const res = await safeFetch(`${API_BASE}/study-groups/public`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch public study groups')
  return res.json()
}
export const getPublicCommunities = getPublicStudyGroups

export async function getPublicDecks(){
  const res = await safeFetch(`${API_BASE}/decks/public`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch public decks')
  return res.json()
}

export async function getDeckPreview(deckId){
  const res = await safeFetch(`${API_BASE}/decks/${deckId}/preview`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch deck preview')
  return res.json()
}

export async function getPublicExercises(language = ''){
  const query = language ? `?language=${encodeURIComponent(language)}` : ''
  const res = await safeFetch(`${API_BASE}/exercises/public${query}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch public exercises')
  return res.json()
}

export async function getStudyGroupBySlug(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study group')
  return res.json()
}
export const getCommunityBySlug = getStudyGroupBySlug

export async function createStudyGroup(studyGroupData){
  const res = await safeFetch(`${API_BASE}/study-groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(studyGroupData)
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to create study group')
    throw new Error(msg)
  }
  return res.json()
}
export const createCommunity = createStudyGroup

export async function joinStudyGroup(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({})
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to join study group')
    throw new Error(msg)
  }
  return res.json()
}
export const joinCommunity = joinStudyGroup

export async function leaveStudyGroup(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/leave`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to leave study group')
    throw new Error(msg)
  }
  return res.json()
}
export const leaveCommunity = leaveStudyGroup

export async function getStudyGroupMembers(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/members`, { headers: optionalAuthHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study group members')
  return res.json()
}
export const getCommunityMembers = getStudyGroupMembers

export async function updateStudyGroupMemberRole(slug, targetUserId, role){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/members/${targetUserId}/role`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ role })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update member role')
    throw new Error(msg)
  }
  return res.json()
}
export const updateCommunityMemberRole = updateStudyGroupMemberRole

export async function addStudyGroupMember(slug, email, role = 'Member'){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/members`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, role })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to add member')
    throw new Error(msg)
  }
  return res.json()
}
export const addCommunityMember = addStudyGroupMember

export async function requestStudyGroupAccess(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/request-access`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to submit join request')
    throw new Error(msg)
  }
  return res.json()
}

export async function getStudyGroupJoinRequests(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/requests`, {
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to fetch join requests')
    throw new Error(msg)
  }
  return res.json()
}

export async function approveStudyGroupJoinRequest(slug, targetUserId){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/requests/${targetUserId}/approve`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to approve join request')
    throw new Error(msg)
  }
  return res.json()
}

export async function rejectStudyGroupJoinRequest(slug, targetUserId){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/requests/${targetUserId}/reject`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to reject join request')
    throw new Error(msg)
  }
  return res.json()
}

export async function inviteStudyGroupMember(slug, email, role = 'Member'){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/invite`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, role })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to send invitation')
    throw new Error(msg)
  }
  return res.json()
}

export async function getMyStudyGroupInvitations(){
  const res = await safeFetch(`${API_BASE}/study-groups/my-invitations`, {
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to fetch invitations')
    throw new Error(msg)
  }
  return res.json()
}

export async function acceptStudyGroupInvitation(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/invitations/accept`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to accept invitation')
    throw new Error(msg)
  }
  return res.json()
}

export async function declineStudyGroupInvitation(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/invitations/decline`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to decline invitation')
    throw new Error(msg)
  }
  return res.json()
}

export async function updateStudyGroupPrivacy(slug, privacy){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/privacy`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ privacy })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to update study group privacy')
    throw new Error(msg)
  }
  return res.json()
}

export async function transferStudyGroupOwnership(slug, newOwnerUserId){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/transfer-ownership`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ newOwnerUserId: Number(newOwnerUserId) })
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to transfer ownership')
    throw new Error(msg)
  }
  return res.json()
}

export async function freezeStudyGroup(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/freeze`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to freeze study group')
    throw new Error(msg)
  }
  return res.json()
}

export async function unfreezeStudyGroup(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}/unfreeze`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to unfreeze study group')
    throw new Error(msg)
  }
  return res.json()
}

export async function deleteStudyGroup(slug){
  const res = await safeFetch(`${API_BASE}/study-groups/${slug}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const msg = await parseApiError(res, 'Failed to delete study group')
    throw new Error(msg)
  }
  return res.json()
}


