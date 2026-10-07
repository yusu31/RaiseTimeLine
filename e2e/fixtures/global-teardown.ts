import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const E2E_DIR = path.resolve(__dirname, '..')

export default async function globalTeardown() {
  console.log('[global-teardown] テストデータをクリーンアップします...')
  execSync('npm run cleanup', { cwd: E2E_DIR, stdio: 'inherit' })
}
