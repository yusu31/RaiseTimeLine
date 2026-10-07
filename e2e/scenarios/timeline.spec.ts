import { expect, test } from '@playwright/test'
import { TimelinePage } from '../pages/timeline.page'

test.describe('タイムライン', () => {
  test('「全体」タブでは全ユーザーの投稿が表示される', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    await timelinePage.goto()

    await expect(timelinePage.postCardByContent('E2Eテスト用フォロー中タイムライン投稿1')).toBeVisible()
  })

  test('「フォロー中」タブに切り替えるとフォロー中ユーザー（と自分）の投稿のみ表示される', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    await timelinePage.goto()

    await timelinePage.followingTab.click()

    // charlieはaliceがフォロー中（seedデータ）なので表示される
    await expect(timelinePage.postCardByContent('E2Eテスト用フォロー中タイムライン投稿1')).toBeVisible()
    // bobはフォローしていないので表示されない
    await expect(timelinePage.postCardByContent('E2Eテスト用タイムライン投稿 1')).toHaveCount(0)
  })

  test('全体タブで無限スクロールすると追加の投稿が読み込まれる', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    await timelinePage.goto()

    // 1ページ目は20件（bobの25件 + alice/charlieの投稿で21件以上あるため常に満たされる）
    await expect(page.locator('article')).toHaveCount(20)

    await page.locator('article').last().scrollIntoViewIfNeeded()

    await expect(async () => {
      const count = await page.locator('article').count()
      expect(count).toBeGreaterThan(20)
    }).toPass()
  })

  test('新着投稿があると一定時間後にバナーが表示される @slow', async ({ page, request }) => {
    test.setTimeout(60_000)
    const timelinePage = new TimelinePage(page)

    await timelinePage.goto()

    // bobとしてAPI経由で新しい投稿を作成する（UI操作より高速・確実）
    const loginResponse = await request.post('http://localhost:8080/api/auth/login', {
      data: { email: 'e2euser_bob@e2etest.local', password: 'E2eTestPass1' },
    })
    const { accessToken } = await loginResponse.json()

    await request.post('http://localhost:8080/api/posts', {
      headers: { Authorization: `Bearer ${accessToken}` },
      multipart: { content: `E2E新着投稿バナー確認用 ${Date.now()}` },
    })

    // ポーリング間隔（30秒）を待ってバナーが表示されることを確認する
    await expect(timelinePage.newPostsBanner).toBeVisible({ timeout: 35_000 })
  })
})
