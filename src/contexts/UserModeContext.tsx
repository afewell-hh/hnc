import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type UserMode = 'guided' | 'expert'

interface UserModeContextType {
  mode: UserMode
  setMode: (mode: UserMode) => void
  isGuided: boolean
  isExpert: boolean
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined)

const USER_MODE_STORAGE_KEY = 'hnc-user-mode'

interface UserModeProviderProps {
  children: ReactNode
  defaultMode?: UserMode
}

export const UserModeProvider: React.FC<UserModeProviderProps> = ({
  children,
  defaultMode = 'guided'
}) => {
  // Initialize mode from localStorage or use default
  const [mode, setModeState] = useState<UserMode>(() => {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem(USER_MODE_STORAGE_KEY)
      if (storedMode === 'guided' || storedMode === 'expert') {
        return storedMode
      }
    }
    return defaultMode
  })

  // Persist mode changes to localStorage
  const setMode = (newMode: UserMode) => {
    setModeState(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_MODE_STORAGE_KEY, newMode)
    }
  }

  // Convenience flags
  const isGuided = mode === 'guided'
  const isExpert = mode === 'expert'

  const value: UserModeContextType = {
    mode,
    setMode,
    isGuided,
    isExpert
  }

  return (
    <UserModeContext.Provider value={value}>
      {children}
    </UserModeContext.Provider>
  )
}

export const useUserMode = (): UserModeContextType => {
  const context = useContext(UserModeContext)
  if (context === undefined) {
    throw new Error('useUserMode must be used within a UserModeProvider')
  }
  return context
}

// Export for testing
export { USER_MODE_STORAGE_KEY }