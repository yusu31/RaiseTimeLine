import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProfileEditPage } from '../pages/profile-edit.page'
import { ProfilePage } from '../pages/profile.page'
import { TimelinePage } from '../pages/timeline.page'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_IMAGE_PATH = path.resolve(__dirname, '..', 'data', 'test-image.jpg')

// いずれもaliceのプロフィールを更新するテストのため、並列実行による上書き競合を避けてserialにする
test.describe.serial('プロフィール', () => {
  test('表示名と自己紹介を編集すると変更が反映される', async ({ page }) => {
    const profileEditPage = new ProfileEditPage(page)
    const profilePage = new ProfilePage(page)
    const newDisplayName = `E2E Alice ${Date.now()}`
    const newBio = `E2Eテストで更新した自己紹介 ${Date.now()}`

    await profileEditPage.goto()
    await profileEditPage.updateProfile({ displayName: newDisplayName, bio: newBio })

    await expect(page).toHaveURL(/\/users\/e2euser_alice$/)
    await expect(profilePage.displayNameHeading).toHaveText(newDisplayName)
    await expect(page.getByText(newBio)).toBeVisible()
  })

  test('プロフィールアイコンを変更できる', async ({ page }) => {
    const profileEditPage = new ProfileEditPage(page)

    await profileEditPage.goto()
    await profileEditPage.changeIcon(TEST_IMAGE_PATH)
    await profileEditPage.saveButton.click()

    await expect(page).toHaveURL(/\/users\/e2euser_alice$/)
    await expect(page.locator('header img')).toBeVisible()
  })

  test('プロフィールページに自分の投稿が表示される', async ({ page }) => {
    const timelinePage = new TimelinePage(page)
    const profilePage = new ProfilePage(page)
    const content = `E2Eプロフィール表示確認投稿 ${Date.now()}`

    await timelinePage.goto()
    await timelinePage.createPost(content)

    await profilePage.goto('e2euser_alice')
    await expect(profilePage.postCardByContent(content)).toBeVisible()
  })
})
