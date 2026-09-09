import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LikeButton } from './LikeButton'

describe('LikeButton', () => {
  it('いいね数を表示する', () => {
    render(<LikeButton likeCount={5} likedByMe={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('5')
  })

  it('クリックすると onToggle が1回だけ呼ばれる', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<LikeButton likeCount={0} likedByMe={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('いいね済みの状態でクリックしても onToggle が呼ばれる（取り消しができる）', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<LikeButton likeCount={1} likedByMe={true} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  /**
   * PostCard はカード全体をクリックすると投稿詳細へ遷移する。
   * いいねボタンのクリックが親へ伝わってしまうと、いいねを押しただけで
   * 画面が移動してしまう。伝播を止めていることをテストで固定する。
   */
  it('クリックが親要素へ伝播しない', async () => {
    const user = userEvent.setup()
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <LikeButton likeCount={0} likedByMe={false} onToggle={vi.fn()} />
      </div>,
    )

    await user.click(screen.getByRole('button'))

    expect(onParentClick).not.toHaveBeenCalled()
  })
})

/**
 * LikeButton は自分では通信しない。通信するのは onToggle の呼び出し元（各ページ）で、
 * LikeButton が「通信が終わったこと」を知る手段は onToggle が返す Promise だけになる。
 * ここでは終わらない Promise を返すことで「通信中」の状態を作る。
 * ケースの選び方は docs/testing-design.md 11-5（二重送信の防止）に揃えている。
 */
describe('LikeButton — 二重送信の防止', () => {
  it('通信中はボタンを押せない', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn(() => new Promise<void>(() => {}))
    render(<LikeButton likeCount={0} likedByMe={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('通信中に連打しても onToggle は1回しか呼ばれない', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn(() => new Promise<void>(() => {}))
    render(<LikeButton likeCount={0} likedByMe={false} onToggle={onToggle} />)

    const button = screen.getByRole('button')
    await user.click(button)
    await user.click(button)
    await user.click(button)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // 無効にする側だけを書くと、押した後ずっと無効のままの実装でも緑になってしまう。
  // 元に戻る側も対で固定する（成功したとき・失敗したときの両方）
  it('通信が成功すると、ボタンが再び押せるようになる', async () => {
    const user = userEvent.setup()
    let finishToggle: () => void = () => {}
    const onToggle = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishToggle = resolve
        }),
    )
    render(<LikeButton likeCount={0} likedByMe={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()

    finishToggle()

    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
  })

  it('通信が失敗しても、ボタンが再び押せるようになる', async () => {
    const user = userEvent.setup()
    let failToggle: (reason: Error) => void = () => {}
    const onToggle = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          failToggle = reject
        }),
    )
    render(<LikeButton likeCount={0} likedByMe={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()

    failToggle(new Error('通信に失敗しました'))

    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
  })
})
