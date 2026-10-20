// README用のスクリーンショットとデモ動画を撮る。
// 前提: 撮影専用DB(raisetimeline_showcase)でバックエンド(8080)、フロント(5173)が起動済みであること。
//   バックエンド: SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/raisetimeline_showcase ./gradlew bootRun
// 実行: cd e2e/showcase && node capture.mjs（playwright は e2e/node_modules を使う）
// 手順: 1) APIで4人のユーザー・投稿・いいね・コメント・フォローを作る  2) 静止画を撮る  3) 操作デモを動画で撮る
import { chromium } from '../node_modules/@playwright/test/index.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(here, 'assets')
const OUT = path.resolve(here, '../../docs/images')
const VIDEO_DIR = path.join(here, 'video')
mkdirSync(OUT, { recursive: true })

const API = 'http://localhost:8080/api'
const WEB = 'http://localhost:5173'
const PASSWORD = 'Showcase1234'
const AUTH_KEY = 'raisetimeline.auth'

const USERS = [
  { key: 'mio', username: 'mio_walk', displayName: '美緒', icon: 'mio.jpg', bio: '朝の散歩とコーヒーが日課。通勤前に見つけた景色を投稿しています。' },
  { key: 'kenta', username: 'kenta_dev', displayName: '健太', icon: 'kenta.jpg', bio: 'Webエンジニア1年目。毎日の学びをメモしています。' },
  { key: 'sora', username: 'sora_hike', displayName: '空', icon: 'sora.jpg', bio: '週末は山へ。次の目標は北アルプス。' },
  { key: 'hina', username: 'hina_cafe', displayName: 'ひな', icon: 'hina.jpg', bio: '喫茶店めぐりが趣味です。' },
]

async function api(token, method, url, body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  let payload = body
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(API + url, { method, headers, body: payload })
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json().catch(() => null)
}

function imageForm(file, extra = {}) {
  const form = new FormData()
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  form.append('image', new Blob([readFileSync(path.join(ASSETS, file))], { type: 'image/jpeg' }), file)
  return form
}

async function seed() {
  const auth = {}
  for (const u of USERS) {
    const res = await api(null, 'POST', '/auth/signup', {
      email: `${u.username}@showcase.local`, username: u.username, displayName: u.displayName, password: PASSWORD,
    })
    auth[u.key] = res
    await api(res.accessToken, 'PUT', '/users/me', { displayName: u.displayName, username: u.username, bio: u.bio })
    await api(res.accessToken, 'POST', '/users/me/icon', imageForm(u.icon))
  }
  const tok = (k) => auth[k].accessToken
  const post = async (k, content, image) => {
    const form = image ? imageForm(image, { content }) : (() => { const f = new FormData(); f.append('content', content); return f })()
    const res = await api(tok(k), 'POST', '/posts', form)
    await new Promise((r) => setTimeout(r, 1100)) // 投稿時刻を少しずつずらして自然な並びにする
    return res
  }
  // 古い順に投稿する（タイムラインは新着順なので、最後に投稿したものが一番上に出る）
  const p1 = await post('hina', '駅前の喫茶店でモーニング。ここのトーストは厚切りでバターがじゅわっと染みる…！')
  const p2 = await post('sora', '早朝の稜線から。雲海の向こうから朝日が昇ってきて、思わず声が出ました。', 'sunrise.jpg')
  const p3 = await post('kenta', 'Spring Bootのテストを書いていたら、先にテストを赤にしてから直す流れが少しずつ身についてきた。地味だけど安心感がある。')
  const p4 = await post('mio', '仕事帰りの湖畔。風がなくて水面が鏡みたいでした。今日もおつかれさま。', 'lake.jpg')
  const p5 = await post('sora', '森の中を歩くと、木漏れ日のおかげで時間がゆっくり流れる気がします。', 'forest.jpg')
  const p6 = await post('mio', '日が沈む直前の空の色がきれいで、帰り道に何度も立ち止まってしまった。', 'dusk.jpg')

  const likes = [[p6, ['kenta', 'sora', 'hina']], [p5, ['mio', 'kenta']], [p4, ['kenta', 'sora', 'hina']], [p3, ['mio', 'sora']], [p2, ['mio', 'hina', 'kenta']], [p1, ['mio']]]
  for (const [p, who] of likes) for (const k of who) await api(tok(k), 'POST', `/posts/${p.id}/likes`)

  const comments = [
    [p6, 'kenta', 'わあ、グラデーションがすごい！'], [p6, 'sora', '山から見る夕焼けもいいですよ'], [p6, 'hina', '保存しました'],
    [p4, 'sora', '鏡みたい…静かでいい場所ですね'], [p3, 'sora', '赤→緑の流れ、分かります。安心して直せますよね'], [p2, 'mio', '雲海…行ってみたい'],
  ]
  for (const [p, k, text] of comments) await api(tok(k), 'POST', `/posts/${p.id}/comments`, { content: text })

  // フォロー関係: みんな mio / sora をフォロー。mio は sora と kenta をフォロー
  const follows = { kenta: ['mio', 'sora'], sora: ['mio'], hina: ['mio', 'sora'], mio: ['sora', 'kenta'] }
  for (const [k, targets] of Object.entries(follows)) {
    for (const t of targets) await api(tok(k), 'POST', `/users/${USERS.find((u) => u.key === t).username}/follow`)
  }
  return { auth, posts: { p3, p6 } }
}

async function login(context, authRes) {
  const page = await context.newPage()
  await page.goto(`${WEB}/login`)
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: AUTH_KEY, value: { accessToken: authRes.accessToken, refreshToken: authRes.refreshToken, user: authRes.user } },
  )
  return page
}

const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(600))

async function main() {
  const { auth, posts } = await seed()
  console.log('seed done')
  const browser = await chromium.launch()

  // --- 静止画（美緒としてログイン）---
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 }, locale: 'ja-JP' })
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) })

  const anon = await ctx.newPage()
  await anon.goto(`${WEB}/login`)
  await settle(anon)
  await shot(anon, '01-login.png')
  await anon.close()

  const page = await login(ctx, auth.mio)
  await page.setViewportSize({ width: 1200, height: 1350 }) // 投稿画像が大きいので、縦長にして複数件が入るようにする
  await page.goto(`${WEB}/timeline`); await settle(page)
  await shot(page, '02-timeline.png')

  await page.goto(`${WEB}/posts/${posts.p6.id}`); await settle(page)
  await shot(page, '03-post-detail.png')

  await page.goto(`${WEB}/users/sora_hike`); await settle(page)
  await shot(page, '04-profile.png')

  await page.goto(`${WEB}/search`); await settle(page)
  await page.getByLabel('キーワード・ユーザー名で検索').fill('朝'); await settle(page)
  await shot(page, '05-search.png')
  await ctx.close()

  // --- 動画（ひなとしてログイン → 投稿 → いいね → コメント → フォロー）---
  const vctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, locale: 'ja-JP', recordVideo: { dir: VIDEO_DIR, size: { width: 1100, height: 760 } } })
  const v = await login(vctx, auth.hina)
  const pause = (ms = 900) => v.waitForTimeout(ms)
  await v.goto(`${WEB}/timeline`); await settle(v); await pause(1200)
  await v.getByRole('button', { name: '投稿する' }).first().click(); await pause()
  await v.getByPlaceholder('いまどうしてる？').pressSequentially('今日は新しい喫茶店を見つけました。ブレンドが絶品でした。', { delay: 45 }); await pause()
  await v.getByRole('button', { name: '投稿する' }).last().click(); await settle(v); await pause(1400)
  await v.locator('.like-button').nth(1).click(); await pause(1100) // 2枚目のカード（美緒の夕焼けの投稿）にいいね
  await v.goto(`${WEB}/posts/${posts.p6.id}`); await settle(v); await pause(1000)
  await v.getByPlaceholder('コメントを入力…').pressSequentially('夕焼け、素敵です！', { delay: 60 }); await pause(600)
  await v.getByRole('button', { name: 'コメントを送信' }).click(); await settle(v); await pause(1300)
  await v.goto(`${WEB}/users/kenta_dev`); await settle(v); await pause(900)
  await v.getByRole('button', { name: 'フォローする' }).click(); await pause(1500)
  await vctx.close() // 動画はここで書き出される
  await browser.close()
  console.log('capture done')
}

main().catch((e) => { console.error(e); process.exit(1) })
