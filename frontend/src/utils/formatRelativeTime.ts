export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)

  if (diffMinutes < 1) return 'たった今'
  if (diffMinutes < 60) return `${diffMinutes}分前`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}時間前`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}日前`

  return date.toLocaleDateString('ja-JP')
}
