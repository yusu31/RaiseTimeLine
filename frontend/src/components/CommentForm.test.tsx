import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { CommentForm } from './CommentForm'

/**
 * このフォームは通信を自分では行わず、送信処理を props で受け取る。
 * だから `vi.fn()` を渡すだけでテストでき、fetch のモックは要らない。
 */

/** 入力欄と送信ボタンは毎回同じ手がかりで取る（人が画面で探すのと同じやり方） */
const input = () => screen.getByPlaceholderText('コメントを入力…')
const submitButton = () => screen.getByRole('button', { name: 'コメントを送信' })

describe('CommentForm — 送信できる場合', () => {
  it('入力した内容で onSubmit を呼ぶ', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), 'いい投稿ですね')
    await user.click(submitButton())

    expect(onSubmit).toHaveBeenCalledWith('いい投稿ですね')
  })

  it('送信に成功すると入力欄が空になる', async () => {
    const user = userEvent.setup()
    render(<CommentForm onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    await user.type(input(), 'いい投稿ですね')
    await user.click(submitButton())

    expect(input()).toHaveValue('')
  })
})

describe('CommentForm — 送信できない場合', () => {
  /**
   * 空のまま送ると、中身のないコメントが並んでしまう。
   * 「エラーが出ること」だけでなく「送信処理そのものが呼ばれないこと」まで確かめる。
   */
  it('空のまま送信すると onSubmit を呼ばず、エラーを表示する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CommentForm onSubmit={onSubmit} />)

    await user.click(submitButton())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('コメントを入力してください')).toBeInTheDocument()
  })

  it('空白だけを入力して送信しても onSubmit を呼ばない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), '   ')
    await user.click(submitButton())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('コメントを入力してください')).toBeInTheDocument()
  })
})

describe('CommentForm — 送信に失敗した場合', () => {
  it('サーバーのエラー文言を表示する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, 'コメントは200文字以内で入力してください'))
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), 'あ')
    await user.click(submitButton())

    expect(screen.getByText('コメントは200文字以内で入力してください')).toBeInTheDocument()
  })

  it('通信そのものが失敗したときは既定の文言を表示する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), 'あ')
    await user.click(submitButton())

    expect(screen.getByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })

  /**
   * 失敗したのに入力が消えると、書いた文章を一から打ち直すことになる。
   * 「成功したら消す・失敗したら残す」の後半を固定する。
   */
  it('送信に失敗しても入力した内容を消さない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(500, 'サーバーエラー'))
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), '消えたら困る文章')
    await user.click(submitButton())

    expect(input()).toHaveValue('消えたら困る文章')
  })

  it('一度エラーを出したあと、送信し直すとエラー表示が消える', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CommentForm onSubmit={onSubmit} />)

    await user.click(submitButton())
    expect(screen.getByText('コメントを入力してください')).toBeInTheDocument()

    await user.type(input(), 'やり直し')
    await user.click(submitButton())

    expect(screen.queryByText('コメントを入力してください')).not.toBeInTheDocument()
  })
})

describe('CommentForm — 二重送信の防止', () => {
  /**
   * 通信が終わる前にもう一度押せると、同じコメントが2件登録される。
   * 送信中はボタンを押せなくして防いでいる。
   */
  it('送信中は送信ボタンを押せない', async () => {
    const user = userEvent.setup()
    // 送信処理を解決しないままにして「通信中」の状態で止める
    const onSubmit = vi.fn(() => new Promise<void>(() => {}))
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), '送信中の確認')
    await user.click(submitButton())

    expect(submitButton()).toBeDisabled()
  })

  it('送信中にもう一度クリックしても onSubmit は1回しか呼ばれない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => new Promise<void>(() => {}))
    render(<CommentForm onSubmit={onSubmit} />)

    await user.type(input(), '連打の確認')
    await user.click(submitButton())
    await user.click(submitButton())
    await user.click(submitButton())

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
