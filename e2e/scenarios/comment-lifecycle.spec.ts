import { expect, test, type Page } from '@playwright/test'
import { SearchPage } from '../pages/search.page'
import { PostDetailPage } from '../pages/post-detail.page'

// seed-e2e-data.sql が投入するaliceの固定投稿（検索キーワード: raisetech）を対象にする
async function openFixedPost(page: Page) {
  const searchPage = new SearchPage(page)
  await searchPage.goto()
  await searchPage.search('raisetech')
  await searchPage.postResultByContent('raisetech').click()
}

test.describe('コメントのライフサイクル', () => {
  test('コメントを追加するとスレッドに表示される', async ({ page }) => {
    const postDetailPage = new PostDetailPage(page)
    const commentContent = `E2Eコメント ${Date.now()}`

    await openFixedPost(page)
    await postDetailPage.addComment(commentContent)

    await expect(postDetailPage.commentByText(commentContent)).toBeVisible()
  })

  test('自分のコメントを削除できる', async ({ page }) => {
    const postDetailPage = new PostDetailPage(page)
    const commentContent = `E2E削除対象コメント ${Date.now()}`

    await openFixedPost(page)
    await postDetailPage.addComment(commentContent)
    await expect(postDetailPage.commentByText(commentContent)).toBeVisible()

    await postDetailPage.commentDeleteButtonByText(commentContent).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '削除する' }).click()

    await expect(postDetailPage.commentByText(commentContent)).toHaveCount(0)
  })

  test('280文字を超えるコメントを送信するとエラーが表示される', async ({ page }) => {
    const postDetailPage = new PostDetailPage(page)

    await openFixedPost(page)
    await postDetailPage.addComment('あ'.repeat(281))

    await expect(postDetailPage.commentErrorMessage).toBeVisible()
  })
})
