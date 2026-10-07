import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORAGE_STATE_PATHS } from './fixtures/auth.fixture'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: '.',
  testMatch: ['scenarios/**/*.spec.ts', 'accessibility/**/*.spec.ts', 'performance/**/*.spec.ts'],
  // 新着投稿バナーのテスト（30秒ポーリングの実時間待機）は既定実行から除外する
  grepInvert: process.env.E2E_INCLUDE_SLOW ? undefined : /@slow/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: './fixtures/global-setup.ts',
  globalTeardown: './fixtures/global-teardown.ts',
  reporter: [
    ['html', { outputFolder: 'results/report', open: 'never' }],
    ['list'],
  ],
  outputDir: 'results/test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    // 多くのシナリオはログイン前提のため、既定はaliceでログイン済みの状態にする。
    // 未ログイン状態が必要なテスト（auth.spec.ts等）は test.use({ storageState: LOGGED_OUT_STATE }) で上書きする
    storageState: STORAGE_STATE_PATHS.alice,
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  webServer: process.env.CI
    ? {
        command: 'cd ../frontend && npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: false,
      }
    : undefined, // ローカルでは手動起動済みのフロントエンド(5173)・バックエンド(8080)を使う
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // test:all 実行時のみ使うオプション project
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
