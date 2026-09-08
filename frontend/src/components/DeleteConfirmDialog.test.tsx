import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

/**
 * 取り消せない操作の直前に挟む確認ダイアログ。
 * 投稿削除・コメント削除・フォロー解除で使い回しているため、
 * 「文言を差し替えられること」と「実行が失敗したときに操作をやり直せること」が要になる。
 */

const confirmButton = (name = '削除する') => screen.getByRole('button', { name })
const cancelButton = () => screen.getByRole('button', { name: 'キャンセル' })

describe('DeleteConfirmDialog — 表示', () => {
  it('渡された確認文を表示する', () => {
    render(<DeleteConfirmDialog message="この投稿を削除しますか？" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('この投稿を削除しますか？')).toBeInTheDocument()
  })

  it('補足説明を渡すと表示する', () => {
    render(
      <DeleteConfirmDialog
        message="この投稿を削除しますか？"
        description="削除した投稿は元に戻せません。"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('削除した投稿は元に戻せません。')).toBeInTheDocument()
  })

  /** 補足は任意。渡さないときに空の行が出ないことを固定する */
  it('補足説明を渡さないときは何も表示しない', () => {
    render(<DeleteConfirmDialog message="この投稿を削除しますか？" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByText('削除した投稿は元に戻せません。')).not.toBeInTheDocument()
  })

  it('実行ボタンの文言は既定で「削除する」', () => {
    render(<DeleteConfirmDialog message="確認" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(confirmButton()).toBeInTheDocument()
  })

  /**
   * フォロー解除でも同じダイアログを使う。
   * 文言を差し替えられなくなると「フォローを解除しますか？」に「削除する」ボタンが並ぶ。
   */
  it('実行ボタンの文言を差し替えられる', () => {
    render(
      <DeleteConfirmDialog
        message="フォローを解除しますか？"
        confirmLabel="フォロー解除"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(confirmButton('フォロー解除')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '削除する' })).not.toBeInTheDocument()
  })
})

describe('DeleteConfirmDialog — 操作', () => {
  it('実行ボタンを押すと onConfirm を呼ぶ', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  /** 取り消したのに実行されては困る。「呼ばれないこと」まで確かめる */
  it('キャンセルを押すと onCancel を呼び、onConfirm は呼ばない', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(cancelButton())

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('閉じるボタンを押すと onCancel を呼び、onConfirm は呼ばない', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('DeleteConfirmDialog — 実行中', () => {
  /** 削除の二重実行は「すでに消えたものをもう一度消す」エラーになる */
  it('実行中はすべてのボタンを押せなくする', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(() => new Promise<void>(() => {}))
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())

    expect(screen.getByRole('button', { name: '削除中…' })).toBeDisabled()
    expect(cancelButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled()
  })

  it('実行中はボタンの文言が「削除中…」に変わる', async () => {
    const user = userEvent.setup()
    render(<DeleteConfirmDialog message="確認" onConfirm={vi.fn(() => new Promise<void>(() => {}))} onCancel={vi.fn()} />)

    await user.click(confirmButton())

    expect(screen.getByRole('button', { name: '削除中…' })).toBeInTheDocument()
  })

  it('実行中の文言も差し替えられる', async () => {
    const user = userEvent.setup()
    render(
      <DeleteConfirmDialog
        message="確認"
        confirmLabel="フォロー解除"
        confirmingLabel="解除中…"
        onConfirm={vi.fn(() => new Promise<void>(() => {}))}
        onCancel={vi.fn()}
      />,
    )

    await user.click(confirmButton('フォロー解除'))

    expect(screen.getByRole('button', { name: '解除中…' })).toBeInTheDocument()
  })

  it('実行中に連打しても onConfirm は1回しか呼ばれない', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(() => new Promise<void>(() => {}))
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())
    await user.click(screen.getByRole('button', { name: '削除中…' }))
    await user.click(screen.getByRole('button', { name: '削除中…' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('DeleteConfirmDialog — 実行に失敗した場合', () => {
  it('サーバーのエラー文言を表示する', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new ApiError(403, '他のユーザーの投稿は削除できません'))
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())

    expect(screen.getByText('他のユーザーの投稿は削除できません')).toBeInTheDocument()
  })

  it('通信そのものが失敗したときは既定の文言を表示する', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())

    expect(screen.getByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })

  /**
   * 失敗したまま押せない状態が続くと、ダイアログを閉じることも再試行することもできなくなる。
   * 失敗時にだけ操作可能な状態へ戻していることを固定する。
   */
  it('実行に失敗したらボタンを再び押せる状態に戻す', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new ApiError(500, 'サーバーエラー'))
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())

    expect(confirmButton()).toBeEnabled()
    expect(cancelButton()).toBeEnabled()
  })

  it('失敗のあと、もう一度実行できる', async () => {
    const user = userEvent.setup()
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'サーバーエラー'))
      .mockResolvedValueOnce(undefined)
    render(<DeleteConfirmDialog message="確認" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(confirmButton())
    await user.click(confirmButton())

    expect(onConfirm).toHaveBeenCalledTimes(2)
  })
})
