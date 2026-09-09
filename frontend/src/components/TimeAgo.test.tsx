import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeAgo } from './TimeAgo'

/**
 * 「2時間前」を何秒から何秒までとするかの境目は formatDateTime.test.ts で
 * すでに全部確かめてある（0 / 59 / 60 / 3599 / 3600 / 86399 / 86400 秒）。
 * TimeAgo 自身は計算をせず、その結果を <time> 要素の3か所に載せるだけなので、
 * ここでは「正しい置き場所に載っているか」だけを確かめる。
 * 同じ境目を2か所に書くと、片方だけ直したときに食い違いが起きる。
 *
 * 3か所とは、目に見える本文・機械が読む dateTime 属性・マウスを乗せると出る title 属性。
 * 画面の「2時間前」だけでは、読み上げソフトや検索エンジンには何日の投稿か分からない。
 */
const NOW = new Date('2026-06-15T12:00:00+09:00')
const TWO_HOURS_AGO = '2026-06-15T10:00:00+09:00'

describe('TimeAgo', () => {
  beforeEach(() => {
    // 相対時刻は「今」を基準に計算するため、時計を止めないと結果が毎回変わる
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('本文には相対時刻を表示する', () => {
    render(<TimeAgo isoString={TWO_HOURS_AGO} />)

    expect(screen.getByText('2時間前')).toBeInTheDocument()
  })

  it('dateTime 属性には渡された日時をそのまま入れる', () => {
    render(<TimeAgo isoString={TWO_HOURS_AGO} />)

    expect(screen.getByText('2時間前')).toHaveAttribute('datetime', TWO_HOURS_AGO)
  })

  it('title 属性には正確な日時を入れる', () => {
    render(<TimeAgo isoString={TWO_HOURS_AGO} />)

    expect(screen.getByText('2時間前')).toHaveAttribute('title', '2026/06/15 10:00')
  })

  it('24時間以上前で日付表示に変わっても、本文にその日付を表示する', () => {
    render(<TimeAgo isoString="2026-06-13T10:00:00+09:00" />)

    expect(screen.getByText('6月13日')).toBeInTheDocument()
  })

  it('24時間以上前でも dateTime 属性には元の日時を入れる', () => {
    // 本文が「6月13日」に変わっても、機械が読む値は時刻まで残っている必要がある
    render(<TimeAgo isoString="2026-06-13T10:00:00+09:00" />)

    expect(screen.getByText('6月13日')).toHaveAttribute('datetime', '2026-06-13T10:00:00+09:00')
  })

  it('渡された className をそのまま付ける', () => {
    // 置き場所ごとに文字の大きさや色を変えるため、呼ぶ側が見た目を指定できる必要がある
    render(<TimeAgo isoString={TWO_HOURS_AGO} className="text-sm text-gray-500" />)

    expect(screen.getByText('2時間前')).toHaveClass('text-sm', 'text-gray-500')
  })
})
