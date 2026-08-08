import React, { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export default function Register(){
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const auth = useAuth()
  const submit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try{
      await auth.register(email, password, displayName)
      alert('Registered successfully — please login')
      window.location.href = '/login'
    }catch(err){
      alert('Register failed: ' + (err.message || err))
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Create an Account on AnkiX</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Display Name</label>
            <input className="form-control" type="text" placeholder="e.g. Alex Smith" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          <button disabled={isLoading} type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {isLoading ? "Registering..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  )
}


