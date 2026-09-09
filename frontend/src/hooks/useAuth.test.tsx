import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'
import { useAuth } from './useAuth'

/**
 * ログイン情報を取り出すための小さなフック。
 *
 * 中身はほぼ `useContext` だが、1つだけ判断を持っている。
 * **`AuthProvider` の外側で使われたときにエラーを投げる**という判断である。
 *
 * これが無いと、Provider の外で使ったとき `null` が返り、
 * `user.displayName` のような読み取りで「読めません」という分かりにくいエラーになる。
 * 原因（囲い忘れ）から遠い場所で落ちるため、直すのに時間がかかる。
 * **早い段階で、原因が書かれたエラーにして止める**ほうが直しやすい。
 */
const authValue: AuthContextValue = {
  user: { id: 1, username: 'demo_user', displayName: 'デモ太郎', email: 'demo@example.com' },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  setAccessToken: vi.fn(),
  updateUser: vi.fn(),
}

describe('useAuth', () => {
  it('AuthProvider の内側では認証状態をそのまま返す', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current).toBe(authValue)
  })

  it('AuthProvider の外側で使うと、原因が分かるエラーを投げる', () => {
    // 囲い忘れに気づけるよう、遠い場所で落ちる前にここで止める
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth は AuthProvider の内側でのみ使用できます',
    )
  })
})
