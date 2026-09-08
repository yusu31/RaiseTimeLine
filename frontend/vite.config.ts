// Vitestの設定（test）を書くため、defineConfigは 'vite' ではなく 'vitest/config' から読み込む。
// 'vite' 側の型には test フィールドが無く、型エラーになるため。
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    // Node上に仮想のブラウザ環境（DOM）を用意する。実ブラウザは起動しないので高速に動く
    environment: 'jsdom',
    // 全テストの実行前に一度だけ読み込む共通設定
    setupFiles: ['./src/test/setup.ts'],
    // テストとして実行するファイルの範囲。src配下の *.test.ts / *.test.tsx だけを対象にする
    include: ['src/**/*.test.{ts,tsx}'],
    // describe/it/expect はグローバルにせず、各テストファイルで明示的にimportする方針。
    // どこから来た関数か読んで分かり、ESLintの未定義変数チェックもそのまま使えるため
    globals: false,
    // 日時の整形はタイムゾーンで結果が変わる。実行するPCの設定に左右されないよう固定する
    env: {
      TZ: 'Asia/Tokyo',
    },
    // カバレッジ（テストが1度も通っていない行の検出器）。
    // 閾値（thresholds）は意図的に設定しない。数値を満たすためだけの中身のないテストが生まれるため。
    // CIにも入れない。ローカルで「抜けを探す道具」として使う
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // テストコード自体や設定ファイルは対象外。測りたいのは製品コードだけ
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
})
