import { useEffect, useRef } from 'react'

/**
 * リスト末尾のセンチネル要素が画面内に入ったら onLoadMore を呼ぶ。
 * 戻り値の ref を、リストの一番下に置いた空の要素に付けて使う。
 *
 * @param hasNext まだ次のページがあるか。false のときは監視しない
 * @param onLoadMore 次ページを読み込む処理。useCallback で包んだものを渡すこと
 */
export function useInfiniteScroll(hasNext: boolean, onLoadMore: () => void) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasNext) return undefined
    const node = sentinelRef.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      // 画面に入りきる200px手前で先読みし、スクロールが止まって見えないようにする
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNext, onLoadMore])

  return sentinelRef
}
