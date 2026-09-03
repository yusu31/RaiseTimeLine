import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Post } from '../types/post'
import { PostCard } from './PostCard'

// テストごとに必要な部分だけ差し替えられるよう、土台の投稿データを用意する
const basePost: Post = {
  id: 1,
  content: '今日はテストを書いた',
  imageUrl: null,
  author: {
    id: 10,
    username: 'demo_user',
    displayName: 'デモユーザー',
    iconImageUrl: null,
  },
  likeCount: 3,
  commentCount: 2,
  likedByMe: false,
  createdAt: '2026-06-15T12:00:00+09:00',
}

/**
 * PostCard は内部で Link と useNavigate を使うため、
 * ルーターの中でしか描画できない。MemoryRouter は画面遷移を
 * メモリ上だけで再現する、テスト用のルーターである。
 */
function renderPostCard(overrides: Partial<Post> = {}, isOwn = false) {
  const post = { ...basePost, ...overrides }
  render(
    <MemoryRouter>
      <PostCard
        post={post}
        isOwn={isOwn}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
        onToggleLike={vi.fn()}
      />
    </MemoryRouter>,
  )
  return post
}

describe('PostCard', () => {
  it('投稿本文を表示する', () => {
    renderPostCard()
    expect(screen.getByText('今日はテストを書いた')).toBeInTheDocument()
  })

  it('投稿者の表示名とユーザー名を表示する', () => {
    renderPostCard()
    expect(screen.getByText('デモユーザー')).toBeInTheDocument()
    expect(screen.getByText('@demo_user')).toBeInTheDocument()
  })

  it('いいね数とコメント数を表示する', () => {
    renderPostCard({ likeCount: 3, commentCount: 2 })
    expect(screen.getByRole('button', { name: /3/ })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('投稿者名をクリックするとプロフィールへ遷移するリンクになっている', () => {
    renderPostCard()
    const links = screen.getAllByRole('link')
    expect(links.every((link) => link.getAttribute('href') === '/users/demo_user')).toBe(true)
  })

  describe('画像', () => {
    it('imageUrl があるときは投稿画像を表示する', () => {
      renderPostCard({ imageUrl: '/uploads/sample.jpg' })
      const image = screen.getByAltText('投稿画像')
      expect(image).toHaveAttribute('src', '/uploads/sample.jpg')
    })

    it('imageUrl が null のときは画像を表示しない', () => {
      renderPostCard({ imageUrl: null })
      expect(screen.queryByAltText('投稿画像')).not.toBeInTheDocument()
    })
  })

  describe('編集・削除ボタンの出し分け', () => {
    it('自分の投稿には編集と削除のボタンを表示する', () => {
      renderPostCard({}, true)
      expect(screen.getByRole('button', { name: '編集する' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '削除する' })).toBeInTheDocument()
    })

    it('他人の投稿には編集と削除のボタンを表示しない', () => {
      renderPostCard({}, false)
      expect(screen.queryByRole('button', { name: '編集する' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '削除する' })).not.toBeInTheDocument()
    })
  })
})
