import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './useAuth'
import { useAuthorizedRequest } from './useAuthorizedRequest'

/**
 * ログアウト処理をまとめたフック。
 * 共通ヘッダー（AppHeader）を表示する画面が複数あるため、同じ処理を各画面に書かずに済むよう切り出している。
 */
export function useLogout() {
  const { refreshToken, logout } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      if (refreshToken) {
        await authorizedRequest('/auth/logout', { method: 'POST', body: { refreshToken } })
      }
    } catch {
      // ログアウトAPIが失敗しても、ローカルの認証状態は必ず破棄する
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return { handleLogout, isLoggingOut }
}
