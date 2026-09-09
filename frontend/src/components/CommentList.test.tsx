import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Comment } from '../types/comment'
import { CommentList } from './CommentList'

/**
 * 投稿詳細に並ぶコメントの一覧。
 *
 * 判断は2つ。
 * ・0件のときは空のリストではなく案内文を出す（何も無い画面は「壊れている」ように見える）
 * ・**自分のコメントにだけ削除ボタンを出す**（他人のものを消せてはいけない）
 *
 * なお削除ボタンの見た目はゴミ箱の絵だけなので、`aria-label` で何のボタンか伝えている。
 * それが無いと、読み上げソフトでは「ボタン」としか分からない。
 */
const MY_ID = 10

const myComment: Comment = {
  id: 1,
  postId: 100,
  content: '自分が書いたコメント',
  author: { id: MY_ID, username: 'demo_user', displayName: 'デモ太郎', iconImageUrl: null },
  createdAt: '2026-06-15T12:00:00+09:00',
}

const otherComment: Comment = {
  id: 2,
  postId: 100,
  content: '他の人が書いたコメント',
  author: { id: 99, username: 'user1', displayName: '鈴木', iconImageUrl: null },
  createdAt: '2026-06-15T12:00:00+09:00',
}

/**
 * 閲覧者を省略記法（デフォルト引数）で受け取らないのは、
 * JavaScript では `renderList(x, undefined)` と書いてもデフォルト値が適用されてしまい、
 * 「閲覧者が分からない状態」を作れないため。実際にこれで1件のテストが偽の緑になりかけた。
 */
function renderList(comments: Comment[], currentUserId: number | undefined) {
  const onDeleteRequest = vi.fn()
  render(
    <MemoryRouter>
      <CommentList comments={comments} currentUserId={currentUserId} onDeleteRequest={onDeleteRequest} />
    </MemoryRouter>,
  )
  return { onDeleteRequest }
}

describe('CommentList — 件数', () => {
  it('0件のときは案内文を出す', () => {
    renderList([], MY_ID)

    expect(screen.getByText('まだコメントがありません。')).toBeInTheDocument()
  })

  it('1件以上あるときは案内文を出さない', () => {
    renderList([myComment], MY_ID)

    expect(screen.queryByText('まだコメントがありません。')).not.toBeInTheDocument()
  })

  it('コメントの本文を表示する', () => {
    renderList([myComment], MY_ID)

    expect(screen.getByText('自分が書いたコメント')).toBeInTheDocument()
  })

  it('複数のコメントをすべて表示する', () => {
    renderList([myComment, otherComment], MY_ID)

    expect(screen.getByText('自分が書いたコメント')).toBeInTheDocument()
    expect(screen.getByText('他の人が書いたコメント')).toBeInTheDocument()
  })

  it('投稿者のプロフィールへのリンクを出す', () => {
    renderList([otherComment], MY_ID)

    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/users/user1')
  })
})

describe('CommentList — 削除ボタンの出し分け', () => {
  it('自分のコメントには削除ボタンを出す', () => {
    renderList([myComment], MY_ID)

    expect(screen.getByRole('button', { name: 'コメントを削除する' })).toBeInTheDocument()
  })

  it('他人のコメントには削除ボタンを出さない', () => {
    // 出す側だけを確かめると、誰のコメントにも出す実装でも緑になる
    renderList([otherComment], MY_ID)

    expect(screen.queryByRole('button', { name: 'コメントを削除する' })).not.toBeInTheDocument()
  })

  it('閲覧者が分からないときは、どのコメントにも削除ボタンを出さない', () => {
    // currentUserId が undefined のとき、author.id と一致してはいけない
    renderList([myComment, otherComment], undefined)

    expect(screen.queryByRole('button', { name: 'コメントを削除する' })).not.toBeInTheDocument()
  })

  it('複数あるときは自分のコメントの分だけ削除ボタンを出す', () => {
    renderList([myComment, otherComment], MY_ID)

    expect(screen.getAllByRole('button', { name: 'コメントを削除する' })).toHaveLength(1)
  })
})

describe('CommentList — 削除の依頼', () => {
  it('削除ボタンを押すと、そのコメントのIDを親へ渡す', async () => {
    // 消すのは親の仕事。この部品は「どれを消したいか」を伝えるところまで
    const { onDeleteRequest } = renderList([myComment], MY_ID)

    await userEvent.click(screen.getByRole('button', { name: 'コメントを削除する' }))

    expect(onDeleteRequest).toHaveBeenCalledWith(myComment.id)
  })
})
