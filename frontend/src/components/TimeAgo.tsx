import { formatDateTime, formatRelativeTime } from '../utils/formatDateTime'

type TimeAgoProps = {
  /** ISO形式の日時文字列 */
  isoString: string
  className?: string
}

/**
 * 一覧向けの日時表示。「2時間前」のような相対時刻を出し、
 * マウスを乗せる（title属性）と正確な日時が見えるようにする。
 *
 * <time> 要素を使うのは、機械（スクリーンリーダーや検索エンジン）が
 * dateTime属性から正確な日時を読み取れるようにするため。
 * 画面上の「2時間前」という表記だけでは、いつの投稿か機械には分からない。
 */
export function TimeAgo({ isoString, className }: TimeAgoProps) {
  return (
    <time dateTime={isoString} title={formatDateTime(isoString)} className={className}>
      {formatRelativeTime(isoString)}
    </time>
  )
}
