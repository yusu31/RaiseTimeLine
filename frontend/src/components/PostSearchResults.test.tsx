import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { likePost } from '../api/likeApi'
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

vi.mock('../api/likeApi', () => ({
  likePost: vi.fn(),
  unlikePost: vi.fn(),
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
 *
 * さらに、渡された関数を覚えておくことで「リスト末尾が画面に入った」状況を
 * テストから作れるようにする（jsdom ではスクロールが起きないため）。
 */
let triggerScrollToBottom: (() => void) | null = null
class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    triggerScrollToBottom = () => callback([{ isIntersecting: true }] as never, this as never)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

const searchPostsMock = vi.mocked(searchPosts)
const likePostMock = vi.mocked(likePost)
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

/** いいね数3。ボタンを名前で特定するための目印も兼ねる */
const likeablePost: Post = { ...otherPost, id: 3, content: 'いいねできる投稿', likeCount: 3 }

/** 2ページ目として返す投稿。一覧に増えたことで「通信が終わった」と判定できる */
const secondPagePost: Post = { ...otherPost, id: 4, content: '2ページ目の投稿' }

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

/**
 * リスト末尾が画面に入った状況を作る。
 *
 * **監視が始まるのを待ってから呼ぶ。** 検索結果が表示された直後はまだ
 * 「次のページがある」状態が反映されておらず、監視が始まっていないことがある。
 * 待たずに呼ぶと、たまに落ちるテスト（フレーキーテスト）になる（実際に発生した）。
 *
 * いつまでも始まらない場合は黙って素通りせず失敗させる。
 */
async function scrollToBottom() {
  await waitFor(() => expect(triggerScrollToBottom).not.toBeNull())
  triggerScrollToBottom?.()
}

beforeEach(() => {
  searchPostsMock.mockReset()
  likePostMock.mockReset()
  triggerScrollToBottom = null
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

/**
 * 一度出したエラーを、次の操作が成功したときに消せているか（Issue #85）。
 *
 * 消していないと、通信が回復して操作が成功しても前のエラーが残り続け、
 * 利用者からは成功したのか失敗したのか判断できない。
 * 判定の前に「何かが起きたこと」を待つ（PR #78 の教訓）。
 */
describe('PostSearchResults — 失敗したあとに操作をやり直したとき', () => {
  it('いいねをやり直して成功すると、前のエラーメッセージが消える', async () => {
    const user = userEvent.setup()
    searchPostsMock.mockResolvedValue(listOf([likeablePost]))
    likePostMock
      .mockRejectedValueOnce(new ApiError(404, '投稿が見つかりません'))
      .mockResolvedValueOnce({ likeCount: 4, likedByMe: true })

    renderResults('いいね')
    await user.click(await screen.findByRole('button', { name: /3/ }))
    await screen.findByText('投稿が見つかりません')

    // 失敗しているのでいいね数は3のまま。同じボタンをもう一度押せる
    await user.click(await screen.findByRole('button', { name: /3/ }))
    await screen.findByRole('button', { name: /4/ })

    expect(screen.queryByText('投稿が見つかりません')).not.toBeInTheDocument()
  })

  it('次のページの読み込みをやり直して成功すると、前のエラーメッセージが消える', async () => {
    searchPostsMock.mockResolvedValueOnce({ posts: [otherPost], page: 0, hasNext: true })
    searchPostsMock.mockRejectedValueOnce(new ApiError(500, '検索に失敗しました'))
    searchPostsMock.mockResolvedValueOnce({ posts: [secondPagePost], page: 1, hasNext: false })

    renderResults('投稿')
    await screen.findByText('他の人が書いた投稿')

    await scrollToBottom()
    await screen.findByText('検索に失敗しました')

    await scrollToBottom()
    // 2回目の通信が終わったことを、2ページ目が一覧に増えたことで確かめる
    await screen.findByText('2ページ目の投稿')

    expect(screen.queryByText('検索に失敗しました')).not.toBeInTheDocument()
  })
})
