import type { Page } from '@playwright/test'

export type WebVitals = {
  /** First Contentful Paint（ms）: 最初に何か描画されるまでの時間 */
  fcp: number
  /** Largest Contentful Paint（ms）: 最も大きい要素が描画されるまでの時間 */
  lcp: number
  /** Cumulative Layout Shift: 読み込み中の予期しないレイアウトずれの累積スコア */
  cls: number
  /** DOM Content Loaded（ms）: HTMLの解析・DOMツリー構築が完了するまでの時間 */
  domContentLoaded: number
}

/**
 * ブラウザ標準のPerformance API（PerformanceObserver / Navigation Timing）を直接読む。
 * 追加ライブラリ（web-vitals等）を使わないのは、依存を増やさず計測原理を追いやすくするため。
 * LCP/CLSは「ページが安定するまで」値が更新され続けるため、1秒待ってから確定させる。
 */
export async function collectWebVitals(page: Page): Promise<WebVitals> {
  return page.evaluate(
    () =>
      new Promise<WebVitals>((resolve) => {
        const result: Partial<WebVitals> = { lcp: 0, cls: 0 }

        new PerformanceObserver((list) => {
          const entry = list.getEntriesByName('first-contentful-paint')[0]
          if (entry) result.fcp = entry.startTime
        }).observe({ type: 'paint', buffered: true })

        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const last = entries[entries.length - 1]
          if (last) result.lcp = last.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })

        let cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            hadRecentInput: boolean
            value: number
          })[]) {
            if (!entry.hadRecentInput) cls += entry.value
          }
          result.cls = cls
        }).observe({ type: 'layout-shift', buffered: true })

        const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
        result.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime

        setTimeout(() => resolve(result as WebVitals), 1000)
      }),
  )
}
