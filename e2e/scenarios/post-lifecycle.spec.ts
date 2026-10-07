import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TimelinePage } from '../pages/timeline.page'
import { PostDetailPage } from '../pages/post-detail.page'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_IMAGE_PATH = path.resolve(__dirname, '..', 'data', 'test-image.jpg')

test.describe('投稿のライフサイクル', () => {
  test('テキスト投稿を作成するとタイムラインに表示される', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const content = `E2Eテキスト投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.createPost(content)

    await expect(timelinePage.postCardByContent(content)).toBeVisible()
  })

  test('画像付き投稿を作成できる', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const content = `E2E画像投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.createPost(content, TEST_IMAGE_PATH)

    const card = timelinePage.postCardByContent(content)
    await expect(card).toBeVisible()
    await expect(card.getByAltText('投稿画像')).toBeVisible()
  })

  test('280文字ちょうどなら投稿でき、281文字では投稿ボタンが押せない', async ({ page }) => {
    const timelinePage = new TimelinePage(page)

    await timelinePage.goto()
    await timelinePage.composeButton.click()

    await timelinePage.postComposerTextarea.fill('あ'.repeat(281))
    await expect(timelinePage.postComposerSubmitButton).toBeDisabled()

    await timelinePage.postComposerTextarea.fill('あ'.repeat(280))
    await expect(timelinePage.postComposerSubmitButton).toBeEnabled()
  })

  test('自分の投稿を編集すると内容が更新される', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const original = `E2E編集前投稿 ${Date.now()}`
    const updated = `E2E編集後投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.createPost(original)

    const card = timelinePage.postCardByContent(original)
    await card.getByRole('button', { name: '編集する' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.locator('textarea').fill(updated)
    await dialog.getByRole('button', { name: '保存' }).click()

    await expect(timelinePage.postCardByContent(updated)).toBeVisible()
  })

  test('自分の投稿を削除するとタイムラインから消える', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const content = `E2E削除対象投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.createPost(content)

    const card = timelinePage.postCardByContent(content)
    await card.getByRole('button', { name: '削除する' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '削除する' }).click()

    await expect(timelinePage.postCardByContent(content)).toHaveCount(0)
  })

  test('投稿をクリックすると投稿詳細ページに遷移する', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const postDetailPage = new PostDetailPage(page)
    const content = `E2E詳細遷移投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.createPost(content)
    await timelinePage.postCardByContent(content).click()

    await expect(page).toHaveURL(/\/posts\/\d+$/)
    await expect(postDetailPage.commentsHeading).toBeVisible()
  })
})
