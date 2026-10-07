import { expect, test } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectWebVitals } from '../utils/webVitals'
import { SearchPage } from '../pages/search.page'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.resolve(__dirname, '..', 'results', 'performance')

function writeResult(name: string, data: unknown) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  fs.writeFileSync(path.join(RESULTS_DIR, `${name}.json`), JSON.stringify(data, null, 2))
}

// しきい値の根拠・調整履歴は docs/e2e-testing.md を参照
test.describe('ページ読み込みパフォーマンス', () => {
  test('タイムライン画面', async ({ page }) => {
    await page.goto('/timeline')
    const vitals = await collectWebVitals(page)
    writeResult('timeline', vitals)

    expect(vitals.fcp).toBeLessThan(2000)
    expect(vitals.lcp).toBeLessThan(3000)
    expect(vitals.cls).toBeLessThan(0.1)
    expect(vitals.domContentLoaded).toBeLessThan(3000)
  })

  test('投稿詳細画面', async ({ page }) => {
    const searchPage = new SearchPage(page)
    await searchPage.goto()
    await searchPage.search('raisetech')
    await searchPage.postResultByContent('raisetech').click()
    await expect(page).toHaveURL(/\/posts\/\d+$/)

    // ここまでの操作はウォームアップとして扱い、計測は対象URLへの直接遷移で行う
    await page.goto(page.url())
    const vitals = await collectWebVitals(page)
    writeResult('post-detail', vitals)

    // LCPは対象外（しきい値表の対象ページに含まれない。計画段階で主要2画面に絞った）
    expect(vitals.fcp).toBeLessThan(2000)
    expect(vitals.cls).toBeLessThan(0.1)
    expect(vitals.domContentLoaded).toBeLessThan(3000)
  })

  test('プロフィール画面', async ({ page }) => {
    await page.goto('/users/e2euser_alice')
    const vitals = await collectWebVitals(page)
    writeResult('profile', vitals)

    expect(vitals.fcp).toBeLessThan(2000)
    expect(vitals.lcp).toBeLessThan(3000)
    expect(vitals.cls).toBeLessThan(0.1)
    expect(vitals.domContentLoaded).toBeLessThan(3000)
  })
})
