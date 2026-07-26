const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function register(email, password){
  const res = await fetch(`${API_BASE}/auth/register`,{
    method:'POST',
    headers:{ 'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  })
  if(!res.ok) throw new Error('Register failed')
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
  }
  return data
}

export function getToken(){
  return localStorage.getItem('ankix_token')
}

export function logout(){
  localStorage.removeItem('ankix_token')
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

export async function getDecks(){
  const res = await fetch(`${API_BASE}/decks`, { headers: authHeaders() })
  if(!res.ok) throw new Error('Failed to fetch decks')
  return res.json()
}

export async function createDeck(title){
  const res = await fetch(`${API_BASE}/decks`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title })
  })
  if(!res.ok) throw new Error('Failed to create deck')
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

export async function createCard(deckId, front, back, code){
  const res = await fetch(`${API_BASE}/decks/${deckId}/cards`,{
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ front, back, code })
  })
  if(!res.ok) throw new Error('Failed to create card')
  return res.json()
}

export async function deleteDeck(id){
  const res = await fetch(`${API_BASE}/decks/${id}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to delete deck')
  return true
}

export async function deleteCard(deckId, cardId){
  const res = await fetch(`${API_BASE}/decks/${deckId}/cards/${cardId}`,{
    method: 'DELETE',
    headers: authHeaders()
  })
  if(!res.ok) throw new Error('Failed to delete card')
  return true
}
