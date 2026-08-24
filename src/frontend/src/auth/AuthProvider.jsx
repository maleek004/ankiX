import React, { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => {
    try{ return JSON.parse(localStorage.getItem('ankix_user') || 'null') }catch{ return null }
  })

  useEffect(() => {
    if (!user) return

    const sendHeartbeat = async () => {
      try {
        await api.sendPresenceHeartbeat()
      } catch (err) {
        // Non-blocking background heartbeat
      }
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 120000) // Every 2 minutes
    return () => clearInterval(interval)
  }, [user])




  const login = async (email, password) => {
    const data = await api.login(email, password)
    if(data?.user){
      setUser(data.user)
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
      localStorage.removeItem('ankix_study_group')
      localStorage.removeItem('ankix_community')
    }
    return data
  }

  const oauthLogin = async (provider, payload) => {
    const data = await api.oauthLogin(provider, payload)
    if(data?.user){
      setUser(data.user)
      localStorage.setItem('ankix_user', JSON.stringify(data.user))
      localStorage.removeItem('ankix_study_group')
      localStorage.removeItem('ankix_community')
    }
    return data
  }

  const register = async (email, password, displayName) => {
    const data = await api.register(email, password, displayName)
    return data
  }

  const updateUser = (updatedUserData) => {
    setUser(prev => {
      if (!prev) return prev
      const merged = { ...prev, ...updatedUserData }
      localStorage.setItem('ankix_user', JSON.stringify(merged))
      return merged
    })
  }

  const logout = () => {
    api.logout()
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, login, oauthLogin, logout, register, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}


export function useAuth(){
  return useContext(AuthContext)
}
