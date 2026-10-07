import { expect, test } from '@playwright/test'
import { LOGGED_OUT_STATE, STORAGE_STATE_PATHS } from '../fixtures/auth.fixture'
import { LoginPage } from '../pages/login.page'
import { SignupPage } from '../pages/signup.page'
import { TimelinePage } from '../pages/timeline.page'

// このファイルのテストは「ログイン前」の操作そのものを検証するため、
// playwright.config.ts の既定（aliceでログイン済み）を明示的に未ログインへ上書きする
test.use({ storageState: LOGGED_OUT_STATE })

test.describe('認証フロー', () => {
  test('新規登録すると自動ログインしてタイムラインが表示される', async ({ page }) => {
    const signupPage = new SignupPage(page)
    const timelinePage = new TimelinePage(page)
    const uniqueSuffix = Date.now()

    await signupPage.goto()
    await signupPage.signup({
      email: `e2euser_signup_${uniqueSuffix}@e2etest.local`,
      // usernameは4〜15文字制限があるため末尾で切り詰める
      username: `e2sgn${uniqueSuffix}`.slice(0, 15),
      displayName: 'E2E Signup User',
      password: 'E2eTestPass1',
    })

    await expect(page).toHaveURL(/\/timeline$/)
    await expect(timelinePage.composeButton).toBeVisible()
  })

  test('既に使われているメールアドレスで登録するとエラーが表示される', async ({ page }) => {
    const signupPage = new SignupPage(page)

    await signupPage.goto()
    await signupPage.signup({
      email: 'e2euser_alice@e2etest.local', // seed-e2e-data.sql で投入済みの固定ユーザー
      username: 'e2euserdup',
      displayName: 'Duplicate User',
      password: 'E2eTestPass1',
    })

    await expect(signupPage.apiErrorMessage).toBeVisible()
    await expect(page).toHaveURL(/\/signup$/)
  })

  test('正しい認証情報でログインするとタイムラインが表示される', async ({ page }) => {
    const loginPage = new LoginPage(page)
    const timelinePage = new TimelinePage(page)

    await loginPage.goto()
    await loginPage.login('e2euser_alice@e2etest.local', 'E2eTestPass1')

    await expect(page).toHaveURL(/\/timeline$/)
    await expect(timelinePage.composeButton).toBeVisible()
  })

  test('間違ったパスワードでログインするとエラーメッセージが表示される', async ({ page }) => {
    const loginPage = new LoginPage(page)

    await loginPage.goto()
    await loginPage.login('e2euser_alice@e2etest.local', 'WrongPassword1')

    await expect(loginPage.errorMessage).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('未認証で保護ページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/timeline')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('ログアウト', () => {
  // ログアウトの検証にはログイン済み状態が必要なので、このブロックだけaliceでログイン済みにする
  test.use({ storageState: STORAGE_STATE_PATHS.alice })

  test('ログアウトするとログインページに戻る', async ({ page }) => {
    const timelinePage = new TimelinePage(page)

    await timelinePage.goto()
    await timelinePage.logout()

    await expect(page).toHaveURL(/\/login$/)
  })
})
