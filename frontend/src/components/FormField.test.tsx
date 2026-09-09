import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from './FormField'

/**
 * ログイン・登録画面で使う入力欄1つ分。
 *
 * この部品の要は2つある。
 * ・ラベルと入力欄が紐づいていること（ラベルを押しても入力欄に移れる。読み上げでも項目名が分かる）
 * ・onChange が「入力イベント」ではなく「入力された値」を渡すこと（呼ぶ側が event.target を知らずに済む）
 */
function renderField(props: Partial<React.ComponentProps<typeof FormField>> = {}) {
  render(
    <FormField
      id="email"
      label="メールアドレス"
      type="email"
      autoComplete="email"
      value=""
      onChange={vi.fn()}
      {...props}
    />,
  )
}

describe('FormField — 表示', () => {
  it('ラベルの文字から入力欄をたどれる', () => {
    renderField()

    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
  })

  it('渡された値を入力欄に表示する', () => {
    renderField({ value: 'demo@example.com' })

    expect(screen.getByLabelText('メールアドレス')).toHaveValue('demo@example.com')
  })

  it('渡された type を入力欄に反映する', () => {
    // password のとき伏せ字にならないと、画面を見られただけで漏れる
    renderField({ id: 'password', label: 'パスワード', type: 'password', autoComplete: 'current-password' })

    expect(screen.getByLabelText('パスワード')).toHaveAttribute('type', 'password')
  })

  it('渡された autoComplete を入力欄に反映する', () => {
    // ブラウザの自動入力がどの項目かを判断する手がかりになる
    renderField()

    expect(screen.getByLabelText('メールアドレス')).toHaveAttribute('autocomplete', 'email')
  })
})

describe('FormField — 入力', () => {
  it('文字を入力すると onChange がその値で呼ばれる', async () => {
    const onChange = vi.fn()
    renderField({ onChange })

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'a')

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('すでに値があるときは、その値に足した文字列で onChange が呼ばれる', async () => {
    const onChange = vi.fn()
    renderField({ value: 'ab', onChange })

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'c')

    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('onChange にはイベントではなく文字列だけを渡す', async () => {
    // 呼ぶ側が event.target.value を書かずに済ませるための約束。
    // ここが崩れると、使っている画面すべてが同時に壊れる
    const onChange = vi.fn()
    renderField({ onChange })

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'a')

    expect(typeof onChange.mock.calls[0][0]).toBe('string')
  })
})

describe('FormField — エラー表示', () => {
  it('error を渡すとメッセージを表示する', () => {
    renderField({ error: 'メールアドレスの形式が正しくありません' })

    expect(screen.getByText('メールアドレスの形式が正しくありません')).toBeInTheDocument()
  })

  it('error を渡さないときはメッセージを表示しない', () => {
    // 「出る」だけを確かめると、常に出す実装でも緑になってしまう
    renderField()

    expect(screen.queryByText('メールアドレスの形式が正しくありません')).not.toBeInTheDocument()
  })

  it('error が空文字のときはメッセージ用の要素を作らない', () => {
    // 空文字でも要素だけ描かれると、余白がずれて見た目が崩れる
    const { container } = render(
      <FormField
        id="email"
        label="メールアドレス"
        type="email"
        autoComplete="email"
        value=""
        onChange={vi.fn()}
        error=""
      />,
    )

    expect(container.querySelector('p')).toBeNull()
  })
})
