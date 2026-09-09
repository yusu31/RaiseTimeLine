import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '../context/AuthContext'
import type { UserResponse } from '../types/auth'
import { useAuth } from '../hooks/useAuth'
import { AppHeader } from './AppHeader'

/**
 * すべての画面の上に出る共通ヘッダー。
 *
 * この部品の判断は1つだけで、「**ログイン情報があるときだけプロフィールへの入口を出す**」こと。
 * 情報が無いのにリンクを作ると、行き先が `/users/undefined` になってしまう。
 */
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

const demoUser: UserResponse = {
  id: 1,
  username: 'demo_user',
  displayName: 'デモ太郎',
  email: 'demo@example.com',
  iconImageUrl: null,
}

function setUser(user: UserResponse | null) {
  useAuthMock.mockReturnValue({
    user,
    accessToken: user ? 'access-token' : null,
    refreshToken: user ? 'refresh-token' : null,
    isAuthenticated: user !== null,
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateUser: vi.fn(),
  } satisfies AuthContextValue)
}

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const onLogout = props.onLogout ?? vi.fn()
  render(
    <MemoryRouter>
      <AppHeader isLoggingOut={false} {...props} onLogout={onLogout} />
    </MemoryRouter>,
  )
  return { onLogout }
}

beforeEach(() => {
  setUser(demoUser)
})

describe('AppHeader — リンク', () => {
  it('タイムラインへ戻るリンクを出す', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'RaiseTL' })).toHaveAttribute('href', '/timeline')
  })

  it('検索画面へのリンクを出す', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: '検索' })).toHaveAttribute('href', '/search')
  })

  it('ログイン情報があるときは自分のプロフィールへのリンクを出す', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'プロフィール' })).toHaveAttribute('href', '/users/demo_user')
  })

  it('ログイン情報が無いときはプロフィールへのリンクを出さない', () => {
    // 出す側だけを確かめると、行き先が /users/undefined になる実装でも緑になる
    setUser(null)

    renderHeader()

    expect(screen.queryByRole('link', { name: 'プロフィール' })).not.toBeInTheDocument()
  })
})

describe('AppHeader — ログアウトボタン', () => {
  it('押すと onLogout が呼ばれる', async () => {
    const { onLogout } = renderHeader()

    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('処理中は「ログアウト中…」と表示する', () => {
    renderHeader({ isLoggingOut: true })

    expect(screen.getByRole('button', { name: 'ログアウト中…' })).toBeInTheDocument()
  })

  it('処理中はボタンを押せない状態にする', () => {
    renderHeader({ isLoggingOut: true })

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('処理中でないときはボタンを押せる状態にする', () => {
    renderHeader({ isLoggingOut: false })

    expect(screen.getByRole('button')).toBeEnabled()
  })

  it('処理中に押しても onLogout は呼ばれない', async () => {
    const { onLogout } = renderHeader({ isLoggingOut: true })

    await userEvent.click(screen.getByRole('button'))

    expect(onLogout).not.toHaveBeenCalled()
  })
})
