import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NewPostsBanner } from './NewPostsBanner'

/**
 * タイムラインの上に出る「新着があります」の帯。
 *
 * 確かめたいのは2つ。
 * ・件数が多いときに「99+」へ丸まること（3桁になると帯が広がって見た目が崩れるため）
 * ・読み込み中は押せないこと（連打すると同じ読み込みが何度も走る）
 */
function renderBanner(props: Partial<React.ComponentProps<typeof NewPostsBanner>> = {}) {
  const onClick = props.onClick ?? vi.fn()
  render(<NewPostsBanner count={1} isLoading={false} {...props} onClick={onClick} />)
  return { onClick }
}

describe('NewPostsBanner — 件数の表示', () => {
  it('1件のときはそのまま件数を表示する', () => {
    renderBanner({ count: 1 })

    expect(screen.getByRole('button', { name: '↑ 1件の新着を表示' })).toBeInTheDocument()
  })

  it('99件のときはそのまま件数を表示する', () => {
    // 丸めが始まる一歩手前。ここが「99+」になってはいけない
    renderBanner({ count: 99 })

    expect(screen.getByRole('button', { name: '↑ 99件の新着を表示' })).toBeInTheDocument()
  })

  it('100件のときは「99+」に丸めて表示する', () => {
    // 丸めが始まる最初の値
    renderBanner({ count: 100 })

    expect(screen.getByRole('button', { name: '↑ 99+件の新着を表示' })).toBeInTheDocument()
  })

  it('0件でも表示が壊れない', () => {
    // 呼ぶ側は0件のとき帯そのものを出さない作りだが、
    // 部品としては受け取っても壊れないことを確かめておく
    renderBanner({ count: 0 })

    expect(screen.getByRole('button', { name: '↑ 0件の新着を表示' })).toBeInTheDocument()
  })
})

describe('NewPostsBanner — 読み込み中', () => {
  it('読み込み中は「読み込み中…」と表示する', () => {
    renderBanner({ isLoading: true })

    expect(screen.getByRole('button', { name: '読み込み中…' })).toBeInTheDocument()
  })

  it('読み込み中は件数を表示しない', () => {
    // 表示が入れ替わることを、消える側からも確かめる
    renderBanner({ count: 5, isLoading: true })

    expect(screen.queryByText('↑ 5件の新着を表示')).not.toBeInTheDocument()
  })

  it('読み込み中はボタンを押せない状態にする', () => {
    renderBanner({ isLoading: true })

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('読み込み中でないときはボタンを押せる状態にする', () => {
    // 「押せない」だけを確かめると、いつでも押せない実装でも緑になる
    renderBanner({ isLoading: false })

    expect(screen.getByRole('button')).toBeEnabled()
  })
})

describe('NewPostsBanner — クリック', () => {
  it('押すと onClick が呼ばれる', async () => {
    const { onClick } = renderBanner()

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('読み込み中に押しても onClick は呼ばれない', async () => {
    const { onClick } = renderBanner({ isLoading: true })

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).not.toHaveBeenCalled()
  })
})
