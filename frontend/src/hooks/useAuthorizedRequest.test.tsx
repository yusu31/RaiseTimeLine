import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'
import { ApiError } from '../api/client'
import { apiRequest } from '../api/client'
import { refresh } from '../api/authApi'
import { useAuthorizedRequest } from './useAuthorizedRequest'

/**
 * このフックが持っているのは「通信そのもの」ではなく「再試行するかどうかの判断」。
 * だから隣の部品（apiRequest / refresh）はモックに置き換えて、判断だけを見る。
 * 実物を通すと、落ちたときにフックのバグか client.ts のバグか区別できなくなる。
 * バックエンドの Service 単体テストで Mapper をモックにしたのと同じ考え方。
 *
 * ただし ApiError は実物を使う。フックが `error instanceof ApiError` で分岐しているため、
 * ここを偽物に差し替えると判定そのものが成り立たなくなる。
 */
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, apiRequest: vi.fn() }
})

vi.mock('../api/authApi', () => ({ refresh: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)
const refreshMock = vi.mocked(refresh)

/** ログイン状態を表す値。テストごとに必要な部分だけ上書きする */
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

/**
 * フックを AuthProvider の内側で動かすための包み。
 * 本物の AuthProvider ではなく Context に値を直接入れているのは、
 * localStorage の状態に左右されず、テストごとにログイン状態を作り分けるため。
 */
function renderRequest(value: AuthContextValue) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
  return renderHook(() => useAuthorizedRequest(), { wrapper }).result
}

beforeEach(() => {
  apiRequestMock.mockReset()
  refreshMock.mockReset()
})

describe('useAuthorizedRequest — 再試行しない場合', () => {
  it('アクセストークンが無いとき、通信せずに401を投げる', async () => {
    const request = renderRequest(authValue({ accessToken: null }))

    await expect(request.current('/posts')).rejects.toMatchObject({
      status: 401,
      message: 'ログインしてください',
    })
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('1回目が成功したら、その結果を返してリフレッシュしない', async () => {
    apiRequestMock.mockResolvedValue({ id: 1 })
    const request = renderRequest(authValue())

    await expect(request.current('/posts/1')).resolves.toEqual({ id: 1 })
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('アクセストークンを付けて呼び出す', async () => {
    apiRequestMock.mockResolvedValue({})
    const request = renderRequest(authValue({ accessToken: 'token-abc' }))

    await request.current('/posts', { method: 'POST', body: { content: '本文' } })

    expect(apiRequestMock).toHaveBeenCalledWith('/posts', {
      method: 'POST',
      body: { content: '本文' },
      accessToken: 'token-abc',
    })
  })

  /**
   * 401以外はアクセストークンの期限切れではないので、リフレッシュしても解決しない。
   * ここで再試行してしまうと、サーバーエラーのたびに無駄な通信が増える。
   */
  it('401以外のエラーはそのまま投げ、リフレッシュしない', async () => {
    apiRequestMock.mockRejectedValue(new ApiError(500, 'サーバーエラー'))
    const request = renderRequest(authValue())

    await expect(request.current('/posts')).rejects.toMatchObject({ status: 500 })
    expect(refreshMock).not.toHaveBeenCalled()
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
  })

  it('リフレッシュトークンが無いときは、401でも再試行しない', async () => {
    apiRequestMock.mockRejectedValue(new ApiError(401, '認証が必要です'))
    const request = renderRequest(authValue({ refreshToken: null }))

    await expect(request.current('/posts')).rejects.toMatchObject({ status: 401 })
    expect(refreshMock).not.toHaveBeenCalled()
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
  })

  /**
   * 通信が届かない場合（サーバー停止・オフライン）は fetch が TypeError を投げる。
   * ApiError ではないので、リフレッシュの対象にしない。
   */
  it('ApiError ではない例外はそのまま投げ、リフレッシュしない', async () => {
    apiRequestMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const request = renderRequest(authValue())

    await expect(request.current('/posts')).rejects.toThrow(TypeError)
    expect(refreshMock).not.toHaveBeenCalled()
  })
})

describe('useAuthorizedRequest — 401のあとリフレッシュする場合', () => {
  it('リフレッシュに成功したら、新しいトークンで再試行して結果を返す', async () => {
    apiRequestMock
      .mockRejectedValueOnce(new ApiError(401, '認証が必要です'))
      .mockResolvedValueOnce({ id: 1 })
    refreshMock.mockResolvedValue({ accessToken: 'new-token' })
    const setAccessToken = vi.fn()
    const request = renderRequest(authValue({ accessToken: 'old-token', setAccessToken }))

    await expect(request.current('/posts/1')).resolves.toEqual({ id: 1 })

    expect(refreshMock).toHaveBeenCalledWith('refresh-token')
    expect(setAccessToken).toHaveBeenCalledWith('new-token')
    expect(apiRequestMock).toHaveBeenCalledTimes(2)
  })

  it('再試行では新しいアクセストークンを使う（古いトークンを使い回さない）', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiError(401, '認証が必要です')).mockResolvedValueOnce({})
    refreshMock.mockResolvedValue({ accessToken: 'new-token' })
    const request = renderRequest(authValue({ accessToken: 'old-token' }))

    await request.current('/posts')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/posts', { accessToken: 'old-token' })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/posts', { accessToken: 'new-token' })
  })

  it('再試行でもメソッドと本文を引き継ぐ', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiError(401, '認証が必要です')).mockResolvedValueOnce({})
    refreshMock.mockResolvedValue({ accessToken: 'new-token' })
    const request = renderRequest(authValue())

    await request.current('/posts', { method: 'POST', body: { content: '本文' } })

    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/posts', {
      method: 'POST',
      body: { content: '本文' },
      accessToken: 'new-token',
    })
  })

  /**
   * リフレッシュトークンまで期限切れになった場合。ログインし直すしかないので、
   * ログアウト状態にして最初の401を呼び出し側に伝える。
   */
  it('リフレッシュに失敗したらログアウトし、最初の401を投げる', async () => {
    const firstError = new ApiError(401, '認証が必要です')
    apiRequestMock.mockRejectedValue(firstError)
    refreshMock.mockRejectedValue(new ApiError(401, 'リフレッシュトークンが無効です'))
    const logout = vi.fn()
    const request = renderRequest(authValue({ logout }))

    await expect(request.current('/posts')).rejects.toBe(firstError)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('リフレッシュは成功したが再試行も401なら、ログアウトして最初の401を投げる', async () => {
    const firstError = new ApiError(401, '認証が必要です')
    apiRequestMock
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(new ApiError(401, 'まだ認証できません'))
    refreshMock.mockResolvedValue({ accessToken: 'new-token' })
    const logout = vi.fn()
    const request = renderRequest(authValue({ logout }))

    await expect(request.current('/posts')).rejects.toBe(firstError)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('リフレッシュに成功した場合はログアウトしない', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiError(401, '認証が必要です')).mockResolvedValueOnce({})
    refreshMock.mockResolvedValue({ accessToken: 'new-token' })
    const logout = vi.fn()
    const request = renderRequest(authValue({ logout }))

    await request.current('/posts')

    expect(logout).not.toHaveBeenCalled()
  })
})
