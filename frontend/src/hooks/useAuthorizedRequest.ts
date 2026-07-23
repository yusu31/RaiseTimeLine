import { useCallback } from 'react'
import { apiRequest, ApiError } from '../api/client'
import { refresh } from '../api/authApi'
import { useAuth } from './useAuth'

type RequestOptions = {
  method?: string
  body?: unknown
}

/**
 * 認証必須APIの呼び出し用フック。
 * アクセストークン切れ（401）を検知したら、リフレッシュトークンで新しいアクセストークンを取得して1回だけ再試行する。
 * リフレッシュ自体が失敗した場合（リフレッシュトークンも無効・期限切れ）はログアウト状態にする。
 */
export function useAuthorizedRequest() {
  const { accessToken, refreshToken, setAccessToken, logout } = useAuth()

  return useCallback(
    async <T,>(path: string, options: RequestOptions = {}): Promise<T> => {
      if (!accessToken) {
        throw new ApiError(401, 'ログインしてください')
      }

      try {
        return await apiRequest<T>(path, { ...options, accessToken })
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !refreshToken) {
          throw error
        }

        try {
          const response = await refresh(refreshToken)
          setAccessToken(response.accessToken)
          return await apiRequest<T>(path, { ...options, accessToken: response.accessToken })
        } catch {
          logout()
          throw error
        }
      }
    },
    [accessToken, refreshToken, setAccessToken, logout],
  )
}
