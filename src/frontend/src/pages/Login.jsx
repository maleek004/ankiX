import React, { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'

export default function Login(){
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')

  const submit = async (e) => {
    setIsLoading(true)
    e.preventDefault()
    try{
      await auth.login(email, password)
      window.location.href = '/decks'
    }catch(err){
      alert('Login failed: ' + (err.message || err))
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Log In to AnkiX</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          <button disabled={isLoading} type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>
        <SocialButtons mode="login" />
      </div>
    </div>
  )
}


