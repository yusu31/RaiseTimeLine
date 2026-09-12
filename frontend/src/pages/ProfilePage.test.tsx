import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { likePost } from '../api/likeApi'
import { fetchProfile, fetchUserPosts } from '../api/userApi'
import type { AuthContextValue } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import type { Post, PostListResponse } from '../types/post'
import type { UserProfile } from '../types/user'
import { ProfilePage } from './ProfilePage'

/**
 * プロフィール画面のうち「一度出したエラーが、次の操作が成功したときに消えるか」だけを対象にする
 * （Issue #85）。
 *
 * この画面はプロフィール表示・投稿一覧・フォロー・いいね・編集・削除・無限スクロールを持つが、
 * **画面を網羅的にテストする方針ではない。**
 * 画面にしか無いバグを、その部分だけ絞って確かめる（PR #78 で決めた方針）。
 *
 * 投稿カード（PostCard）といいねボタン（LikeButton）は単体テスト済みのため本物を使い、
 * ここでは「エラーの消し忘れが無いか」の確認に集中する。
 */
vi.mock('../api/userApi', () => ({
  fetchProfile: vi.fn(),
  fetchUserPosts: vi.fn(),
}))

vi.mock('../api/postApi', () => ({
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
 * jsdom にはこの仕組みが無いため偽物を置く。
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

const fetchProfileMock = vi.mocked(fetchProfile)
const fetchUserPostsMock = vi.mocked(fetchUserPosts)
const likePostMock = vi.mocked(likePost)
const useAuthMock = vi.mocked(useAuth)

const LOGIN_USER_ID = 10

/** 表示するプロフィール。閲覧者とは別人にして、フォローボタンが出る状態にする */
const profile: UserProfile = {
  id: 99,
  username: 'user1',
  displayName: '鈴木',
  bio: null,
  iconImageUrl: null,
  createdAt: '2026-01-01T00:00:00+09:00',
  followingCount: 0,
  followerCount: 0,
  followedByMe: false,
}

/** まだいいねしていない投稿。いいね数はボタンを特定する目印にもなる */
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

/** 2ページ目として返す投稿。一覧に増えたことで「通信が終わった」と判定できる */
const secondPagePost: Post = { ...notLikedPost, id: 2, content: '2ページ目の投稿', likeCount: 0 }

function listOf(posts: Post[], hasNext = false): PostListResponse {
  return { posts, page: 0, hasNext }
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/users/user1']}>
      <Routes>
        <Route path="/users/:username" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 一覧が表示されるのを待ってから、いいねボタン（いいね数3）を押す */
async function clickLikeButton(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /3/ }))
}

/**
 * リスト末尾が画面に入った状況を作る。
 *
 * **監視が始まるのを待ってから呼ぶ。** 一覧が表示された直後はまだ
 * 「次のページがある」状態が反映されておらず、監視が始まっていないことがある。
 * 待たずに呼ぶと、たまに落ちるテスト（フレーキーテスト）になる（実際に発生した）。
 *
 * いつまでも始まらない場合は黙って素通りせず失敗させる。
 * 素通りすると「エラーが消えたこと」を確かめたつもりで何も検証していないテストになる。
 */
async function scrollToBottom() {
  await waitFor(() => expect(triggerScrollToBottom).not.toBeNull())
  triggerScrollToBottom?.()
}

beforeEach(() => {
  fetchProfileMock.mockReset()
  fetchUserPostsMock.mockReset()
  likePostMock.mockReset()
  triggerScrollToBottom = null
  fetchProfileMock.mockResolvedValue(profile)
  fetchUserPostsMock.mockResolvedValue(listOf([notLikedPost]))
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

describe('ProfilePage — いいねに失敗したとき', () => {
  it('サーバーが返したエラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    likePostMock.mockRejectedValue(new ApiError(404, '投稿が見つかりません'))

    renderProfile()
    await clickLikeButton(user)

    expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
  })
})

/**
 * 一度出したエラーを、次の操作が成功したときに消せているか（Issue #85）。
 * 判定の前に「何かが起きたこと」を待つ。待たずに queryByText を見ると、
 * エラーが消えたのではなく「まだ次の通信が終わっていないだけ」で緑になる（PR #78 の教訓）。
 */
describe('ProfilePage — 失敗したあとに操作をやり直したとき', () => {
  it('いいねをやり直して成功すると、前のエラーメッセージが消える', async () => {
    const user = userEvent.setup()
    likePostMock
      .mockRejectedValueOnce(new ApiError(404, '投稿が見つかりません'))
      .mockResolvedValueOnce({ likeCount: 4, likedByMe: true })

    renderProfile()
    await clickLikeButton(user)
    await screen.findByText('投稿が見つかりません')

    // 失敗しているのでいいね数は3のまま。同じボタンをもう一度押せる
    await clickLikeButton(user)
    await screen.findByRole('button', { name: /4/ })

    expect(screen.queryByText('投稿が見つかりません')).not.toBeInTheDocument()
  })

  it('次のページの読み込みをやり直して成功すると、前のエラーメッセージが消える', async () => {
    fetchUserPostsMock.mockReset()
    fetchUserPostsMock.mockResolvedValueOnce(listOf([notLikedPost], true))
    fetchUserPostsMock.mockRejectedValueOnce(new ApiError(500, '投稿の取得に失敗しました'))
    fetchUserPostsMock.mockResolvedValueOnce(listOf([secondPagePost]))

    renderProfile()
    await screen.findByText('テストの書き方を調べた')

    await scrollToBottom()
    await screen.findByText('投稿の取得に失敗しました')

    await scrollToBottom()
    // 2回目の通信が終わったことを、2ページ目が一覧に増えたことで確かめる
    await screen.findByText('2ページ目の投稿')

    expect(screen.queryByText('投稿の取得に失敗しました')).not.toBeInTheDocument()
  })
})
