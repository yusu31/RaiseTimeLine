import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const E2E_DIR = path.resolve(__dirname, '..')

export default async function globalTeardown() {
  if (process.env.CI) {
    // CI上のpostgresサービスコンテナはジョブ終了後に破棄され、次回は必ずクリーンな状態で起動するため不要
    console.log('[global-teardown] CI環境のため、クリーンアップをスキップします（サービスコンテナ破棄で代替）')
    return
  }
  console.log('[global-teardown] テストデータをクリーンアップします...')
  execSync('npm run cleanup', { cwd: E2E_DIR, stdio: 'inherit' })
}
