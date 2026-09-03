/**
 * 全テストファイルの実行前に一度だけ読み込まれる共通設定。
 * vite.config.ts の test.setupFiles で指定している。
 */
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 各テストで描画したコンポーネントを毎回破棄する。
// 残したままだと次のテストで同じ要素が2個見つかり、getByText が「複数見つかった」と失敗する。
// globals: false のときは自動クリーンアップが働かないため、明示的に登録する。
afterEach(() => {
  cleanup()
})
