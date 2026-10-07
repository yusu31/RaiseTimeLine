import type { Locator, Page } from '@playwright/test'

export type SignupParams = {
  email: string
  username: string
  displayName: string
  password: string
}

export class SignupPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly usernameInput: Locator
  readonly displayNameInput: Locator
  readonly passwordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly submitButton: Locator
  readonly apiErrorMessage: Locator
  readonly loginLink: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel('メールアドレス')
    this.usernameInput = page.getByLabel('ユーザー名（英数字4〜15文字）')
    this.displayNameInput = page.getByLabel('表示名')
    this.passwordInput = page.getByLabel('パスワード（8文字以上）')
    this.confirmPasswordInput = page.getByLabel('パスワード確認')
    this.submitButton = page.getByRole('button', { name: '登録する' })
    // バリデーションエラーとAPIエラーは両方とも同じ text-red-600 クラスで出るが、
    // APIエラーはフォーム末尾の1個だけなので .last() で取得する
    this.apiErrorMessage = page.locator('p.text-red-600').last()
    this.loginLink = page.getByRole('link', { name: 'ログイン' })
  }

  async goto() {
    await this.page.goto('/signup')
  }

  async signup(params: SignupParams) {
    await this.emailInput.fill(params.email)
    await this.usernameInput.fill(params.username)
    await this.displayNameInput.fill(params.displayName)
    await this.passwordInput.fill(params.password)
    await this.confirmPasswordInput.fill(params.password)
    await this.submitButton.click()
  }
}
