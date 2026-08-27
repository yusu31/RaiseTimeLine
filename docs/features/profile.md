# 機能詳細設計: プロフィール表示・編集（F-07）

## 概要

ユーザーごとのページ（`/users/:username`）で、アイコン画像・表示名・@ユーザー名・自己紹介と、
そのユーザーの投稿一覧を表示する。自分のページからは表示名・@ユーザー名・自己紹介・アイコン画像を編集できる。

投稿・コメントの著者名をクリックするとこの画面へ遷移する。F-09 投稿検索・F-10 ユーザー検索の
遷移先でもあるため、それらより先に実装した。

## 技術方針

### 画面URL・APIのキーに @ユーザー名 を使う

画面URLを `/users/:username`（X準拠）にしたうえで、**APIのパスも同じキーに揃えた**。

- URLを見ただけで誰のページか分かり、共有もしやすい
- `users.username` にはユニーク制約があるので一意に特定できる
- 画面が username を持っているのにAPIが id を要求すると、「username から id を引く」ための
  余分なAPI往復が1回増える

**採用しなかった案:** `GET /api/users/{id}`（設計当初の案）。
画面URLとAPIでキーが食い違い、上記の往復が発生するため。

**副作用:** @ユーザー名を変更すると旧URLは404になる。X と同じ挙動として許容する。

### アイコン画像はURLではなく「保存パス」をDBに持つ

`users.icon_image_path VARCHAR(255)` に `a1b2c3.png` のようなファイル名だけを保存し、
公開URL（`/uploads/a1b2c3.png`）への変換はレスポンス組み立て時に `StorageService.toPublicUrl()` が行う。

設計書当初の案は `icon_image_url VARCHAR(512)` だったが、**DBにフルURLを保存すると
ローカル保存から S3 へ移行したときに全行が使えなくなる**ため変更した。
既存の `posts.image_path` と同じ方針に揃えている。

### プロフィール取得と投稿一覧を別APIにする

当初の設計では `GET /api/users/{id}` のレスポンスに投稿一覧を含める予定だったが、
**1レスポンスに全投稿を埋め込むとページングができず、無限スクロールが成立しない**ため分離した。
投稿一覧は既存の `PostListResponse`（`posts` / `page` / `hasNext`）をそのまま再利用する。

### テキスト編集とアイコンアップロードでAPIを分ける

テキスト項目は JSON、画像は `multipart/form-data` と送信形式が異なるため、
`PUT /api/users/me`（JSON）と `POST /api/users/me/icon`（multipart）に分けた。

分けたことで、テキスト側は Bean Validation（`@Size` / `@Pattern`）がそのまま使え、
バリデーションエラーも既存の `MethodArgumentNotValidException` ハンドラ経由で 400 を返せる。

**トレードオフ:** アイコンを変更して保存したとき、画像のアップロードは成功したがテキストの保存が
失敗すると、画像だけ先に反映された状態になる。学習アプリの規模では許容する。

## エンドポイント仕様

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/users/{username}` | プロフィール取得 | 必要 |
| GET | `/api/users/{username}/posts?page=&size=` | そのユーザーの投稿一覧 | 必要 |
| PUT | `/api/users/me` | 表示名・@ユーザー名・自己紹介の更新 | 必要 |
| POST | `/api/users/me/icon` | アイコン画像のアップロード | 必要 |

### リクエスト/レスポンス形式

**GET /api/users/{username}**

```json
{
  "id": 21,
  "username": "demo_user",
  "displayName": "デモ太郎",
  "bio": "F-07の動作確認中です。",
  "iconImageUrl": "/uploads/ee179c20-0fba-426a-8179-a70be7bc0bc5.png",
  "createdAt": "2026-08-25T12:00:00"
}
```

`bio` / `iconImageUrl` は未設定なら `null`。

**PUT /api/users/me**

```json
// リクエスト
{ "displayName": "デモ太郎", "username": "demo_user", "bio": "自己紹介" }

// レスポンス（AuthContext の更新に使うため UserResponse を返す）
{ "id": 21, "username": "demo_user", "displayName": "デモ太郎",
  "email": "demo@example.com", "iconImageUrl": "/uploads/xxx.png" }
```

**POST /api/users/me/icon**

`multipart/form-data` の `image` パートに画像を入れる。レスポンスは `PUT /api/users/me` と同じ `UserResponse`。

### バリデーション

| 項目 | ルール | 違反時 |
|------|--------|--------|
| `displayName` | 必須・50文字以内 | 400 |
| `username` | 必須・4〜15文字・`^[A-Za-z0-9_]+$` | 400 |
| `username` | 他ユーザーと重複しない（**自分自身は除外**） | 409 |
| `bio` | 任意・160文字以内 | 400 |
| アイコン画像 | JPEG / PNG・5MB以内 | 400 |
| 対象ユーザーが存在しない | — | 404 |

## 設計判断

### @ユーザー名の重複チェックから自分自身を除外する

```sql
SELECT EXISTS(SELECT 1 FROM users WHERE username = #{username} AND id <> #{selfId})
```

プロフィール編集画面は現在の @ユーザー名 が入力欄に入った状態で開く。表示名だけ直して保存すると
@名は自分の現在値のまま送信されるため、**自分自身を除外しないと「何も変えずに保存」が常に409になる**。

### アイコン差し替えの順序

`新ファイル保存 → DB更新 → 旧ファイル削除` の順を守る。

DBのトランザクションは失敗すればロールバックできるが、**ファイルの削除は取り消せない**。
「旧削除 → DB更新」の順にすると、DB更新の失敗時に「DBは古いパスを指しているが実体は無い」という
復旧不能な状態になる。この順序なら最悪でも未使用ファイルが1つ残るだけで済む。

なお `LocalStorageService.delete()` は失敗しても例外を投げず `log.warn` するだけなので、
旧ファイルの削除失敗がトランザクションを巻き込むことはない。

### アイコン画像を著者情報まで通す

`users.icon_image_path` を追加するだけでは、**投稿・コメントの著者アイコンには反映されない**。
著者情報は `PostDetail` / `CommentDetail`（JOIN結果専用クラス）を経由して流れるため、次を全て通した。

```
users.icon_image_path
  → PostMapper.xml / CommentMapper.xml の SELECT に u.icon_image_path を追加
  → PostDetail.authorIconImagePath / CommentDetail.authorIconImagePath
  → StorageService.toPublicUrl()
  → PostAuthorResponse.iconImageUrl
  → フロントの Avatar
```

これを怠ると「ヘッダーだけアイコン画像、タイムラインはイニシャルのまま」という中途半端な状態になる。

### プロフィールの投稿一覧SQLは別ステートメントにする

`PostMapper.xml` に `selectByAuthorId` を追加した。`selectTimeline` に動的SQL（`<if>`）で条件を
足すのではなく、JOINと集計のブロックが重複してでも**1ステートメント1目的**にしている。
既存の `selectTimeline` / `selectDetailById` / `selectNewerThan` も同じ方針で書かれている。

いいね数・コメント数・いいね済みフラグは、既存と同じ**相関サブクエリ**で1クエリに集約しN+1を避けている。

## フロントエンド実装

### 画面・ルーティング

| パス | コンポーネント | 内容 |
|------|--------------|------|
| `/users/:username` | `ProfilePage` | プロフィール表示＋投稿一覧（無限スクロール） |
| `/profile/edit` | `ProfileEditPage` | プロフィール編集 |

どちらも `<ProtectedRoute>` 配下（認証必須）。
編集画面のパスに `:username` を入れないのは、**編集対象がその username 自身**のため。
`/users/:username/edit` にすると保存した瞬間にURLが古い名前を指す状態になる。

### 編集後のログインユーザー情報の同期

`AuthContext` に `updateUser(user)` を追加した。`PUT /api/users/me` の結果でこれを呼ぶことで、
ヘッダーに表示している表示名・アイコンが即座に新しいものへ切り替わる。

これが無いと、**保存は成功しているのにヘッダーだけ古い名前のまま残る**という状態になる。

### 著者名クリック時のイベント伝播

投稿カード（`PostCard`）はカード全体が `/posts/:id` へのリンクになっている。
その中に著者名のリンクを置いたため、`onClick` で `event.stopPropagation()` を呼び、
**プロフィールへ遷移した直後に投稿詳細へも遷移してしまう二重発火**を防いでいる。
既存の編集・削除ボタンと同じ対策。

### 無限スクロールの共通化

`TimelinePage` にベタ書きされていた `IntersectionObserver` を `useInfiniteScroll` フックへ切り出し、
`ProfilePage` と共用した。`rootMargin: '200px'`（200px手前で先読み）などの挙動は一切変えていない。

### 読み込み中の画面遷移対策

`ProfilePage` の読み込み処理には `ignore` フラグを入れている。

```ts
let ignore = false
// ...取得後
if (ignore) return
return () => { ignore = true }
```

別のユーザーのページへ素早く移動したとき、**前のユーザーの応答が後から届いて画面を上書きする**
（レースコンディション）のを防ぐため。React の開発モードでは `useEffect` が2回実行されるため、
この対策が無いと不具合が表面化しやすい。

## アイコン画像のトリミング（後日追加）

画像を選ぶとトリミングモーダル（`IconCropModal`）が開き、ドラッグで位置を、
スライダー（およびホイール・ピンチ）で拡大率を調整してから確定する。
`react-easy-crop` を使用し、**バックエンドは一切変更していない**（ブラウザ側で切り抜いてから
既存の `POST /api/users/me/icon` に送るだけのため）。

### 出力を 400×400 の JPEG に統一する

切り抜きと同時にリサイズしている。画面上の最大表示は 80px（`Avatar` の `lg`）なので、
高解像度ディスプレイを考慮しても 400px あれば足りる。
実測で **1200×800 の PNG（2814KB）→ 400×400 の JPEG（138KB）と約95%削減**できた。

JPEG は透過を扱えず透過部分が黒くなるため、canvas を白で塗りつぶしてから描画している。

**ファイル名は `icon.jpg` に固定する。** `LocalStorageService` は MIMEタイプと拡張子の
**両方**を検証するため、中身がJPEGでも拡張子が `.png` のままだと 400 で弾かれる。

### 切り抜き枠は円形にする

アイコンは実際に丸く表示されるため、調整画面も丸で見せる。
四角い枠で調整させると「思っていたより端が切れる」という食い違いが起きる。

### 一時URLに `URL.createObjectURL` を使わない

`useMemo` で作った ObjectURL を `useEffect` の後始末で `revokeObjectURL` する書き方は、
**StrictMode（開発モード）で effect が2回実行されると壊れる。**
破棄フェーズで解放された後、`useMemo` は依存が変わらないため再計算されず、
解放済みのURLを掴んだままになり画像が表示されなくなる（実際にこの不具合が発生した）。

`FileReader` で data URL に変換する方式に変更した。data URL は解放処理が不要なため、
この不整合が構造的に起こらない。

## 既知の制限

- **@ユーザー名を変更すると旧URLは404になる**（X と同じ挙動として許容）
- **@ユーザー名の大文字小文字は区別される。** `Yusu` と `yusu` が別アカウントとして共存しうる。
  V6 の UNIQUE 制約が大小区別ありのため。統一するにはマイグレーションが必要
- **予約語（`admin` / `api` 等）の @ユーザー名 を禁止していない。**
  `/api/users/me` とは衝突しない（@ユーザー名は最小4文字なので `me` は登録できない）ため実害はないが、
  将来URL設計を変えるなら要検討
- **アイコン画像の削除機能は無い**（差し替えのみ）
- **アイコンの切り抜きは正方形（円形表示）のみ。** 回転・傾き補正の機能は無い
- プロフィール編集で「アイコンのアップロードは成功したがテキスト保存が失敗」した場合、
  アイコンだけ先に反映される（APIを2本に分けたことのトレードオフ）。
  **保存に成功した時点で画面へ反映する**ようにしたため、DBと画面の表示がずれることはない
