import React, { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export default function Login(){
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    try{
      await auth.login(email, password)
      // redirect to decks
      window.location.href = '/decks'
    }catch(err){
      alert('Login failed: ' + (err.message || err))
    }
  }

  return (
    <form onSubmit={submit} style={{maxWidth:400}}>
      <h2>Login</h2>
      <label>Email</label>
      <input value={email} onChange={e=>setEmail(e.target.value)} />
      <label>Password</label>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  )
}
