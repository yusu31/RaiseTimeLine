/**
 * ISO形式の日時文字列を「2026/03/10 02:02」の形式に整形する。
 * 月・日・時・分は2桁になるようゼロ埋めし、桁数が揃って読みやすい表示にする。
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const pad = (value: number) => String(value).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1) // getMonth() は 0 始まりなので +1 する
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}/${month}/${day} ${hours}:${minutes}`
}

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR

/**
 * 一覧向けの相対時刻。「たった今 / 3分前 / 2時間前 / 8月25日 / 2025年8月25日」を返す。
 *
 * 一覧では「正確にいつか」より「どれくらい新しいか」が知りたい情報なので、
 * 24時間以内は経過時間で、それ以降は日付で表す（Xと同じ考え方）。
 *
 * Intl.RelativeTimeFormat を使わないのは、日本語ロケールだと "2 時間前" と
 * 半角スペースが入り表示として不自然なため。
 *
 * 表示した時点の値を返すだけで、時間の経過に合わせて自動更新はしない。
 * タイムラインは無限スクロールで大量のカードを持つため、全件の定期再描画は割に合わない。
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const elapsedSeconds = Math.floor((Date.now() - date.getTime()) / 1000)

  // 端末の時計が少しずれていると未来の日時になりうるため、マイナスは「たった今」に寄せる
  if (elapsedSeconds < SECONDS_PER_MINUTE) {
    return 'たった今'
  }
  if (elapsedSeconds < SECONDS_PER_HOUR) {
    return `${Math.floor(elapsedSeconds / SECONDS_PER_MINUTE)}分前`
  }
  if (elapsedSeconds < SECONDS_PER_DAY) {
    return `${Math.floor(elapsedSeconds / SECONDS_PER_HOUR)}時間前`
  }

  const month = date.getMonth() + 1
  const day = date.getDate()
  // 今年の投稿は年を省く。「8月25日」のほうが読みやすく、年が変わった投稿とも区別できる
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${month}月${day}日`
  }
  return `${date.getFullYear()}年${month}月${day}日`
}
