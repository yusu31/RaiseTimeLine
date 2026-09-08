import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { followUser, unfollowUser } from '../api/followApi'
import { FollowButton } from './FollowButton'

/**
 * このボタンだけは自分で通信する（他の3部品は props で受け取った関数を呼ぶだけ）。
 * そこで followApi をモジュールごと差し替え、「どちらのAPIを呼んだか」で判断を確かめる。
 *
 * このボタンの要は、フォローと解除で扱いが違うこと。
 * フォローはすぐ実行し、解除は取り消しにあたるので確認ダイアログを挟む。
 */
vi.mock('../api/followApi', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}))

// 通信は followApi のモックで止まるので、認証つき通信フックは中身を使わない
vi.mock('../hooks/useAuthorizedRequest', () => ({
  useAuthorizedRequest: () => vi.fn(),
}))

const followUserMock = vi.mocked(followUser)
const unfollowUserMock = vi.mocked(unfollowUser)

const followingStatus = { followedByMe: true, followerCount: 1, followingCount: 0 }
const notFollowingStatus = { followedByMe: false, followerCount: 0, followingCount: 0 }

/** テストごとに必要な props だけ上書きして描画する */
function renderButton(props: Partial<React.ComponentProps<typeof FollowButton>> = {}) {
  return render(
    <FollowButton
      username="user1"
      displayName="鈴木"
      followedByMe={false}
      onChanged={vi.fn()}
      onError={vi.fn()}
      {...props}
    />,
  )
}

beforeEach(() => {
  followUserMock.mockReset()
  unfollowUserMock.mockReset()
})

describe('FollowButton — 表示', () => {
  it('フォローしていないときは「フォローする」と表示する', () => {
    renderButton({ followedByMe: false })

    expect(screen.getByRole('button', { name: 'フォローする' })).toBeInTheDocument()
  })

  it('フォロー中のときは「フォロー中」と表示する', () => {
    renderButton({ followedByMe: true })

    expect(screen.getByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })

  it('フォロー中のときは「フォローする」を出さない', () => {
    renderButton({ followedByMe: true })

    expect(screen.queryByRole('button', { name: 'フォローする' })).not.toBeInTheDocument()
  })
})

describe('FollowButton — フォローする', () => {
  it('押すとすぐ followUser を呼ぶ（確認ダイアログを出さない）', async () => {
    const user = userEvent.setup()
    followUserMock.mockResolvedValue(followingStatus)
    renderButton({ followedByMe: false })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))

    expect(followUserMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('対象の @ユーザー名を渡す', async () => {
    const user = userEvent.setup()
    followUserMock.mockResolvedValue(followingStatus)
    renderButton({ followedByMe: false, username: 'demo_user' })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))

    expect(followUserMock).toHaveBeenCalledWith(expect.any(Function), 'demo_user')
  })

  it('成功したら新しい状態を親へ伝える', async () => {
    const user = userEvent.setup()
    followUserMock.mockResolvedValue(followingStatus)
    const onChanged = vi.fn()
    renderButton({ followedByMe: false, onChanged })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))

    expect(onChanged).toHaveBeenCalledWith(followingStatus)
  })

  it('失敗したらエラー文言を親へ伝え、状態は伝えない', async () => {
    const user = userEvent.setup()
    followUserMock.mockRejectedValue(new ApiError(404, 'ユーザーが見つかりません'))
    const onError = vi.fn()
    const onChanged = vi.fn()
    renderButton({ followedByMe: false, onError, onChanged })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))

    expect(onError).toHaveBeenCalledWith('ユーザーが見つかりません')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('通信そのものが失敗したときは既定の文言を伝える', async () => {
    const user = userEvent.setup()
    followUserMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const onError = vi.fn()
    renderButton({ followedByMe: false, onError })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))

    expect(onError).toHaveBeenCalledWith('通信中にエラーが発生しました')
  })
})

describe('FollowButton — フォローを解除する', () => {
  /**
   * 解除は取り消しにあたる操作なので、押しただけでは実行しない。
   * ここが「フォローする」との決定的な違い。
   */
  it('「フォロー中」を押しても、その場では解除しない', async () => {
    const user = userEvent.setup()
    renderButton({ followedByMe: true })

    await user.click(screen.getByRole('button', { name: 'フォロー中' }))

    expect(unfollowUserMock).not.toHaveBeenCalled()
  })

  it('「フォロー中」を押すと確認ダイアログを出す', async () => {
    const user = userEvent.setup()
    renderButton({ followedByMe: true, username: 'user1', displayName: '鈴木' })

    await user.click(screen.getByRole('button', { name: 'フォロー中' }))

    expect(screen.getByText('@user1 さんのフォローを解除しますか？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'フォロー解除' })).toBeInTheDocument()
  })

  it('確認ダイアログに相手の表示名を出す', async () => {
    const user = userEvent.setup()
    renderButton({ followedByMe: true, displayName: '鈴木' })

    await user.click(screen.getByRole('button', { name: 'フォロー中' }))

    expect(
      screen.getByText('鈴木 さんの投稿は「フォロー中」タブに表示されなくなります。'),
    ).toBeInTheDocument()
  })

  it('キャンセルするとダイアログが閉じ、解除しない', async () => {
    const user = userEvent.setup()
    renderButton({ followedByMe: true })

    await user.click(screen.getByRole('button', { name: 'フォロー中' }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(unfollowUserMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('確認すると unfollowUser を呼び、新しい状態を親へ伝える', async () => {
    const user = userEvent.setup()
    unfollowUserMock.mockResolvedValue(notFollowingStatus)
    const onChanged = vi.fn()
    renderButton({ followedByMe: true, username: 'user1', onChanged })

    await user.click(screen.getByRole('button', { name: 'フォロー中' }))
    await user.click(screen.getByRole('button', { name: 'フォロー解除' }))

    expect(unfollowUserMock).toHaveBeenCalledWith(expect.any(Function), 'user1')
    expect(onChanged).toHaveBeenCalledWith(notFollowingStatus)
  })

  /**
   * 解除の失敗は onError ではなくダイアログ側で表示する設計（実装のコメントに明記あり）。
   * ダイアログを開いたまま理由を見せて、その場で再試行できるようにするため。
   */
  it('解除に失敗したらダイアログにエラーを表示する', async () => {
    const user = userEvent.setup()
    unfollowUserMock.mockRejectedValue(new ApiError(500, 'サーバーエラー'))
    const onError = vi.fn()
    renderButton({ followedByMe: true, onError })

    await user.click(screen.getByRole('button', { name: 'フォロー中' }))
    await user.click(screen.getByRole('button', { name: 'フォロー解除' }))

    expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('FollowButton — 二重送信の防止', () => {
  it('フォローの通信中はボタンを押せない', async () => {
    const user = userEvent.setup()
    followUserMock.mockImplementation(() => new Promise(() => {}))
    renderButton({ followedByMe: false })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))

    expect(screen.getByRole('button', { name: 'フォロー中…' })).toBeDisabled()
  })

  it('フォローの通信中に連打しても followUser は1回しか呼ばれない', async () => {
    const user = userEvent.setup()
    followUserMock.mockImplementation(() => new Promise(() => {}))
    renderButton({ followedByMe: false })

    await user.click(screen.getByRole('button', { name: 'フォローする' }))
    await user.click(screen.getByRole('button', { name: 'フォロー中…' }))
    await user.click(screen.getByRole('button', { name: 'フォロー中…' }))

    expect(followUserMock).toHaveBeenCalledTimes(1)
  })
})
