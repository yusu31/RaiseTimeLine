import type { Locator, Page } from '@playwright/test'

export class TimelinePage {
  readonly page: Page
  readonly allTab: Locator
  readonly followingTab: Locator
  readonly composeButton: Locator
  readonly logoutButton: Locator
  readonly newPostsBanner: Locator
  readonly postComposerTextarea: Locator
  readonly postComposerSubmitButton: Locator
  readonly searchLink: Locator
  readonly profileLink: Locator

  constructor(page: Page) {
    this.page = page
    this.allTab = page.getByRole('button', { name: '全体' })
    this.followingTab = page.getByRole('button', { name: 'フォロー中' })
    this.composeButton = page.getByRole('button', { name: '＋投稿する' })
    this.logoutButton = page.getByRole('button', { name: 'ログアウト' })
    this.newPostsBanner = page.getByText(/件の新着を表示/)
    this.postComposerTextarea = page.getByPlaceholder('いまどうしてる？')
    this.postComposerSubmitButton = page.getByRole('button', { name: '投稿する' })
    this.searchLink = page.getByRole('link', { name: '検索' })
    this.profileLink = page.getByRole('link', { name: 'プロフィール' })
  }

  async goto() {
    await this.page.goto('/timeline')
  }

  async logout() {
    await this.logoutButton.click()
  }

  postCardByContent(content: string): Locator {
    return this.page.locator('article', { hasText: content })
  }
}
