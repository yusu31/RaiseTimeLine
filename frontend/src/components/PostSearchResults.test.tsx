import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { searchPosts } from '../api/postApi'
import type { AuthContextValue } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import type { Post, PostListResponse } from '../types/post'
import { PostSearchResults } from './PostSearchResults'

/**
 * 検索画面の「投稿」タブの中身。
 *
 * 投稿カード（PostCard）は本物を使う。単体テストが済んでいる部品なので、
 * ここでは「検索結果を正しく渡せているか」の確認に集中できる。
 */
vi.mock('../api/postApi', () => ({
  searchPosts: vi.fn(),
  deletePost: vi.fn(),
  updatePost: vi.fn(),
}))

const { authorizedRequestMock } = vi.hoisted(() => ({ authorizedRequestMock: vi.fn() }))
vi.mock('../hooks/useAuthorizedRequest', () => ({
  useAuthorizedRequest: () => authorizedRequestMock,
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

/**
 * 無限スクロールは IntersectionObserver（要素が画面に入ったことを知る仕組み）を使う。
 * テストを動かす jsdom にはこの仕組みが無いため、何もしない偽物を置いて描画できるようにする。
 * 全テスト共通の setup.ts ではなくこのファイルに閉じ込めるのは、
 * 関係のないテストにまで偽物を持ち込まないためである。
 */
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

const searchPostsMock = vi.mocked(searchPosts)
const useAuthMock = vi.mocked(useAuth)

const LOGIN_USER_ID = 10

const myPost: Post = {
  id: 1,
  content: 'テストの書き方を調べた',
  imageUrl: null,
  author: { id: LOGIN_USER_ID, username: 'demo_user', displayName: 'デモ太郎', iconImageUrl: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  createdAt: '2026-06-15T12:00:00+09:00',
}

const otherPost: Post = {
  ...myPost,
  id: 2,
  content: '他の人が書いた投稿',
  author: { id: 99, username: 'user1', displayName: '鈴木', iconImageUrl: null },
}

function listOf(posts: Post[]): PostListResponse {
  return { posts, page: 0, hasNext: false }
}

function renderResults(keyword: string) {
  return render(
    <MemoryRouter>
      <PostSearchResults keyword={keyword} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  searchPostsMock.mockReset()
  useAuthMock.mockReturnValue({
    user: { id: LOGIN_USER_ID, username: 'demo_user', displayName: 'デモ太郎', email: 'demo@example.com' },
    accessToken: 'dummy',
    refreshToken: 'dummy',
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateUser: vi.fn(),
  } satisfies AuthContextValue)
})

describe('PostSearchResults — キーワードが空のとき', () => {
  it('使い方の案内を表示する', () => {
    renderResults('')

    expect(screen.getByText('キーワードを入力すると投稿を検索できます')).toBeInTheDocument()
  })

  it('検索そのものを行わない', () => {
    renderResults('')

    expect(searchPostsMock).not.toHaveBeenCalled()
  })
})

describe('PostSearchResults — 検索できたとき', () => {
  it('入力されたキーワードで検索する', async () => {
    searchPostsMock.mockResolvedValue(listOf([myPost]))

    renderResults('テスト')

    await waitFor(() => expect(searchPostsMock).toHaveBeenCalledWith(authorizedRequestMock, 'テスト'))
  })

  it('見つかった投稿の本文を表示する', async () => {
    searchPostsMock.mockResolvedValue(listOf([myPost]))

    renderResults('テスト')

    expect(await screen.findByText('テストの書き方を調べた')).toBeInTheDocument()
  })

  it('結果が0件のときは見つからなかったことを伝える', async () => {
    searchPostsMock.mockResolvedValue(listOf([]))

    renderResults('存在しない言葉')

    expect(await screen.findByText('「存在しない言葉」を含む投稿は見つかりませんでした')).toBeInTheDocument()
  })
})

describe('PostSearchResults — 自分の投稿かどうか', () => {
  it('自分の投稿には編集ボタンを出す', async () => {
    searchPostsMock.mockResolvedValue(listOf([myPost]))

    renderResults('テスト')

    expect(await screen.findByRole('button', { name: '編集する' })).toBeInTheDocument()
  })

  it('他人の投稿には編集ボタンを出さない', async () => {
    // 出す側だけを確かめると、誰の投稿にも出す実装でも緑になる
    searchPostsMock.mockResolvedValue(listOf([otherPost]))

    renderResults('投稿')

    expect(await screen.findByText('他の人が書いた投稿')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '編集する' })).not.toBeInTheDocument()
  })
})

describe('PostSearchResults — 失敗したとき', () => {
  it('サーバーがエラーを返したときは、その内容を表示する', async () => {
    searchPostsMock.mockRejectedValue(new ApiError(400, '検索キーワードが不正です'))

    renderResults('テスト')

    expect(await screen.findByText('検索キーワードが不正です')).toBeInTheDocument()
  })

  it('通信そのものが失敗したときは、決まった文言を表示する', async () => {
    searchPostsMock.mockRejectedValue(new TypeError('Failed to fetch'))

    renderResults('テスト')

    expect(await screen.findByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })

  it('失敗したときは前の検索結果を残さない', async () => {
    searchPostsMock.mockResolvedValueOnce(listOf([myPost]))
    const { rerender } = renderResults('テスト')
    expect(await screen.findByText('テストの書き方を調べた')).toBeInTheDocument()

    searchPostsMock.mockRejectedValueOnce(new ApiError(500, 'サーバーエラーが発生しました'))
    rerender(
      <MemoryRouter>
        <PostSearchResults keyword="テストの" />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.queryByText('テストの書き方を調べた')).not.toBeInTheDocument())
  })
})

describe('PostSearchResults — 通信の追い越し', () => {
  it('通信中にキーワードが変わったら、古い結果で画面を上書きしない', async () => {
    // 先に投げた通信が後から返ってくる場面を再現する。
    // 古い結果を書き込むと、入力した文字と表示された結果がずれる
    let finishSlowSearch: (response: PostListResponse) => void = () => {}
    searchPostsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSlowSearch = resolve
        }),
    )
    searchPostsMock.mockResolvedValueOnce(listOf([myPost]))

    const { rerender } = renderResults('テ')
    rerender(
      <MemoryRouter>
        <PostSearchResults keyword="テス" />
      </MemoryRouter>,
    )
    expect(await screen.findByText('テストの書き方を調べた')).toBeInTheDocument()

    // ここで遅れていた「テ」の結果がようやく返ってくる
    finishSlowSearch(listOf([otherPost]))

    await waitFor(() => expect(screen.queryByText('他の人が書いた投稿')).not.toBeInTheDocument())
    expect(screen.getByText('テストの書き方を調べた')).toBeInTheDocument()
  })
})
