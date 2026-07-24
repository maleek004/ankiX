import React, { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => {
    try{ return JSON.parse(localStorage.getItem('ankix_user') || 'null') }catch{ return null }
  })

  useEffect(()=>{
    // noop: token is persisted in api.js localStorage by login
  },[])




  const login = async (email, password) => {
    const data = await api.login(email, password)
    if(data?.user){
      setUser(data.user)
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
    }
    return data
  }

  const register = async (email, password) => {
    const data = await api.register(email, password)
    return data
  }

  const logout = () => {
    api.logout()
    setUser(null)
    localStorage.removeItem('ankix_user')
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(){
  return useContext(AuthContext)
}
