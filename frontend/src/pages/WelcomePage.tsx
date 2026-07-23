import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import type { HelloResponse } from '../types/hello'

export function WelcomePage() {
  const { user, refreshToken, logout } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const navigate = useNavigate()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    authorizedRequest<HelloResponse>('/hello')
      .then((response) => {
        if (!cancelled) {
          setMessage(response.message)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
        }
      })

    return () => {
      cancelled = true
    }
  }, [authorizedRequest])

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F9F9] px-4 text-center">
      <h1 className="text-3xl font-bold text-[#0F1419]">ログイン成功</h1>
      <p className="text-[#0F1419]">{user?.displayName}さん、ようこそ RaiseTimeLine へ。</p>
      {message && (
        <p className="rounded-lg bg-white px-4 py-3 text-sm text-[#0F1419] shadow-sm">{message}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="mt-4 rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-[#0F1419] transition hover:bg-gray-100 disabled:opacity-50"
      >
        {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
      </button>
    </div>
  )
}
