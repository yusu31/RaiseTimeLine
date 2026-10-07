import { expect, test } from '@playwright/test'
import { ProfilePage } from '../pages/profile.page'
import { FollowListPage } from '../pages/follow-list.page'

function extractCount(text: string): number {
  const match = text.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : 0
}

// alice(ログインユーザー) -> bob の関係だけを使い、各テストの最後に必ず未フォローへ戻す。
// seed-e2e-data.sql にある alice -> charlie の既存フォロー関係（他のspecが前提にしている）には触れない。
// 同じユーザーの状態を複数テストで扱うため、並列実行による競合を避けてserialにする
test.describe.serial('フォロー', () => {
  test('フォローするとフォロワー数が増える', async ({ page }) => {
    const profilePage = new ProfilePage(page)

    await profilePage.goto('e2euser_bob')
    const before = extractCount(await profilePage.followerLink.innerText())

    await page.getByRole('button', { name: 'フォローする' }).click()
    await expect(page.getByRole('button', { name: 'フォロー中' })).toBeVisible()
    await expect(profilePage.followerLink).toContainText(String(before + 1))
  })

  test('フォロー解除は確認ダイアログを経て実行され、カウントが減る', async ({ page }) => {
    const profilePage = new ProfilePage(page)

    // 直前のテストでフォロー済みの状態から始まる
    await profilePage.goto('e2euser_bob')
    const before = extractCount(await profilePage.followerLink.innerText())

    await page.getByRole('button', { name: 'フォロー中' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'フォロー解除' }).click()

    await expect(page.getByRole('button', { name: 'フォローする' })).toBeVisible()
    await expect(profilePage.followerLink).toContainText(String(before - 1))
  })

  test('フォロー中・フォロワー一覧に反映される', async ({ page }) => {
    const profilePage = new ProfilePage(page)
    const followListPage = new FollowListPage(page)

    // 直前のテストで未フォローに戻っているので、ここで改めてフォローする
    await profilePage.goto('e2euser_bob')
    await page.getByRole('button', { name: 'フォローする' }).click()
    await expect(page.getByRole('button', { name: 'フォロー中' })).toBeVisible()

    await followListPage.gotoFollowing('e2euser_alice')
    await expect(followListPage.rowByUsername('e2euser_bob')).toBeVisible()

    await followListPage.gotoFollowers('e2euser_bob')
    await expect(followListPage.rowByUsername('e2euser_alice')).toBeVisible()

    // 後片付け: 未フォローに戻す
    await profilePage.goto('e2euser_bob')
    await page.getByRole('button', { name: 'フォロー中' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'フォロー解除' }).click()
    await expect(page.getByRole('button', { name: 'フォローする' })).toBeVisible()
  })
})
