import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

const StudyGroupContext = createContext(null)

export function StudyGroupProvider({ children }) {
  const [activeStudyGroup, setActiveStudyGroupState] = useState(() => {
    try {
      const stored = localStorage.getItem('ankix_study_group') || localStorage.getItem('ankix_community')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const setActiveStudyGroup = useCallback((studyGroup) => {
    setActiveStudyGroupState(studyGroup)
    if (studyGroup) {
      localStorage.setItem('ankix_study_group', JSON.stringify(studyGroup))
    } else {
      localStorage.removeItem('ankix_study_group')
      localStorage.removeItem('ankix_community')
    }
  }, [])

  const syncActiveStudyGroup = useCallback((studyGroup) => {
    if (!studyGroup) return
    setActiveStudyGroupState(prev => {
      if (prev && (prev.id === studyGroup.id || (prev.slug && prev.slug === studyGroup.slug))) {
        let changed = false
        for (const [key, val] of Object.entries(studyGroup)) {
          if (prev[key] !== val) {
            changed = true
            break
          }
        }
        if (!changed) return prev
        const merged = { ...prev, ...studyGroup }
        localStorage.setItem('ankix_study_group', JSON.stringify(merged))
        return merged
      }
      localStorage.setItem('ankix_study_group', JSON.stringify(studyGroup))
      return studyGroup
    })
  }, [])

  const clearStudyGroup = useCallback(() => {
    setActiveStudyGroupState(null)
    localStorage.removeItem('ankix_study_group')
    localStorage.removeItem('ankix_community')
  }, [])

  const contextValue = useMemo(() => ({
    activeStudyGroup,
    setActiveStudyGroup,
    clearStudyGroup,
    syncActiveStudyGroup
  }), [activeStudyGroup, setActiveStudyGroup, clearStudyGroup, syncActiveStudyGroup])

  return (
    <StudyGroupContext.Provider value={contextValue}>
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
