import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthResponse, UserResponse } from '../types/auth'
import { useAuth } from '../hooks/useAuth'
import { AuthProvider } from './AuthProvider'

/**
 * ログイン情報を抱えて、画面全体に配る係。
 *
 * この部品がいちばん大事なのは「**ブラウザを閉じても、次に開いたときログインしたまま**」を
 * 実現している点である。そのために localStorage（ブラウザに残るメモ帳）へ保存し、
 * 起動時に読み戻している。
 *
 * localStorage は jsdom にも用意されているので、ここでは偽物を使わず本物を使う。
 * 保存されたかどうかを、実際に保存先を見て確かめられるほうが確実なため。
 */
const STORAGE_KEY = 'raisetimeline.auth'

const demoUser: UserResponse = {
  id: 1,
  username: 'demo_user',
  displayName: 'デモ太郎',
  email: 'demo@example.com',
  iconImageUrl: null,
}

const anotherUser: UserResponse = { ...demoUser, displayName: '改名した太郎' }

const loginResponse: AuthResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: demoUser,
}

/** 保存済みのログイン情報を作る */
function storeAuth() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accessToken: 'stored-access', refreshToken: 'stored-refresh', user: demoUser }),
  )
}

/** 保存先の中身を読み出す。保存されていなければ null */
function readStored(): { accessToken: string; refreshToken: string; user: UserResponse } | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

/**
 * 中の値を画面に出し、操作もできる観測用の部品。
 * フックの戻り値を直接のぞくのではなく、
 * 「使う側から見てどうなるか」で確かめるためにこの形にしている。
 */
function Probe() {
  const { user, accessToken, refreshToken, isAuthenticated, login, logout, setAccessToken, updateUser } =
    useAuth()

  return (
    <div>
      <p>認証: {isAuthenticated ? 'あり' : 'なし'}</p>
      <p>名前: {user?.displayName ?? 'なし'}</p>
      <p>アクセス: {accessToken ?? 'なし'}</p>
      <p>リフレッシュ: {refreshToken ?? 'なし'}</p>
      <button onClick={() => login(loginResponse)}>ログインする</button>
      <button onClick={() => logout()}>ログアウトする</button>
      <button onClick={() => setAccessToken('new-access')}>トークンを差し替える</button>
      <button onClick={() => updateUser(anotherUser)}>ユーザーを更新する</button>
    </div>
  )
}

function renderProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('AuthProvider — 起動時', () => {
  it('保存された情報が無いときは未ログインで始まる', () => {
    renderProvider()

    expect(screen.getByText('認証: なし')).toBeInTheDocument()
  })

  it('保存された情報があればログイン状態を取り戻す', () => {
    // これが無いと、再読み込みのたびにログインし直しになる
    storeAuth()

    renderProvider()

    expect(screen.getByText('認証: あり')).toBeInTheDocument()
  })

  it('保存された情報からユーザーとトークンを取り戻す', () => {
    storeAuth()

    renderProvider()

    expect(screen.getByText('名前: デモ太郎')).toBeInTheDocument()
    expect(screen.getByText('アクセス: stored-access')).toBeInTheDocument()
  })

  it('保存された値が壊れていても、未ログインとして起動する', () => {
    // JSONとして読めない文字列が入っていても、例外で画面が真っ白になってはいけない
    localStorage.setItem(STORAGE_KEY, '{壊れたデータ')

    renderProvider()

    expect(screen.getByText('認証: なし')).toBeInTheDocument()
  })
})

describe('AuthProvider — ログイン', () => {
  it('ログインすると認証状態になる', async () => {
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ログインする' }))

    expect(screen.getByText('認証: あり')).toBeInTheDocument()
  })

  it('ログインすると情報がブラウザに保存される', async () => {
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ログインする' }))

    expect(readStored()?.accessToken).toBe('access-token')
  })
})

describe('AuthProvider — ログアウト', () => {
  it('ログアウトすると未認証になる', async () => {
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ログアウトする' }))

    expect(screen.getByText('認証: なし')).toBeInTheDocument()
  })

  it('ログアウトすると保存された情報も消える', async () => {
    // 消し忘れると、次に開いたとき無効なトークンで復活してしまう
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ログアウトする' }))

    expect(readStored()).toBeNull()
  })
})

describe('AuthProvider — アクセストークンの差し替え', () => {
  it('アクセストークンだけを新しい値にする', async () => {
    // 有効期限が切れたときに、ログインし直さず裏で入れ替えるための入口
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'トークンを差し替える' }))

    expect(screen.getByText('アクセス: new-access')).toBeInTheDocument()
  })

  it('差し替えてもリフレッシュトークンとユーザーは残る', async () => {
    // ここが消えると、次の差し替えができなくなって結局ログアウトになる
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'トークンを差し替える' }))

    expect(screen.getByText('リフレッシュ: stored-refresh')).toBeInTheDocument()
    expect(screen.getByText('名前: デモ太郎')).toBeInTheDocument()
  })

  it('未ログインのときに差し替えても、ログイン状態にはならない', async () => {
    // 「入れ替える」であって「作る」ではない
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'トークンを差し替える' }))

    expect(screen.getByText('認証: なし')).toBeInTheDocument()
  })
})

describe('AuthProvider — ユーザー情報の更新', () => {
  it('ユーザー情報だけを新しい値にする', async () => {
    // プロフィールを編集したとき、ヘッダーの表示を追従させるための入口
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ユーザーを更新する' }))

    expect(screen.getByText('名前: 改名した太郎')).toBeInTheDocument()
  })

  it('更新してもトークンは残る', async () => {
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ユーザーを更新する' }))

    expect(screen.getByText('アクセス: stored-access')).toBeInTheDocument()
  })

  it('未ログインのときに更新しても、ログイン状態にはならない', async () => {
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ユーザーを更新する' }))

    expect(screen.getByText('認証: なし')).toBeInTheDocument()
  })

  it('更新した内容はブラウザにも保存される', async () => {
    storeAuth()
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'ユーザーを更新する' }))

    expect(readStored()?.user.displayName).toBe('改名した太郎')
  })
})
