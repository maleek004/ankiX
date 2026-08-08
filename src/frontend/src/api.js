const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api'

export async function register(email, password, displayName){
  const res = await fetch(`${API_BASE}/auth/register`,{
    method:'POST',
    headers:{ 'Content-Type':'application/json'},
    body: JSON.stringify({ email, password, displayName: displayName || null })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Register failed')
  }
  return res.json()
}

export async function getAdminUsers(){
  const res = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch admin users')
  return res.json()
}

export async function updateUserRole(userId, role){
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ role })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to update user role')
  }
  return res.json()
}

export async function login(email, password){
  const res = await fetch(`${API_BASE}/auth/login`,{
    method:'POST',
    headers:{ 'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Login failed')
  }
  const data = await res.json()
  // Backend returns { accessToken, expiresInSeconds, user }
  if(data?.accessToken){
    localStorage.setItem('ankix_token', data.accessToken)
    if(data?.user){
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
    }
  }
  return data
}

export function getToken(){
  return localStorage.getItem('ankix_token')
}

export function getUser(){
  const storedUser = localStorage.getItem('ankix_user')
  if(storedUser){
    try { return JSON.parse(storedUser) } catch {}
  }
  const token = getToken()
  if(token){
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload['role'] || payload['Role']
      const email = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || payload['email']
      const id = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload['sub'] || payload['id']
      return { id, email, role }
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

export function logout(){
  localStorage.removeItem('ankix_token')
  localStorage.removeItem('ankix_user')
}

/**
 * Returns headers with Authorization attached.
 * Throws a clear error if no token is found so callers
 * never silently send unauthenticated requests.
 */
function authHeaders(){
  const token = getToken()
  if(!token) throw new Error('Not authenticated — please log in.')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}

export async function getDecks(studyGroupId = null){
  const query = studyGroupId ? `?studyGroupId=${studyGroupId}` : ''
  const res = await fetch(`${API_BASE}/decks${query}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch decks')
  return res.json()
}

export async function createDeck(title, description = '', studyGroupId = null){
  const body = { title, description }
  if (studyGroupId) body.studyGroupId = studyGroupId
  const res = await fetch(`${API_BASE}/content/decks`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to create deck')
  }
  return res.json()
}

export async function getDeck(id){
  const res = await fetch(`${API_BASE}/decks/${id}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch deck')
  return res.json()
}

export async function getCards(deckId){
  const res = await fetch(`${API_BASE}/decks/${deckId}/cards`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch cards')
  return res.json()
}

export async function getCard(cardId){
  const res = await fetch(`${API_BASE}/cards/${cardId}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch card')
  return res.json()
}

export async function getAllCards(){
  const res = await fetch(`${API_BASE}/cards`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch all cards')
  return res.json()
}

export async function createCard(deckId, prompt, validationSpec, type = 'basic'){
  let p = prompt
  let v = validationSpec
  let t = type
  if (typeof prompt === 'object' && prompt !== null) {
    p = prompt.prompt
    v = prompt.validationSpec
    t = prompt.type
  }
  const cardType = t || 'basic'
  const res = await fetch(`${API_BASE}/content/cards`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      deckId: Number(deckId),
      type: cardType === 'micro-coding' ? 'micro-coding' : 'concept',
      prompt: p,
      validationSpec: v || null
    })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to create card')
  }
  return res.json()
}

export async function deleteDeck(id){
  const res = await fetch(`${API_BASE}/content/decks/${id}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to delete deck')
  }
  return true
}

export async function deleteCard(deckId, cardId){
  const res = await fetch(`${API_BASE}/content/cards/${cardId}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to delete card')
  }
  return true
}

export async function submitReview(cardId, outcome){
  const res = await fetch(`${API_BASE}/reviews`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ cardId, outcome })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to submit review')
  }
  return res.json()
}

export async function getFollowups(cardId){
  const res = await fetch(`${API_BASE}/cards/${cardId}/followups`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch followups')
  return res.json()
}

export async function addFollowup(cardId, questionText){
  const res = await fetch(`${API_BASE}/cards/${cardId}/followups`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ questionText })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to add followup')
  }
  return res.json()
}

export async function linkFollowupToCard(cardId, followupId, linkedCardId){
  const res = await fetch(`${API_BASE}/cards/${cardId}/followups/${followupId}/link`,{
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ linkedCardId })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to link followup to card')
  }
  return res.json()
}

export async function resetDeckProgress(deckId){
  const res = await fetch(`${API_BASE}/decks/${deckId}/reset`,{
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to reset deck progress')
  }
  return res.json()
}

export async function getStudyQueue(deckId){
  const res = await fetch(`${API_BASE}/decks/${deckId}/study-queue`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study queue')
  return res.json()
}

export async function getExercises(language = '', studyGroupId = null){
  const params = []
  if (language) params.push(`language=${encodeURIComponent(language)}`)
  if (studyGroupId) params.push(`studyGroupId=${studyGroupId}`)
  const query = params.length ? `?${params.join('&')}` : ''
  const res = await fetch(`${API_BASE}/exercises${query}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch exercises')
  return res.json()
}

export async function getExercise(id){
  const res = await fetch(`${API_BASE}/exercises/${id}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch exercise details')
  return res.json()
}

export async function createExercise(exerciseData){
  const res = await fetch(`${API_BASE}/exercises`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(exerciseData)
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to create exercise')
  }
  return res.json()
}

export async function getCardExercises(cardId){
  const res = await fetch(`${API_BASE}/cards/${cardId}/exercises`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch card exercises')
  return res.json()
}

export async function linkCardExercise(cardId, exerciseId){
  const res = await fetch(`${API_BASE}/cards/${cardId}/exercises/${exerciseId}`,{
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to link exercise to card')
  }
  return res.json()
}

export async function unlinkCardExercise(cardId, exerciseId){
  const res = await fetch(`${API_BASE}/cards/${cardId}/exercises/${exerciseId}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to unlink exercise from card')
  }
  return true
}

export async function runCardCode(cardId, submittedCode, language = 'csharp'){
  const res = await fetch(`${API_BASE}/cards/${cardId}/run`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ submittedCode, language })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to run code')
  }
  return res.json()
}

export async function runExerciseCode(exerciseId, submittedCode, language = 'csharp'){
  const res = await fetch(`${API_BASE}/exercises/${exerciseId}/run`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ submittedCode, language })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to run exercise code')
  }
  return res.json()
}

export async function submitExerciseReview(exerciseId, outcome){
  const res = await fetch(`${API_BASE}/exercises/${exerciseId}/reviews`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ outcome })
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Failed to submit exercise review')
  }
  return res.json()
}

export async function getDueExercises(){
  const res = await fetch(`${API_BASE}/exercises/due`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch due exercises')
  return res.json()
}

export async function reseedExercises(){
  const res = await fetch(`${API_BASE}/exercises/reseed`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to reseed exercises')
  return res.json()
}

export async function unlinkFollowupCard(cardId, followupId, linkedCardId){
  const res = await fetch(`${API_BASE}/cards/${cardId}/followups/${followupId}/link/${linkedCardId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const txt = await res.text()
    throw new Error(txt || 'Unlink failed')
  }
  return res.json()
}

export async function globalSearch(query){
  if(!query || query.trim().length < 2) return { decks: [], cards: [], exercises: [], followups: [] }
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query.trim())}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Global search failed')
  return res.json()
}

export async function getMyCollectionExerciseIds(){
  const res = await fetch(`${API_BASE}/exercises/my-collection`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch collection')
  return res.json()
}

export async function enrollExercise(id){
  const res = await fetch(`${API_BASE}/exercises/${id}/enroll`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to add exercise to collection')
  return res.json()
}

export async function unenrollExercise(id){
  const res = await fetch(`${API_BASE}/exercises/${id}/enroll`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to remove exercise from collection')
  return res.json()
}

export async function getMyDueExercises(){
  const res = await fetch(`${API_BASE}/exercises/my-due`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch my due exercises')
  return res.json()
}

export async function importCardsFile(deckId, file){
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('token')
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/decks/${deckId}/import-cards`, {
    method: 'POST',
    headers,
    body: formData
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'File import failed')
  }
  return res.json()
}

export async function importCardsText(deckId, content, format = 'csv'){
  const res = await fetch(`${API_BASE}/decks/${deckId}/import-cards-text`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content, format })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Text import failed')
  }
  return res.json()
}

export async function getStudyGroups(){
  const res = await fetch(`${API_BASE}/study-groups`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study groups')
  return res.json()
}
export const getCommunities = getStudyGroups

export async function getStudyGroupBySlug(slug){
  const res = await fetch(`${API_BASE}/study-groups/${slug}`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study group')
  return res.json()
}
export const getCommunityBySlug = getStudyGroupBySlug

export async function createStudyGroup(studyGroupData){
  const res = await fetch(`${API_BASE}/study-groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(studyGroupData)
  })
  if(!res.ok){
    const errText = await res.text()
    throw new Error(errText || 'Failed to create study group')
  }
  return res.json()
}
export const createCommunity = createStudyGroup

export async function joinStudyGroup(slug){
  const res = await fetch(`${API_BASE}/study-groups/${slug}/join`, {
    method: 'POST',
    headers: authHeaders()
  })
  if(!res.ok){
    const errText = await res.text()
    throw new Error(errText || 'Failed to join study group')
  }
  return res.json()
}
export const joinCommunity = joinStudyGroup

export async function leaveStudyGroup(slug){
  const res = await fetch(`${API_BASE}/study-groups/${slug}/leave`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok){
    const errText = await res.text()
    throw new Error(errText || 'Failed to leave study group')
  }
  return res.json()
}
export const leaveCommunity = leaveStudyGroup

export async function getStudyGroupMembers(slug){
  const res = await fetch(`${API_BASE}/study-groups/${slug}/members`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch study group members')
  return res.json()
}
export const getCommunityMembers = getStudyGroupMembers

export async function updateStudyGroupMemberRole(slug, targetUserId, role){
  const res = await fetch(`${API_BASE}/study-groups/${slug}/members/${targetUserId}/role`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ role })
  })
  if(!res.ok){
    const errText = await res.text()
    throw new Error(errText || 'Failed to update member role')
  }
  return res.json()
}
export const updateCommunityMemberRole = updateStudyGroupMemberRole

export async function addStudyGroupMember(slug, email, role = 'Member'){
  const res = await fetch(`${API_BASE}/study-groups/${slug}/members`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, role })
  })
  if(!res.ok){
    const errText = await res.text()
    throw new Error(errText || 'Failed to add member')
  }
  return res.json()
}
export const addCommunityMember = addStudyGroupMember
