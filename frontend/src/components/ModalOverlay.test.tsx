import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModalOverlay } from './ModalOverlay'

/**
 * 投稿・編集・削除確認の画面が共通で使う「黒い幕と白い箱」。
 *
 * この部品は見た目そのものが役割なので、`role` と `aria-modal` を確かめる。
 * これが無いと、読み上げソフトは「画面の上に何かが開いた」ことを利用者に伝えられず、
 * 背後の内容を読み続けてしまう。
 *
 * なお `Esc` キーで閉じる処理はこの部品に実装されていない。
 * 存在しない機能はテストできないため、必要になったら機能追加として別Issueで扱う。
 */
function renderOverlay(maxWidthClassName?: string) {
  return render(
    <ModalOverlay maxWidthClassName={maxWidthClassName}>
      <p>ダイアログの中身</p>
    </ModalOverlay>,
  )
}

describe('ModalOverlay', () => {
  it('渡された中身をそのまま表示する', () => {
    renderOverlay()

    expect(screen.getByText('ダイアログの中身')).toBeInTheDocument()
  })

  it('ダイアログとして認識される', () => {
    renderOverlay()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('背後を操作できない種類のダイアログであることを伝える', () => {
    // aria-modal が無いと、読み上げソフトは背後の内容も読み続けてしまう
    renderOverlay()

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('幅を指定しないときは既定の幅を使う', () => {
    // 白い箱は「幕（dialog）の中の1枚目」という構造そのものが役割なので、そこを見る
    renderOverlay()

    expect(screen.getByRole('dialog').firstElementChild).toHaveClass('max-w-md')
  })

  it('幅を指定するとその幅を使う', () => {
    // 既定値だけを確かめると、常に既定値を使う実装でも緑になる
    renderOverlay('max-w-lg')

    expect(screen.getByRole('dialog').firstElementChild).toHaveClass('max-w-lg')
  })
})
