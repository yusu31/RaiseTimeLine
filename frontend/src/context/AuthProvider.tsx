import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type { UserResponse } from '../types/auth'

const STORAGE_KEY = 'raisetimeline.auth'

type StoredAuth = {
  accessToken: string
  refreshToken: string
  user: UserResponse
}

function loadStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadStoredAuth())

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [auth])

  const value: AuthContextValue = {
    user: auth?.user ?? null,
    accessToken: auth?.accessToken ?? null,
    refreshToken: auth?.refreshToken ?? null,
    isAuthenticated: auth !== null,
    login: (response) => {
      setAuth({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      })
    },
    logout: () => {
      setAuth(null)
    },
    setAccessToken: (accessToken) => {
      setAuth((current) => (current ? { ...current, accessToken } : current))
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
