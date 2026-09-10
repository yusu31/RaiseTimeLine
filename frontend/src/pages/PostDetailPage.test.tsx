import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { fetchComments } from '../api/commentApi'
import { likePost } from '../api/likeApi'
import { fetchPost } from '../api/postApi'
import type { AuthContextValue } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import type { Post } from '../types/post'
import { PostDetailPage } from './PostDetailPage'

/**
 * 投稿詳細画面のうち「いいねの通信が失敗したとき」の見せ方だけを対象にする（Issue #77）。
 * コメントの投稿・削除はこのIssueの範囲外なので、表示に必要な最低限だけを用意する。
 */
vi.mock('../api/postApi', () => ({
  fetchPost: vi.fn(),
}))

vi.mock('../api/commentApi', () => ({
  fetchComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
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

const fetchPostMock = vi.mocked(fetchPost)
const fetchCommentsMock = vi.mocked(fetchComments)
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

/**
 * この画面は URL の :id から表示する投稿を決めるため、
 * MemoryRouter に「いま /posts/1 を開いている」状態を作ってから描画する。
 */
function renderPostDetail() {
  return render(
    <MemoryRouter initialEntries={['/posts/1']}>
      <Routes>
        <Route path="/posts/:id" element={<PostDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 投稿が表示されるのを待ってから、いいねボタン（いいね数3）を押す */
async function clickLikeButton(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /3/ }))
}

beforeEach(() => {
  fetchPostMock.mockReset()
  likePostMock.mockReset()
  fetchPostMock.mockResolvedValue(notLikedPost)
  fetchCommentsMock.mockResolvedValue([])
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

describe('PostDetailPage — いいねに成功したとき', () => {
  it('いいね数が最新の値に更新される', async () => {
    const user = userEvent.setup()
    likePostMock.mockResolvedValue({ likeCount: 4, likedByMe: true })

    renderPostDetail()
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

    renderPostDetail()
    await clickLikeButton(user)
    // 通信が終わったことをいいね数の更新で確かめてから判定する。
    // 待たずに判定すると「まだ何も起きていないだけ」で緑になり、何も検証していないテストになる
    await screen.findByRole('button', { name: /4/ })

    expect(screen.queryByText('通信中にエラーが発生しました')).not.toBeInTheDocument()
  })
})

describe('PostDetailPage — いいねに失敗したとき', () => {
  it('サーバーが返したエラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    likePostMock.mockRejectedValue(new ApiError(404, '投稿が見つかりません'))

    renderPostDetail()
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

    renderPostDetail()
    await clickLikeButton(user)

    expect(await screen.findByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })
})
