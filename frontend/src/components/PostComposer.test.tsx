import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { PostComposer } from './PostComposer'

/**
 * 投稿の入力フォーム。実装が持つ上限は本文280文字・画像5MB・JPEG/PNGのみ。
 * バグは値の真ん中ではなく境目に出るので、上限ちょうどとその外側を必ず対で確かめる。
 *
 * 画像を選ぶとプレビュー用に URL.createObjectURL を呼ぶが、jsdom には実装が無い。
 * 実際の画像表示はブラウザの仕事なので、ここでは差し替えて先へ進める。
 */
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test-preview')
  URL.revokeObjectURL = vi.fn()
})

const textarea = () => screen.getByPlaceholderText('いまどうしてる？')
const submitButton = () => screen.getByRole('button', { name: '投稿する' })
const fileInput = () => screen.getByLabelText('📷 画像を選択')

/** 指定したバイト数・種類のダミー画像を作る（中身は問わない） */
function makeFile(name: string, type: string, size: number) {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('PostComposer — 本文の長さ（境界値）', () => {
  it('何も入力していないと投稿ボタンを押せない', () => {
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    expect(submitButton()).toBeDisabled()
  })

  it('空白だけでは投稿ボタンを押せない', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.type(textarea(), '   ')

    expect(submitButton()).toBeDisabled()
  })

  it('1文字あれば投稿ボタンを押せる（下限ちょうど）', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.type(textarea(), 'あ')

    expect(submitButton()).toBeEnabled()
  })

  it('280文字ちょうどなら投稿ボタンを押せる（上限ちょうど）', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.click(textarea())
    await user.paste('あ'.repeat(280))

    expect(submitButton()).toBeEnabled()
  })

  it('281文字になると投稿ボタンを押せない（上限の外）', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.click(textarea())
    await user.paste('あ'.repeat(281))

    expect(submitButton()).toBeDisabled()
  })
})

describe('PostComposer — 残り文字数の表示', () => {
  it('入力前は上限の280を表示する', () => {
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('280')).toBeInTheDocument()
  })

  it('入力した分だけ残りが減る', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.type(textarea(), 'あいうえお')

    expect(screen.getByText('275')).toBeInTheDocument()
  })

  it('280文字ちょうどで残りが0になる', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.click(textarea())
    await user.paste('あ'.repeat(280))

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  /** 超えた分をマイナスで示す。ここで止まると「あと何文字消せばよいか」が分からなくなる */
  it('上限を超えるとマイナスで表示する', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.click(textarea())
    await user.paste('あ'.repeat(285))

    expect(screen.getByText('-5')).toBeInTheDocument()
  })
})

describe('PostComposer — 画像の選択', () => {
  it('PNGを選ぶとプレビューが表示される', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.upload(fileInput(), makeFile('photo.png', 'image/png', 1000))

    expect(screen.getByAltText('選択した画像のプレビュー')).toBeInTheDocument()
  })

  it('JPEGも選べる', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.upload(fileInput(), makeFile('photo.jpg', 'image/jpeg', 1000))

    expect(screen.getByAltText('選択した画像のプレビュー')).toBeInTheDocument()
  })

  /**
   * 許可していない形式は、その場で弾いてサーバーへ送らない。
   * エラーが出ることだけでなく、プレビューが出ない（＝選択されていない）ことまで確かめる。
   *
   * ここだけ userEvent ではなく fireEvent を使う。
   * input には accept="image/jpeg,image/png" が付いており、userEvent は実際のブラウザと同じく
   * それに従って GIF を渡してくれない。すると検証したいコード（形式チェック）まで到達しない。
   * accept はブラウザ任せの一次防衛にすぎず、ここで確かめたいのは
   * それをすり抜けたときに働く二重の守りのほうなので、change イベントを直接起こす。
   */
  it('GIFを選ぶとエラーを表示し、画像を受け付けない', () => {
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(fileInput(), { target: { files: [makeFile('animation.gif', 'image/gif', 1000)] } })

    expect(screen.getByText('画像はJPEGまたはPNG形式のみアップロードできます')).toBeInTheDocument()
    expect(screen.queryByAltText('選択した画像のプレビュー')).not.toBeInTheDocument()
  })

  it('5MBちょうどの画像は受け付ける（上限ちょうど）', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.upload(fileInput(), makeFile('photo.png', 'image/png', 5 * 1024 * 1024))

    expect(screen.getByAltText('選択した画像のプレビュー')).toBeInTheDocument()
  })

  it('5MBを1バイト超えるとエラーを表示し、画像を受け付けない（上限の外）', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.upload(fileInput(), makeFile('photo.png', 'image/png', 5 * 1024 * 1024 + 1))

    expect(screen.getByText('画像は5MB以内のファイルをアップロードしてください')).toBeInTheDocument()
    expect(screen.queryByAltText('選択した画像のプレビュー')).not.toBeInTheDocument()
  })

  it('画像を削除するとプレビューが消える', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.upload(fileInput(), makeFile('photo.png', 'image/png', 1000))
    await user.click(screen.getByRole('button', { name: '画像を削除' }))

    expect(screen.queryByAltText('選択した画像のプレビュー')).not.toBeInTheDocument()
  })

  /**
   * 一度選んだあと、選択ダイアログを開いて「キャンセル」した場合。
   * ブラウザは空のファイル一覧で change を起こすので、選択済みの画像を取り消す必要がある。
   * 取り消さないと、画面から消したつもりの画像がそのまま投稿される。
   */
  it('ファイル選択をキャンセルすると、選んでいた画像が取り消される', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn()} onClose={vi.fn()} />)

    await user.upload(fileInput(), makeFile('photo.png', 'image/png', 1000))
    expect(screen.getByAltText('選択した画像のプレビュー')).toBeInTheDocument()

    fireEvent.change(fileInput(), { target: { files: [] } })

    expect(screen.queryByAltText('選択した画像のプレビュー')).not.toBeInTheDocument()
  })
})

describe('PostComposer — 送信', () => {
  it('本文と画像なしで onSubmit を呼ぶ', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(onSubmit).toHaveBeenCalledWith('こんにちは', null)
  })

  it('画像を選んでいれば一緒に渡す', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const image = makeFile('photo.png', 'image/png', 1000)
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.upload(fileInput(), image)
    await user.click(submitButton())

    expect(onSubmit).toHaveBeenCalledWith('こんにちは', image)
  })

  it('送信に成功すると画面を閉じる', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<PostComposer onSubmit={vi.fn().mockResolvedValue(undefined)} onClose={onClose} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * 投稿ボタンの `disabled` は一次防衛にすぎない。
   * フォームは Enter キーなどボタン以外の経路でも送信されうるので、
   * 送信処理の入口でも中身を確かめている。その二重の守りが働くことを固定する。
   */
  it('本文が空のままフォームが送信されても onSubmit を呼ばない', () => {
    const onSubmit = vi.fn()
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    fireEvent.submit(textarea().closest('form') as HTMLFormElement)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('閉じるボタンを押すと onClose を呼び、投稿はしない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<PostComposer onSubmit={onSubmit} onClose={onClose} />)

    await user.type(textarea(), '書きかけの本文')
    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('PostComposer — 送信に失敗した場合', () => {
  it('サーバーのエラー文言を表示する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, '本文は280文字以内で入力してください'))
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(screen.getByText('本文は280文字以内で入力してください')).toBeInTheDocument()
  })

  it('通信そのものが失敗したときは既定の文言を表示する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(screen.getByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })

  /** 失敗したのに閉じてしまうと、書いた本文ごと消える */
  it('送信に失敗したら画面を閉じない', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<PostComposer onSubmit={vi.fn().mockRejectedValue(new ApiError(500, 'エラー'))} onClose={onClose} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(onClose).not.toHaveBeenCalled()
  })

  it('送信に失敗しても本文を消さない', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn().mockRejectedValue(new ApiError(500, 'エラー'))} onClose={vi.fn()} />)

    await user.type(textarea(), '消えたら困る本文')
    await user.click(submitButton())

    expect(textarea()).toHaveValue('消えたら困る本文')
  })

  it('失敗のあと、もう一度送信できる', async () => {
    const user = userEvent.setup()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'エラー'))
      .mockResolvedValueOnce(undefined)
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())
    await user.click(submitButton())

    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})

describe('PostComposer — 二重送信の防止', () => {
  it('送信中は投稿ボタンを押せず、文言が「投稿中…」に変わる', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn(() => new Promise<void>(() => {}))} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(screen.getByRole('button', { name: '投稿中…' })).toBeDisabled()
  })

  it('送信中は閉じるボタンも押せない', async () => {
    const user = userEvent.setup()
    render(<PostComposer onSubmit={vi.fn(() => new Promise<void>(() => {}))} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())

    expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled()
  })

  it('送信中に連打しても onSubmit は1回しか呼ばれない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => new Promise<void>(() => {}))
    render(<PostComposer onSubmit={onSubmit} onClose={vi.fn()} />)

    await user.type(textarea(), 'こんにちは')
    await user.click(submitButton())
    await user.click(screen.getByRole('button', { name: '投稿中…' }))
    await user.click(screen.getByRole('button', { name: '投稿中…' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
