import { expect, test, type Locator } from '@playwright/test'
import { SearchPage } from '../pages/search.page'
import { PostDetailPage } from '../pages/post-detail.page'

async function getLikeCount(likeButton: Locator): Promise<number> {
  const text = await likeButton.innerText()
  return Number.parseInt(text.trim(), 10)
}

// 同じ固定投稿のいいね数を複数テストで共有するため、並列実行による競合を避けてserialにする
test.describe.serial('いいね', () => {
  test('いいねするとカウントが増え、もう一度押すと元に戻る', async ({ page }) => {
    const searchPage = new SearchPage(page)
    const postDetailPage = new PostDetailPage(page)

    await searchPage.goto()
    await searchPage.search('raisetech')
    await searchPage.postResultByContent('raisetech').click()

    const before = await getLikeCount(postDetailPage.likeButton)

    await postDetailPage.likeButton.click()
    await expect(postDetailPage.likeButton).toHaveText(String(before + 1))

    await postDetailPage.likeButton.click()
    await expect(postDetailPage.likeButton).toHaveText(String(before))
  })

  test('いいねした状態はリロードしても維持される', async ({ page }) => {
    const searchPage = new SearchPage(page)
    const postDetailPage = new PostDetailPage(page)

    await searchPage.goto()
    await searchPage.search('raisetech')
    await searchPage.postResultByContent('raisetech').click()

    const before = await getLikeCount(postDetailPage.likeButton)

    await postDetailPage.likeButton.click()
    await expect(postDetailPage.likeButton).toHaveText(String(before + 1))

    await page.reload()
    await expect(postDetailPage.likeButton).toHaveText(String(before + 1))

    // 後片付け: 他のテストに影響しないよう取り消しておく
    await postDetailPage.likeButton.click()
    await expect(postDetailPage.likeButton).toHaveText(String(before))
  })
})
