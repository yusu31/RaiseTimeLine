import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import type { HelloResponse } from '../types/hello'

export function WelcomePage() {
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F9F9] px-4 text-center">
      <h1 className="text-3xl font-bold text-[#0F1419]">ログイン成功</h1>
      <p className="text-[#0F1419]">{user?.displayName}さん、ようこそ RaiseTimeLine へ。</p>
      {message && (
        <p className="rounded-lg bg-white px-4 py-3 text-sm text-[#0F1419] shadow-sm">{message}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
