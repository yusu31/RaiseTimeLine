import { createContext } from 'react'
import type { AuthResponse, UserResponse } from '../types/auth'

export type AuthContextValue = {
  user: UserResponse | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (auth: AuthResponse) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
