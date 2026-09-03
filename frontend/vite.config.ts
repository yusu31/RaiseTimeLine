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
  },
})
