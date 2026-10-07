import { expect, test } from '@playwright/test'
import { SearchPage } from '../pages/search.page'

test.describe('検索', () => {
  test('投稿検索でキーワードに一致する投稿が表示される', async ({ page }) => {
    const searchPage = new SearchPage(page)

    await searchPage.goto()
    await searchPage.search('raisetech')

    await expect(searchPage.postResultByContent('raisetech')).toBeVisible()
  })

  test('投稿検索の結果をクリックすると投稿詳細ページに遷移する', async ({ page }) => {
    const searchPage = new SearchPage(page)

    await searchPage.goto()
    await searchPage.search('raisetech')
    await searchPage.postResultByContent('raisetech').click()

    await expect(page).toHaveURL(/\/posts\/\d+$/)
  })

  test('該当する投稿がない場合は見つからないメッセージが表示される', async ({ page }) => {
    const searchPage = new SearchPage(page)

    await searchPage.goto()
    await searchPage.search('存在しないはずのキーワードxyz123')

    await expect(searchPage.postNoResultsText).toBeVisible()
  })

  test('ユーザー検索でユーザー名に一致するユーザーが表示される', async ({ page }) => {
    const searchPage = new SearchPage(page)

    await searchPage.goto()
    await searchPage.userTab.click()
    await searchPage.search('e2euser_bob')

    await expect(searchPage.userResultByUsername('e2euser_bob')).toBeVisible()
  })

  test('ユーザー検索の結果をクリックするとプロフィールページに遷移する', async ({ page }) => {
    const searchPage = new SearchPage(page)

    await searchPage.goto()
    await searchPage.userTab.click()
    await searchPage.search('e2euser_bob')
    await searchPage.userResultByUsername('e2euser_bob').click()

    await expect(page).toHaveURL(/\/users\/e2euser_bob$/)
  })

  test('該当するユーザーがいない場合は見つからないメッセージが表示される', async ({ page }) => {
    const searchPage = new SearchPage(page)

    await searchPage.goto()
    await searchPage.userTab.click()
    await searchPage.search('nonexistentuserxyz123')

    await expect(searchPage.userNoResultsText).toBeVisible()
  })
})
