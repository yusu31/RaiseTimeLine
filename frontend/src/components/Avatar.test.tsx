import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

/**
 * アイコンは「隣に名前が書いてある」ことが前提の飾りなので、
 * 画像にも頭文字にも aria-hidden="true" を付け、読み上げの対象から外してある。
 * そのため getByRole では取得できない。
 * 画像の有無を確かめるところだけ container から直接探しているのはこのためで、
 * 「読み上げさせない」こと自体が仕様である。
 */
describe('Avatar — 画像がある場合', () => {
  it('渡された画像URLを表示する', () => {
    const { container } = render(<Avatar displayName="鈴木" iconImageUrl="/uploads/icon.png" />)

    expect(container.querySelector('img')).toHaveAttribute('src', '/uploads/icon.png')
  })

  it('画像があるときは頭文字を表示しない', () => {
    render(<Avatar displayName="鈴木" iconImageUrl="/uploads/icon.png" />)

    expect(screen.queryByText('鈴')).not.toBeInTheDocument()
  })
})

describe('Avatar — 画像がない場合', () => {
  it('iconImageUrl を渡さないときは表示名の頭文字を表示する', () => {
    render(<Avatar displayName="鈴木" />)

    expect(screen.getByText('鈴')).toBeInTheDocument()
  })

  it('iconImageUrl が null のときも頭文字を表示する', () => {
    // サーバーは「アイコン未設定」を null で返すため、undefined と両方を確かめる
    render(<Avatar displayName="鈴木" iconImageUrl={null} />)

    expect(screen.getByText('鈴')).toBeInTheDocument()
  })

  it('iconImageUrl が空文字のときも頭文字を表示する', () => {
    // 空文字をそのまま src に入れると「壊れた画像」のアイコンが出てしまう
    render(<Avatar displayName="鈴木" iconImageUrl="" />)

    expect(screen.getByText('鈴')).toBeInTheDocument()
  })

  it('画像がないときは img 要素を描画しない', () => {
    const { container } = render(<Avatar displayName="鈴木" />)

    expect(container.querySelector('img')).toBeNull()
  })
})

describe('Avatar — 頭文字の決め方', () => {
  it('表示名の前後にある空白は無視して先頭の文字を使う', () => {
    render(<Avatar displayName="  鈴木  " />)

    expect(screen.getByText('鈴')).toBeInTheDocument()
  })

  it('絵文字で始まる表示名でも文字が壊れない', () => {
    // 絵文字は内部的に2つの値の組で表される（サロゲートペア）。
    // 単純に1文字目を取り出すと壊れた文字になるため、Array.from で1文字ずつに分解している
    render(<Avatar displayName="🍣寿司太郎" />)

    expect(screen.getByText('🍣')).toBeInTheDocument()
  })

  it('表示名が空文字のときは「?」を表示する', () => {
    render(<Avatar displayName="" />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('表示名が空白だけのときも「?」を表示する', () => {
    // 空白を取り除くと空文字になる。「文字がある / 無い」の境目にあたる
    render(<Avatar displayName="   " />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
