import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import { ProtectedRoute } from './ProtectedRoute'

/**
 * ログインしていない人を締め出す門番。
 *
 * react-router はモックにしない。本物のルート定義を MemoryRouter に組めば
 * 「ログイン画面が実際に出た」という結果そのものを確かめられる。
 * モックにすると「Navigate という部品が呼ばれた」ことしか分からず、
 * 行き先が /login で合っているかを確かめられない。
 *
 * 代わりに useAuth だけをモックにする。本物を使うと AuthProvider と
 * localStorage まで巻き込み、落ちたときにどこが原因か切り分けられなくなる。
 */
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

/** この部品が見るのは isAuthenticated だけだが、型を満たすため他も埋める */
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

/** /timeline を守らせた状態で、/timeline を開いたときの結果を見る */
function renderAt(isAuthenticated: boolean) {
  useAuthMock.mockReturnValue(authValue(isAuthenticated))

  render(
    <MemoryRouter initialEntries={['/timeline']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/timeline" element={<p>タイムラインの中身</p>} />
        </Route>
        <Route path="/login" element={<p>ログイン画面</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('ログインしていないときはログイン画面へ送る', () => {
    renderAt(false)

    expect(screen.getByText('ログイン画面')).toBeInTheDocument()
  })

  it('ログインしていないときは守られている中身を表示しない', () => {
    // 「ログイン画面が出た」だけでは、中身も一緒に出ている可能性を否定できない
    renderAt(false)

    expect(screen.queryByText('タイムラインの中身')).not.toBeInTheDocument()
  })

  it('ログイン済みのときは中身をそのまま表示する', () => {
    renderAt(true)

    expect(screen.getByText('タイムラインの中身')).toBeInTheDocument()
  })

  it('ログイン済みのときはログイン画面へ送らない', () => {
    renderAt(true)

    expect(screen.queryByText('ログイン画面')).not.toBeInTheDocument()
  })
})
