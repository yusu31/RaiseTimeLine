import { render, screen } from '@testing-library/react'
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
