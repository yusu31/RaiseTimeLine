import type { Locator, Page } from '@playwright/test'

export class PostDetailPage {
  readonly page: Page
  readonly backLink: Locator
  readonly commentInput: Locator
  readonly commentSubmitButton: Locator
  readonly commentErrorMessage: Locator
  readonly commentsHeading: Locator
  readonly noCommentsText: Locator
  readonly likeButton: Locator
  readonly editButton: Locator
  readonly deleteButton: Locator
  readonly deleteConfirmButton: Locator
  readonly deleteCancelButton: Locator

  constructor(page: Page) {
    this.page = page
    this.backLink = page.getByRole('link', { name: '投稿' })
    this.commentInput = page.getByPlaceholder('コメントを入力…')
    this.commentSubmitButton = page.getByRole('button', { name: 'コメントを送信' })
    this.commentErrorMessage = page.locator('form p.text-xs.text-red-600')
    this.commentsHeading = page.getByText(/コメント \(\d+件\)/)
    this.noCommentsText = page.getByText('まだコメントがありません。')
    this.likeButton = page.locator('.like-button')
    this.editButton = page.getByRole('button', { name: '編集する' })
    this.deleteButton = page.getByRole('button', { name: '削除する' })
    this.deleteConfirmButton = page.getByRole('button', { name: /^削除する$/ })
    this.deleteCancelButton = page.getByRole('button', { name: 'キャンセル' })
  }

  async goto(postId: number) {
    await this.page.goto(`/posts/${postId}`)
  }

  async addComment(content: string) {
    await this.commentInput.fill(content)
    await this.commentSubmitButton.click()
  }

  commentDeleteButtonByText(content: string): Locator {
    return this.page
      .locator('li', { hasText: content })
      .getByRole('button', { name: 'コメントを削除する' })
  }

  commentByText(content: string): Locator {
    return this.page.getByText(content, { exact: false })
  }
}
