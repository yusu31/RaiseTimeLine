import type { Locator, Page } from '@playwright/test'

export class SearchPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly postTab: Locator
  readonly userTab: Locator
  readonly postNoResultsText: Locator
  readonly userNoResultsText: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.getByLabel('キーワード・ユーザー名で検索')
    this.postTab = page.getByRole('button', { name: '投稿' })
    this.userTab = page.getByRole('button', { name: 'ユーザー' })
    this.postNoResultsText = page.getByText(/を含む投稿は見つかりませんでした/)
    this.userNoResultsText = page.getByText(/に一致するユーザーは見つかりませんでした/)
  }

  async goto() {
    await this.page.goto('/search')
  }

  async search(keyword: string) {
    await this.searchInput.fill(keyword)
  }

  postResultByContent(content: string): Locator {
    return this.page.locator('article', { hasText: content })
  }

  userResultByUsername(username: string): Locator {
    return this.page.locator('a', { hasText: `@${username}` })
  }
}
