import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDateTime, formatRelativeTime } from './formatDateTime'

// 相対時刻は「今」を基準に計算するため、実行するたびに結果が変わってしまう。
// テスト中は時計を止めて、この瞬間を「今」として扱う。
const NOW = new Date('2026-06-15T12:00:00+09:00')

/** NOW から指定秒数だけ過去のISO文字列を返す。マイナスを渡すと未来になる */
function isoSecondsAgo(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString()
}

describe('formatDateTime', () => {
  it('ISO形式の日時を「YYYY/MM/DD HH:mm」に整形する', () => {
    expect(formatDateTime('2026-03-10T02:02:00+09:00')).toBe('2026/03/10 02:02')
  })

  it('月・日・時・分が1桁のときはゼロ埋めして桁を揃える', () => {
    expect(formatDateTime('2026-01-05T09:07:00+09:00')).toBe('2026/01/05 09:07')
  })

  it('2桁の値はそのまま表示する', () => {
    expect(formatDateTime('2026-12-31T23:59:00+09:00')).toBe('2026/12/31 23:59')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    // 止めた時計を必ず戻す。戻し忘れると後続のテストにも影響する
    vi.useRealTimers()
  })

  describe('1分未満', () => {
    it('0秒前は「たった今」を返す', () => {
      expect(formatRelativeTime(isoSecondsAgo(0))).toBe('たった今')
    })

    it('59秒前は「たった今」を返す', () => {
      expect(formatRelativeTime(isoSecondsAgo(59))).toBe('たった今')
    })

    it('端末の時計がずれて未来の日時になっても「たった今」を返す', () => {
      expect(formatRelativeTime(isoSecondsAgo(-60))).toBe('たった今')
    })
  })

  describe('1分以上24時間未満', () => {
    it('ちょうど60秒前は「1分前」に切り替わる', () => {
      expect(formatRelativeTime(isoSecondsAgo(60))).toBe('1分前')
    })

    it('59分59秒前は「59分前」を返す', () => {
      expect(formatRelativeTime(isoSecondsAgo(3599))).toBe('59分前')
    })

    it('ちょうど1時間前は「1時間前」に切り替わる', () => {
      expect(formatRelativeTime(isoSecondsAgo(3600))).toBe('1時間前')
    })

    it('23時間59分59秒前は「23時間前」を返す', () => {
      expect(formatRelativeTime(isoSecondsAgo(86399))).toBe('23時間前')
    })
  })

  describe('24時間以上', () => {
    it('ちょうど24時間前は日付表示に切り替わる', () => {
      expect(formatRelativeTime(isoSecondsAgo(86400))).toBe('6月14日')
    })

    it('今年の日付は年を省略する', () => {
      expect(formatRelativeTime('2026-02-03T10:00:00+09:00')).toBe('2月3日')
    })

    it('去年以前の日付は年を付けて区別できるようにする', () => {
      expect(formatRelativeTime('2025-08-25T10:00:00+09:00')).toBe('2025年8月25日')
    })
  })

  // 【CI検証用・次のコミットで削除する】
  // CIがテストの失敗を検知して赤くなることを確認するための、意図的に失敗するテスト
  it('【CI検証用】必ず失敗する', () => {
    expect(1).toBe(2)
  })
})
