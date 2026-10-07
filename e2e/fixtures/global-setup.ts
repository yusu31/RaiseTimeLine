import { chromium, request } from '@playwright/test'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORAGE_STATE_PATHS } from './auth.fixture'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const E2E_DIR = path.resolve(__dirname, '..')

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8080'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const AUTH_STORAGE_KEY = 'raisetimeline.auth'
const PASSWORD = 'E2eTestPass1'

// e2e/data/seed-e2e-data.sql が投入する固定ユーザーと対応させる
const USERS = [
  { email: 'e2euser_alice@e2etest.local', storagePath: STORAGE_STATE_PATHS.alice },
  { email: 'e2euser_bob@e2etest.local', storagePath: STORAGE_STATE_PATHS.bob },
  { email: 'e2euser_charlie@e2etest.local', storagePath: STORAGE_STATE_PATHS.charlie },
] as const

export default async function globalSetup() {
  console.log('[global-setup] テストデータを投入します...')
  execSync('npm run seed', { cwd: E2E_DIR, stdio: 'inherit' })

  // 各ユーザーでAPIにログインし、トークンをブラウザのlocalStorageへ直接書き込んでstorageStateとして保存する。
  // UIのログインフォームを毎回操作するより大幅に速く、各specがこのファイルを再利用できる
  const apiContext = await request.newContext({ baseURL: API_BASE_URL })
  const browser = await chromium.launch()

  try {
    for (const user of USERS) {
      const response = await apiContext.post('/api/auth/login', {
        data: { email: user.email, password: PASSWORD },
      })
      if (!response.ok()) {
        throw new Error(
          `[global-setup] ${user.email} のログインに失敗しました（status: ${response.status()}）。seedが実行されているか確認してください。`,
        )
      }
      const auth = await response.json()

      const page = await browser.newPage({ baseURL: BASE_URL })
      // localStorageはオリジンに紐づくため、一度そのオリジンへ遷移してから書き込む必要がある
      await page.goto('/login')
      await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
        {
          key: AUTH_STORAGE_KEY,
          value: { accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
        },
      )
      await page.context().storageState({ path: user.storagePath })
      await page.close()
    }
  } finally {
    await browser.close()
    await apiContext.dispose()
  }

  console.log('[global-setup] 3ユーザー分のstorageStateを保存しました')
}
