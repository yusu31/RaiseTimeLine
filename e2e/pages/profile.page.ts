import type { Locator, Page } from '@playwright/test'

export class ProfilePage {
  readonly page: Page
  readonly displayNameHeading: Locator
  readonly editProfileLink: Locator
  readonly followingLink: Locator
  readonly followerLink: Locator
  readonly noPostsText: Locator

  constructor(page: Page) {
    this.page = page
    this.displayNameHeading = page.locator('h1')
    this.editProfileLink = page.getByRole('link', { name: 'プロフィール編集' })
    this.followingLink = page.getByRole('link', { name: /フォロー中$/ })
    this.followerLink = page.getByRole('link', { name: /フォロワー$/ })
    this.noPostsText = page.getByText('まだ投稿がありません')
  }

  async goto(username: string) {
    await this.page.goto(`/users/${username}`)
  }

  postCardByContent(content: string): Locator {
    return this.page.locator('article', { hasText: content })
  }
}
