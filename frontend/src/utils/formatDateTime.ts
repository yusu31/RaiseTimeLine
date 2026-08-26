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
