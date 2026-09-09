import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { Post } from '../types/post'
import { PostEditModal } from './PostEditModal'

/**
 * 投稿を書き直すためのダイアログ。
 *
 * 新規投稿（PostComposer）と同じ 280文字の上限を持つが、違いが2つある。
 * ・初期値が空ではなく「いま書いてある本文」
 * ・失敗しても閉じない（閉じると書き直した内容が消える）
 */
const basePost: Post = {
  id: 1,
  content: '編集前の本文',
  imageUrl: null,
  author: { id: 10, username: 'demo_user', displayName: 'デモ太郎', iconImageUrl: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  createdAt: '2026-06-15T12:00:00+09:00',
}

function renderModal(props: Partial<React.ComponentProps<typeof PostEditModal>> = {}) {
  const onCancel = props.onCancel ?? vi.fn()
  const onSave = props.onSave ?? vi.fn().mockResolvedValue(undefined)
  render(<PostEditModal post={basePost} {...props} onCancel={onCancel} onSave={onSave} />)
  return { onCancel, onSave }
}

/** 入力欄の中身をまるごと打ち直す（実際のキー入力を再現する） */
async function retype(text: string) {
  const textbox = screen.getByRole('textbox')
  await userEvent.clear(textbox)
  if (text !== '') {
    await userEvent.type(textbox, text)
  }
  return textbox
}

/**
 * 長い本文を一度に入れる。
 *
 * `userEvent.type` は1文字ずつ打つ動きを忠実に再現するため、280文字では
 * 制限時間（5秒）を超えて落ちることがある。しかも**同時に走る他のテストの負荷で
 * 結果が変わる**ため、たまに落ちるテスト（フレーキーテスト）になってしまう。
 *
 * ここで確かめたいのは「280文字のときどう見えるか」であって打鍵の再現ではないので、
 * 値の変更だけを一度に起こす `fireEvent` を使う。
 */
function setLongText(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
}

describe('PostEditModal — 最初の表示', () => {
  it('いま書いてある本文を初期値にする', () => {
    // 空から書き直させると、少し直したいだけの人が全部打ち直すことになる
    renderModal()

    expect(screen.getByRole('textbox')).toHaveValue('編集前の本文')
  })

  it('残り文字数を表示する', () => {
    renderModal()

    expect(screen.getByText(String(280 - basePost.content.length))).toBeInTheDocument()
  })

  it('最初は保存ボタンを押せる', () => {
    renderModal()

    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
  })
})

describe('PostEditModal — 本文の長さ', () => {
  it('本文が空のときは保存できない', async () => {
    renderModal()

    await retype('')

    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('空白だけのときは保存できない', async () => {
    // 見た目は文字があるが、中身は無いのと同じ
    renderModal()

    await retype('   ')

    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('1文字あれば保存できる', async () => {
    renderModal()

    await retype('あ')

    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
  })

  it('280文字ちょうどなら保存できる', async () => {
    renderModal()

    setLongText('a'.repeat(280))

    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
  })

  it('280文字ちょうどのとき残りは0と表示する', async () => {
    renderModal()

    setLongText('a'.repeat(280))

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('281文字になると保存できない', async () => {
    renderModal()

    setLongText('a'.repeat(281))

    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('超えた分はマイナスで表示する', async () => {
    // 「あと何文字消せばよいか」が分からないと直しようがない
    renderModal()

    setLongText('a'.repeat(281))

    expect(screen.getByText('-1')).toBeInTheDocument()
  })
})

describe('PostEditModal — 保存', () => {
  it('保存すると書き直した本文を親へ渡す', async () => {
    const { onSave } = renderModal()

    await retype('書き直した本文')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onSave).toHaveBeenCalledWith('書き直した本文')
  })

  it('保存中は「保存中…」と表示する', async () => {
    // 押したのに何も起きないように見えると、利用者は何度も押す
    const onSave = vi.fn(() => new Promise<void>(() => {}))
    renderModal({ onSave })

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByRole('button', { name: '保存中…' })).toBeInTheDocument()
  })

  it('保存中はキャンセルも押せない', async () => {
    // 途中で閉じられると、保存されたかどうか分からないまま画面が消える
    const onSave = vi.fn(() => new Promise<void>(() => {}))
    renderModal({ onSave })

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByRole('button', { name: 'キャンセル' })).toBeDisabled()
  })

  it('連打しても保存は1回しか呼ばれない', async () => {
    // 押すたびに送ると、同じ更新が何度も飛ぶ
    const onSave = vi.fn(() => new Promise<void>(() => {}))
    renderModal({ onSave })

    const saveButton = screen.getByRole('button', { name: '保存' })
    await userEvent.click(saveButton)
    await userEvent.click(saveButton)
    await userEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

describe('PostEditModal — 保存に失敗したとき', () => {
  it('サーバーが返したメッセージを表示する', async () => {
    const onSave = vi.fn().mockRejectedValue(new ApiError(400, '本文が長すぎます'))
    renderModal({ onSave })

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('本文が長すぎます')).toBeInTheDocument()
  })

  it('通信そのものが失敗したときは決まった文言を表示する', async () => {
    const onSave = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    renderModal({ onSave })

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })

  it('失敗しても書いた内容は消えない', async () => {
    // 消えると、書き直した内容ごと失われる
    const onSave = vi.fn().mockRejectedValue(new ApiError(500, 'サーバーエラーが発生しました'))
    renderModal({ onSave })

    await retype('書き直した本文')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('サーバーエラーが発生しました')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('書き直した本文')
  })

  it('失敗したあと、もう一度保存できる', async () => {
    // 一度の失敗で操作できなくなると、閉じるしか道がなくなる
    const onSave = vi.fn().mockRejectedValue(new ApiError(500, 'サーバーエラーが発生しました'))
    renderModal({ onSave })

    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('サーバーエラーが発生しました')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onSave).toHaveBeenCalledTimes(2)
  })
})

describe('PostEditModal — キャンセル', () => {
  it('キャンセルを押すと親へ知らせる', async () => {
    const { onCancel } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('キャンセルでは保存しない', async () => {
    const { onSave } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onSave).not.toHaveBeenCalled()
  })
})
