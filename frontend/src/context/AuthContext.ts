import { createContext } from 'react'
import type { AuthResponse, UserResponse } from '../types/auth'

export type AuthContextValue = {
  user: UserResponse | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (auth: AuthResponse) => void
  logout: () => void
  setAccessToken: (accessToken: string) => void
  /** プロフィール編集後に、ヘッダーなどに表示しているログインユーザー情報を最新化する */
  updateUser: (user: UserResponse) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
