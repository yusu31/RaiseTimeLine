import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// global-setup.ts が3ユーザー分のログイン状態をここに保存する。
// playwright.config.ts の既定 storageState は alice を使う（多くのシナリオがログイン前提のため）。
// 未ログイン状態でテストしたい場合（auth.spec.ts 等）は各テストファイル側で
// test.use({ storageState: { cookies: [], origins: [] } }) を使って明示的に上書きする
export const STORAGE_STATE_PATHS = {
  alice: path.resolve(__dirname, '..', 'auth', 'user-a.json'),
  bob: path.resolve(__dirname, '..', 'auth', 'user-b.json'),
  charlie: path.resolve(__dirname, '..', 'auth', 'user-c.json'),
} as const

export const LOGGED_OUT_STATE = { cookies: [], origins: [] }
