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
  if(data?.token){
    localStorage.setItem('ankix_token', data.token)
  }
  return data
}

export function getToken(){
  return localStorage.getItem('ankix_token')
}

export function logout(){
  localStorage.removeItem('ankix_token')
}

export async function getDecks(){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks`,{ headers })
  if(!res.ok) throw new Error('Failed to fetch decks')
  return res.json()
}

export async function createDeck(title){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks`,{ method:'POST', headers, body: JSON.stringify({ title }) })
  if(!res.ok) throw new Error('Failed to create deck')
  return res.json()
}

export async function getDeck(id){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks/${id}`,{ headers })
  if(!res.ok) throw new Error('Failed to fetch deck')
  return res.json()
}

export async function getCards(deckId){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks/${deckId}/cards`,{ headers })
  if(!res.ok) throw new Error('Failed to fetch cards')
  return res.json()
}

export async function createCard(deckId, front, back, code){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks/${deckId}/cards`,{ method:'POST', headers, body: JSON.stringify({ front, back, code }) })
  if(!res.ok) throw new Error('Failed to create card')
  return res.json()
}

export async function deleteDeck(id){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks/${id}`,{ method:'DELETE', headers })
  if(!res.ok) throw new Error('Failed to delete deck')
  return true
}

export async function deleteCard(deckId, cardId){
  const token = getToken()
  const headers = { 'Content-Type':'application/json' }
  if(token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/decks/${deckId}/cards/${cardId}`,{ method:'DELETE', headers })
  if(!res.ok) throw new Error('Failed to delete card')
  return true
}
