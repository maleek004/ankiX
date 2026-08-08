import React, { createContext, useContext, useState } from 'react'

const StudyGroupContext = createContext(null)

export function StudyGroupProvider({ children }) {
  const [activeStudyGroup, setActiveStudyGroupState] = useState(() => {
    try {
      const stored = localStorage.getItem('ankix_study_group') || localStorage.getItem('ankix_community')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const setActiveStudyGroup = (studyGroup) => {
    setActiveStudyGroupState(studyGroup)
    if (studyGroup) {
      localStorage.setItem('ankix_study_group', JSON.stringify(studyGroup))
    } else {
      localStorage.removeItem('ankix_study_group')
      localStorage.removeItem('ankix_community')
    }
  }

  const clearStudyGroup = () => {
    setActiveStudyGroupState(null)
    localStorage.removeItem('ankix_study_group')
    localStorage.removeItem('ankix_community')
  }

  return (
    <StudyGroupContext.Provider value={{ activeStudyGroup, setActiveStudyGroup, clearStudyGroup }}>
      {children}
    </StudyGroupContext.Provider>
  )
}

export function useStudyGroup() {
  return useContext(StudyGroupContext)
}

// Backward compatibility alias hook
export function useCommunity() {
  const context = useContext(StudyGroupContext)
  if (!context) return null
  return {
    activeCommunity: context.activeStudyGroup,
    setActiveCommunity: context.setActiveStudyGroup,
    clearCommunity: context.clearStudyGroup
  }
}
