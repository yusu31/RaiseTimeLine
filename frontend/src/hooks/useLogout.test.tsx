import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'
import { useLogout } from './useLogout'

/**
 * ログアウト処理をまとめたフック。
 *
 * このフックの要は「**通信が失敗しても必ずログアウトする**」こと。
 * サーバー側のトークン失効に失敗したからといって画面に留まらせると、
 * 利用者は「ログアウトを押したのにログインしたまま」という状態に置かれる。
 * 手元の認証情報を捨てるのは、通信の成否に関係なく実行できる。
 *
 * 画面遷移はモックで確かめる。ここで見たいのは「どこへ送ったか」であり、
 * 遷移先の画面が出ることではないため（門番のテストとは逆の判断）。
 */
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
vi.mock('react-router', () => ({ useNavigate: () => navigateMock }))

const { authorizedRequestMock } = vi.hoisted(() => ({ authorizedRequestMock: vi.fn() }))
vi.mock('./useAuthorizedRequest', () => ({
  useAuthorizedRequest: () => authorizedRequestMock,
}))

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateUser: vi.fn(),
    ...overrides,
  }
}

function renderLogout(value: AuthContextValue) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
  return renderHook(() => useLogout(), { wrapper }).result
}

beforeEach(() => {
  navigateMock.mockReset()
  authorizedRequestMock.mockReset()
  authorizedRequestMock.mockResolvedValue(undefined)
})

describe('useLogout — サーバーへの連絡', () => {
  it('リフレッシュトークンがあるときはログアウトを知らせる', async () => {
    const result = renderLogout(authValue({ refreshToken: 'refresh-token' }))

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(authorizedRequestMock).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      body: { refreshToken: 'refresh-token' },
    })
  })

  it('リフレッシュトークンが無いときは通信しない', async () => {
    // 失効させる対象が無いので、呼んでも意味がない
    const result = renderLogout(authValue({ refreshToken: null }))

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(authorizedRequestMock).not.toHaveBeenCalled()
  })
})

describe('useLogout — 手元の認証情報', () => {
  it('通信が成功したら認証状態を破棄する', async () => {
    const logout = vi.fn()
    const result = renderLogout(authValue({ logout }))

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('通信が失敗しても認証状態を破棄する', async () => {
    // ここが仕様の要。失敗を理由にログインしたままにしない
    authorizedRequestMock.mockRejectedValue(new Error('network error'))
    const logout = vi.fn()
    const result = renderLogout(authValue({ logout }))

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('リフレッシュトークンが無くても認証状態を破棄する', async () => {
    const logout = vi.fn()
    const result = renderLogout(authValue({ refreshToken: null, logout }))

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(logout).toHaveBeenCalledTimes(1)
  })
})

describe('useLogout — 画面遷移', () => {
  it('通信が成功したらログイン画面へ送る', async () => {
    const result = renderLogout(authValue())

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('通信が失敗してもログイン画面へ送る', async () => {
    authorizedRequestMock.mockRejectedValue(new Error('network error'))
    const result = renderLogout(authValue())

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('履歴を置き換えて移動する（戻るボタンで戻れないようにする）', async () => {
    // 置き換えないと、戻るボタンでログアウト前の画面に戻れてしまう
    const result = renderLogout(authValue())

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(navigateMock.mock.calls[0][1]).toEqual({ replace: true })
  })
})

describe('useLogout — 処理中の状態', () => {
  it('最初は処理中ではない', () => {
    const result = renderLogout(authValue())

    expect(result.current.isLoggingOut).toBe(false)
  })

  it('実行すると処理中になる（現状の挙動として記録）', async () => {
    // 実装は処理中フラグを false に戻していない。
    // ログアウト後は必ず画面が切り替わるため実害は無いが、
    // 「戻る」と思い込んだテストを書くと嘘になるので、現状をそのまま記録する
    const result = renderLogout(authValue())

    await act(async () => {
      await result.current.handleLogout()
    })

    await waitFor(() => expect(result.current.isLoggingOut).toBe(true))
  })
})
