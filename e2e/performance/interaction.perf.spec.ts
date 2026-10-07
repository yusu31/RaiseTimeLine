import { expect, test } from '@playwright/test'
import { TimelinePage } from '../pages/timeline.page'
import { SearchPage } from '../pages/search.page'

// しきい値の根拠・調整履歴は docs/e2e-testing.md を参照
test.describe('操作レスポンスパフォーマンス', () => {
  test('投稿送信からタイムライン反映までが1秒未満', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const content = `E2Eパフォーマンス投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.composeButton.click()
    await timelinePage.postComposerTextarea.fill(content)

    const start = Date.now()
    await timelinePage.postComposerSubmitButton.click()
    await expect(timelinePage.postCardByContent(content)).toBeVisible()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(1000)
  })

  test('いいねクリックからUI反映までが300ms未満', async ({ page }) => {
    const searchPage = new SearchPage(page)
    await searchPage.goto()
    await searchPage.search('raisetech')
    await searchPage.postResultByContent('raisetech').click()

    const likeButton = page.locator('.like-button')
    const before = await likeButton.innerText()

    const start = Date.now()
    await likeButton.click()
    await expect(likeButton).not.toHaveText(before)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(300)

    // 後片付け: 他のテストに影響しないよう取り消しておく
    await likeButton.click()
  })

  test('無限スクロールで追加投稿が表示されるまでが2秒未満', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    await timelinePage.goto()
    await expect(page.locator('article')).toHaveCount(20)

    const start = Date.now()
    await page.locator('article').last().scrollIntoViewIfNeeded()
    await expect(async () => {
      const count = await page.locator('article').count()
      expect(count).toBeGreaterThan(20)
    }).toPass()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(2000)
  })

  test('検索入力から結果表示までが1秒未満', async ({ page }) => {
    const searchPage = new SearchPage(page)
    await searchPage.goto()

    const start = Date.now()
    await searchPage.search('raisetech')
    await expect(searchPage.postResultByContent('raisetech')).toBeVisible()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(1000)
  })
})
