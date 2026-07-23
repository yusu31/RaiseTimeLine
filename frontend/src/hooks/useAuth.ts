import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth は AuthProvider の内側でのみ使用できます')
  }
  return context
}
