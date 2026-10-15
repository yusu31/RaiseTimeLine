// CloudFront Function(spa-rewrite.js)のテスト。実行: node --test terraform/functions/
//
// CloudFront Functionは `function handler(event)` だけを書くファイルで、export を持たない。
// そのためファイルの中身を文字列で読み込み、new Function で handler を取り出して呼ぶ。
// テストケースは同値分割で選ぶ:
//   ・拡張子の無いパス(画面のURL)        → /index.html に書き換える
//   ・拡張子のあるパス(実ファイル)        → そのまま通す
//   ・クエリ文字列・ルート・末尾スラッシュ  → 境界として確認する
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./spa-rewrite.js', import.meta.url), 'utf-8')
const handler = new Function(`${source}; return handler;`)()

const run = (uri) => handler({ request: { uri, querystring: {}, headers: {} } }).uri

test('ルート(/)は /index.html に書き換える', () => {
  assert.equal(run('/'), '/index.html')
})

test('拡張子の無い画面のURL(/posts/1)は /index.html に書き換える', () => {
  assert.equal(run('/posts/1'), '/index.html')
})

test('末尾スラッシュ付きの画面のURL(/profile/)も /index.html に書き換える', () => {
  assert.equal(run('/profile/'), '/index.html')
})

test('拡張子のあるファイル(/assets/app-abc123.js)はそのまま通す', () => {
  assert.equal(run('/assets/app-abc123.js'), '/assets/app-abc123.js')
})

test('/index.html 自体はそのまま通す', () => {
  assert.equal(run('/index.html'), '/index.html')
})

test('書き換え対象でも、リクエストの他の項目(ヘッダー等)は壊さない', () => {
  const request = { uri: '/posts/1', querystring: { a: { value: '1' } }, headers: { host: { value: 'x' } } }
  const result = handler({ request })
  assert.deepEqual(result.querystring, { a: { value: '1' } })
  assert.deepEqual(result.headers, { host: { value: 'x' } })
})
