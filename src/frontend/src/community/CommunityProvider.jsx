import React, { createContext, useContext, useState } from 'react'

const CommunityContext = createContext(null)

export function CommunityProvider({ children }) {
  const [activeCommunity, setActiveCommunityState] = useState(() => {
    try {
      const stored = localStorage.getItem('ankix_community')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const setActiveCommunity = (community) => {
    setActiveCommunityState(community)
    if (community) {
      localStorage.setItem('ankix_community', JSON.stringify(community))
    } else {
      localStorage.removeItem('ankix_community')
    }
  }

  const clearCommunity = () => {
    setActiveCommunityState(null)
    localStorage.removeItem('ankix_community')
  }

  return (
    <CommunityContext.Provider value={{ activeCommunity, setActiveCommunity, clearCommunity }}>
      {children}
    </CommunityContext.Provider>
  )
}

export function useCommunity() {
  return useContext(CommunityContext)
}
