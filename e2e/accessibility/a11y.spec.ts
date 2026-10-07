import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LOGGED_OUT_STATE } from '../fixtures/auth.fixture'
import { SearchPage } from '../pages/search.page'

async function getViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations
}

test.describe('アクセシビリティ（WCAG 2.1 AA）', () => {
  test.describe('未ログインページ', () => {
    test.use({ storageState: LOGGED_OUT_STATE })

    test('ログイン画面', async ({ page }) => {
      await page.goto('/login')
      expect(await getViolations(page)).toEqual([])
    })

    test('新規登録画面', async ({ page }) => {
      await page.goto('/signup')
      expect(await getViolations(page)).toEqual([])
    })
  })

  test('タイムライン画面', async ({ page }) => {
    await page.goto('/timeline')
    expect(await getViolations(page)).toEqual([])
  })

  test('投稿詳細画面', async ({ page }) => {
    const searchPage = new SearchPage(page)
    await searchPage.goto()
    await searchPage.search('raisetech')
    await searchPage.postResultByContent('raisetech').click()

    expect(await getViolations(page)).toEqual([])
  })

  test('プロフィール画面', async ({ page }) => {
    await page.goto('/users/e2euser_alice')
    expect(await getViolations(page)).toEqual([])
  })

  test('検索画面', async ({ page }) => {
    const searchPage = new SearchPage(page)
    await searchPage.goto()
    expect(await getViolations(page)).toEqual([])
  })
})
