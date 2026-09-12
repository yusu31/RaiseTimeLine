import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { likePost } from '../api/likeApi'
import { fetchNewPosts, fetchNewPostsCount, fetchTimeline } from '../api/postApi'
import type { AuthContextValue } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import type { Post, PostListResponse } from '../types/post'
import { TimelinePage } from './TimelinePage'

/**
 * タイムライン画面のうち「いいねの通信が失敗したとき」の見せ方だけを対象にする。
 *
 * この画面はいいね以外にも投稿・編集・削除・無限スクロール・新着ポーリングを持つが、
 * Issue #77 はいいねの失敗が画面に出ないことなので、そこに絞る。
 * 投稿カード（PostCard）といいねボタン（LikeButton）は単体テスト済みのため本物を使い、
 * ここでは「通信の失敗を画面まで届けられているか」の確認に集中する。
 */
vi.mock('../api/postApi', () => ({
  fetchTimeline: vi.fn(),
  fetchNewPosts: vi.fn(),
  fetchNewPostsCount: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
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
 */
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

const fetchTimelineMock = vi.mocked(fetchTimeline)
const fetchNewPostsCountMock = vi.mocked(fetchNewPostsCount)
const fetchNewPostsMock = vi.mocked(fetchNewPosts)
const likePostMock = vi.mocked(likePost)
const useAuthMock = vi.mocked(useAuth)

const LOGIN_USER_ID = 10

/** まだいいねしていない、他人の投稿。いいね数はボタンを特定する目印にもなる */
const notLikedPost: Post = {
  id: 1,
  content: 'テストの書き方を調べた',
  imageUrl: null,
  author: { id: 99, username: 'user1', displayName: '鈴木', iconImageUrl: null },
  likeCount: 3,
  commentCount: 0,
  likedByMe: false,
  createdAt: '2026-06-15T12:00:00+09:00',
}

/** 新着として後から届く投稿。一覧に増えたことで「通信が終わった」と判定できる */
const newerPost: Post = {
  id: 2,
  content: 'あとから届いた投稿',
  imageUrl: null,
  author: { id: 98, username: 'user2', displayName: '佐藤', iconImageUrl: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  createdAt: '2026-06-15T13:00:00+09:00',
}

function listOf(posts: Post[]): PostListResponse {
  return { posts, page: 0, hasNext: false }
}

function renderTimeline() {
  return render(
    <MemoryRouter>
      <TimelinePage />
    </MemoryRouter>,
  )
}

/** 一覧が表示されるのを待ってから、いいねボタン（いいね数3）を押す */
async function clickLikeButton(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /3/ }))
}

beforeEach(() => {
  fetchTimelineMock.mockReset()
  likePostMock.mockReset()
  fetchNewPostsMock.mockReset()
  fetchNewPostsCountMock.mockReset()
  fetchTimelineMock.mockResolvedValue(listOf([notLikedPost]))
  // 新着チェックは30秒ごとのポーリングで、テスト中に発火することはない。
  // それでも呼ばれたときに落ちないよう、件数0を返しておく
  fetchNewPostsCountMock.mockResolvedValue({ count: 0 })
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

describe('TimelinePage — いいねに成功したとき', () => {
  it('いいね数が最新の値に更新される', async () => {
    const user = userEvent.setup()
    likePostMock.mockResolvedValue({ likeCount: 4, likedByMe: true })

    renderTimeline()
    await clickLikeButton(user)

    expect(await screen.findByRole('button', { name: /4/ })).toBeInTheDocument()
  })

  /**
   * 失敗したときだけを調べると、「いつでもエラーを出しっぱなしの実装」でも緑になってしまう。
   * 成功したときに出ないことを対で固定して、初めてエラー表示の意味が保証される。
   */
  it('エラーメッセージを表示しない', async () => {
    const user = userEvent.setup()
    likePostMock.mockResolvedValue({ likeCount: 4, likedByMe: true })

    renderTimeline()
    await clickLikeButton(user)
    // 通信が終わったことをいいね数の更新で確かめてから判定する。
    // 待たずに判定すると「まだ何も起きていないだけ」で緑になり、何も検証していないテストになる
    await screen.findByRole('button', { name: /4/ })

    expect(screen.queryByText('通信中にエラーが発生しました')).not.toBeInTheDocument()
  })
})

describe('TimelinePage — いいねに失敗したとき', () => {
  it('サーバーが返したエラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    likePostMock.mockRejectedValue(new ApiError(404, '投稿が見つかりません'))

    renderTimeline()
    await clickLikeButton(user)

    expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
  })

  /**
   * 通信そのものが届かなかった場合（オフラインなど）は ApiError にならない。
   * 画面に何も出さないと、押しても反応しなかったようにしか見えないため既定の文言を出す。
   */
  it('サーバーに届かなかったときは既定のエラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    likePostMock.mockRejectedValue(new Error('Failed to fetch'))

    renderTimeline()
    await clickLikeButton(user)

    expect(await screen.findByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })
})

/**
 * 一度出したエラーを、次の操作が成功したときに消せているか（Issue #85）。
 *
 * 消していないと、通信が回復して操作が成功しても「通信中にエラーが発生しました」が
 * 残り続け、利用者からは成功したのか失敗したのか判断できない。
 *
 * **判定の前に「何かが起きたこと」を待つ。** クリック直後に queryByText を見ると、
 * エラーが消えたのではなく「まだ次の通信が終わっていないだけ」で緑になる（PR #78 の教訓）。
 */
describe('TimelinePage — 失敗したあとに操作をやり直したとき', () => {
  it('いいねをやり直して成功すると、前のエラーメッセージが消える', async () => {
    const user = userEvent.setup()
    likePostMock
      .mockRejectedValueOnce(new ApiError(404, '投稿が見つかりません'))
      .mockResolvedValueOnce({ likeCount: 4, likedByMe: true })

    renderTimeline()
    await clickLikeButton(user)
    // 1回目の失敗が画面に出たことを確かめてから、2回目に進む
    await screen.findByText('投稿が見つかりません')

    // 失敗しているのでいいね数は3のまま。同じボタンをもう一度押せる
    await clickLikeButton(user)
    // 2回目の通信が終わったことを、いいね数の更新で確かめる
    await screen.findByRole('button', { name: /4/ })

    expect(screen.queryByText('投稿が見つかりません')).not.toBeInTheDocument()
  })

  it('新着の読み込みをやり直して成功すると、前のエラーメッセージが消える', async () => {
    const user = userEvent.setup()
    // 新着バナーを出す。タブに戻ったときの即時チェックを利用する（30秒待たない）
    fetchNewPostsCountMock.mockResolvedValue({ count: 2 })
    fetchNewPostsMock
      .mockRejectedValueOnce(new ApiError(500, '新着の取得に失敗しました'))
      .mockResolvedValueOnce({ posts: [newerPost], hasMore: false })

    renderTimeline()
    await screen.findByRole('button', { name: /3/ })
    document.dispatchEvent(new Event('visibilitychange'))

    const banner = await screen.findByRole('button', { name: /2件の新着を表示/ })
    await user.click(banner)
    await screen.findByText('新着の取得に失敗しました')

    await user.click(await screen.findByRole('button', { name: /件の新着を表示/ }))
    // 2回目の通信が終わったことを、新着の投稿が一覧に増えたことで確かめる
    await screen.findByText('あとから届いた投稿')

    expect(screen.queryByText('新着の取得に失敗しました')).not.toBeInTheDocument()
  })
})
