import type { Locator, Page } from '@playwright/test'

export class ProfileEditPage {
  readonly page: Page
  readonly displayNameInput: Locator
  readonly usernameInput: Locator
  readonly bioTextarea: Locator
  readonly iconFileInput: Locator
  readonly cropApplyButton: Locator
  readonly cancelButton: Locator
  readonly saveButton: Locator

  constructor(page: Page) {
    this.page = page
    this.displayNameInput = page.getByLabel('表示名')
    this.usernameInput = page.getByLabel('ユーザー名（@のあとの部分）')
    this.bioTextarea = page.locator('#bio')
    this.iconFileInput = page.locator('input[type="file"]')
    // 画像選択後に開くIconCropModal（トリミング）の確定ボタン
    this.cropApplyButton = page.getByRole('button', { name: '適用する' })
    this.cancelButton = page.getByRole('button', { name: 'キャンセル' })
    this.saveButton = page.getByRole('button', { name: '保存する' })
  }

  async changeIcon(imagePath: string) {
    await this.iconFileInput.setInputFiles(imagePath)
    await this.cropApplyButton.click()
  }

  async goto() {
    await this.page.goto('/profile/edit')
  }

  async updateProfile(params: { displayName?: string; bio?: string }) {
    if (params.displayName !== undefined) {
      await this.displayNameInput.fill(params.displayName)
    }
    if (params.bio !== undefined) {
      await this.bioTextarea.fill(params.bio)
    }
    await this.saveButton.click()
  }
}
