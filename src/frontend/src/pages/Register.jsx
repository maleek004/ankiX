import React, { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const auth = useAuth()
  const submit = async (e) => {
    e.preventDefault()
    try{
      await auth.register(email, password)
      alert('Registered — please login')
      window.location.href = '/login'
    }catch(err){
      alert('Register failed: ' + (err.message || err))
    }
  }

  return (
    <form onSubmit={submit} style={{maxWidth:400}}>
      <h2>Register</h2>
      <label>Email</label>
      <input value={email} onChange={e=>setEmail(e.target.value)} />
      <label>Password</label>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button type="submit">Register</button>
    </form>
  )
}
