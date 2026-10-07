import type { Locator, Page } from '@playwright/test'

export class FollowListPage {
  readonly page: Page
  readonly backLink: Locator
  readonly followingTab: Locator
  readonly followerTab: Locator
  readonly emptyFollowingText: Locator
  readonly emptyFollowerText: Locator

  constructor(page: Page) {
    this.page = page
    this.backLink = page.getByRole('link', { name: /プロフィールに戻る/ })
    this.followingTab = page.getByRole('link', { name: 'フォロー中' })
    this.followerTab = page.getByRole('link', { name: 'フォロワー' })
    this.emptyFollowingText = page.getByText('まだ誰もフォローしていません')
    this.emptyFollowerText = page.getByText('まだフォロワーがいません')
  }

  async gotoFollowing(username: string) {
    await this.page.goto(`/users/${username}/following`)
  }

  async gotoFollowers(username: string) {
    await this.page.goto(`/users/${username}/followers`)
  }

  rowByUsername(username: string): Locator {
    return this.page.locator('li', { hasText: `@${username}` })
  }
}
