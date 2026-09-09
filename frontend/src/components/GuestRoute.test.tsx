import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import { GuestRoute } from './GuestRoute'

/**
 * ProtectedRoute とちょうど裏返しの門番。
 * ログイン済みの人にログイン画面や登録画面を見せない。
 *
 * 見せてしまうと「もう入っているのに、もう一度ログインを求められた」ように見え、
 * 二重にログインして前のトークンが行方不明になる事故につながる。
 */
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

function authValue(isAuthenticated: boolean): AuthContextValue {
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated,
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateUser: vi.fn(),
  }
}

/** /login を GuestRoute で囲った状態で、/login を開いたときの結果を見る */
function renderAt(isAuthenticated: boolean) {
  useAuthMock.mockReturnValue(authValue(isAuthenticated))

  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<p>ログイン画面</p>} />
        </Route>
        <Route path="/timeline" element={<p>タイムラインの中身</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GuestRoute', () => {
  it('ログイン済みのときはタイムラインへ送る', () => {
    renderAt(true)

    expect(screen.getByText('タイムラインの中身')).toBeInTheDocument()
  })

  it('ログイン済みのときはログイン画面を表示しない', () => {
    renderAt(true)

    expect(screen.queryByText('ログイン画面')).not.toBeInTheDocument()
  })

  it('ログインしていないときはログイン画面をそのまま表示する', () => {
    renderAt(false)

    expect(screen.getByText('ログイン画面')).toBeInTheDocument()
  })

  it('ログインしていないときはタイムラインへ送らない', () => {
    renderAt(false)

    expect(screen.queryByText('タイムラインの中身')).not.toBeInTheDocument()
  })
})
