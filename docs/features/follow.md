# 機能詳細設計: フォロー・フォロワー（F-11）

## 概要

他のユーザーをフォロー／フォロー解除できる。フォロー中・フォロワーの一覧を画面で確認でき、
タイムラインを「全体」と「フォロー中」のタブで切り替えられる。

フォロー操作の入口はプロフィール画面（`/users/:username`）で、F-07 で作った
「投稿・コメントの著者名 → プロフィール」の導線がそのまま生きる。

## 技術方針

### 自己フォローはアプリ層（Service）で弾く

`follows` テーブルには自己フォローを禁止する CHECK 制約（`ck_follows_not_self`）があるが、
**制約に頼らず `FollowService` で先に判定して 400 を返す。**

```java
if (followerId.equals(target.getId())) {
    throw new SelfFollowException("自分自身をフォローすることはできません");
}
```

二重フォローの吸収に使っている `ON CONFLICT (follower_id, following_id) DO NOTHING` は、
**UNIQUE 制約違反（SQLSTATE `23505`）しか無害化しない。**
CHECK 制約違反は `23514` なのでそのまま例外として伝播し、`GlobalExceptionHandler` の
汎用 `Exception` ハンドラに落ちて **500 になってしまう**。
利用者の操作ミスに 500 を返すのは誤りなので、一次防衛をアプリ層に置く。

CHECK 制約は「DB を直接操作されたときの最後の砦」として残す。

### フォロー中タイムラインは別ステートメントにする

`PostMapper.xml` に `selectFollowingTimeline` を新設した。`selectTimeline` に動的SQL `<if>` を
足す案は採らない（`docs/tech-stack.md`「SQLの記述方針」で「1ステートメント1目的」と決めたため）。

```sql
WHERE p.user_id = #{currentUserId}
   OR EXISTS (SELECT 1 FROM follows f
              WHERE f.follower_id = #{currentUserId} AND f.following_id = p.user_id)
```

絞り込みに `JOIN` ではなく `EXISTS` を使うのは、**JOIN では結合先の行数だけ投稿が重複しうる**のに対し、
`EXISTS` は真偽を返すだけで元の行数を変えないため。

`timeline=following` というクエリパラメータの解釈は `PostController` で行い、
`postService.getFollowingTimeline()` と `getTimeline()` を呼び分ける。
クエリ文字列は HTTP 側の都合なので Service には持ち込まない。

### フォロー中タイムラインに自分の投稿を含める

`OR p.user_id = #{currentUserId}` で自分の投稿を必ず含める（X と同じ挙動）。
これがないと、まだ誰もフォローしていないユーザーは自分で投稿しても
「フォロー中」タブが空のままになり、機能が壊れているように見える。

### フォロー数・フォロー中フラグは1クエリに集約する

プロフィール画面には「ユーザー情報・フォロー中の数・フォロワーの数・自分がフォロー済みか」が要る。
これを別々に問い合わせると3〜4往復になるため、`UserMapper.xml` の `selectProfileByUsername` で
相関サブクエリを使って1クエリにまとめている（`PostMapper.xml` の `like_count` / `liked_by_me` と同じ形）。

結果の受け皿として `domain/UserProfileDetail` を新設した。`users` テーブルをそのまま表す
`domain/User` とは列構成が違うため、別クラスに分けている。

フォロー中／フォロワー一覧（`FollowMapper.xml`）でも、各行の `followed_by_me` を
同じクエリで取得している。行ごとに判定APIを呼ぶと典型的な N+1 問題になる。

### フォロー中タブでは新着通知バナーを出さない

新着API（`GET /api/posts/new-count` / `/new`）は全体とフォロー中を区別せず、`id > afterId` の
件数を数えるだけである。フォロー中タブでこれを動かすと、**フォローしていない人の投稿まで
「新着」として数えてしまう。**

誤った件数を見せないために、フォロー中タブではポーリング自体を止める（`TimelinePage.tsx`）。
対応するなら `countNewerThanFollowing` / `selectNewerThanFollowing` の追加が必要 → 将来課題。

## エンドポイント仕様

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/api/users/{username}/follow` | フォローする | 必要 |
| DELETE | `/api/users/{username}/follow` | フォローを解除する | 必要 |
| GET | `/api/users/{username}/following` | そのユーザーがフォロー中の一覧 | 必要 |
| GET | `/api/users/{username}/followers` | そのユーザーのフォロワー一覧 | 必要 |
| GET | `/api/posts?timeline=following` | フォロー中タイムライン | 必要 |

`GET /api/users/{username}` （F-07）のレスポンスに `followingCount` / `followerCount` /
`followedByMe` を追加した。

### リクエスト/レスポンス形式

**POST / DELETE `/api/users/{username}/follow`** — リクエストボディなし

```json
{ "followerCount": 1, "followedByMe": true }
```

操作後の最新状態を返すので、画面側が数を計算する必要がない（`LikeStatusResponse` と同じ設計）。

**GET `/api/users/{username}/following` | `/followers`**

```json
[
  { "id": 1, "username": "user1", "displayName": "鈴木",
    "iconImageUrl": null, "followedByMe": true }
]
```

`followedByMe` は「**一覧を見ている人**がその相手をフォロー中か」を表す。
他人のフォロー一覧を見たときも、各行のボタン表示を正しく出せる。

**GET `/api/users/{username}`**（F-07 からの差分）

```json
{ "id": 1, "username": "user1", "displayName": "鈴木", "bio": null,
  "iconImageUrl": null, "createdAt": "2026-07-20T20:51:10.501968",
  "followingCount": 0, "followerCount": 1, "followedByMe": true }
```

### ステータスコード

| 状況 | コード |
|------|--------|
| 成功 | 200 |
| 未認証 | 401 |
| 存在しない @ユーザー名 | 404 |
| 自分自身をフォロー | 400 |
| 二重フォロー・未フォロー状態での解除 | 200（冪等に成功させる） |

## 設計判断

### フォロー／解除を冪等にする

二重フォローは `ON CONFLICT DO NOTHING` で、未フォロー状態からの解除は `DELETE` が0件削除で、
どちらもエラーにせず 200 を返す。目的の状態（フォロー中／解除済み）が達成されていれば成功と見なす。
通信の再送や連打でユーザーに無意味なエラーを見せないための設計で、いいね機能と揃えている。

### フォロー一覧はページングしない

現時点では全件を配列でそのまま返す。件数が数千件規模になったらページングが必要になるが、
学習アプリの規模では過剰なため見送った → 将来課題。

### フォロー解除に確認ダイアログを挟む

解除は取り消し操作にあたり、誤タップで気づかないうちにタイムラインから相手が消えると復旧しづらい。
既存の `DeleteConfirmDialog` に `confirmLabel` / `confirmingLabel` の任意 props を足して流用した
（省略時は「削除する」のままなので既存の呼び出しは無変更）。

## フロントエンド実装

### 画面・ルーティング

| パス | ページ |
|------|--------|
| `/users/:username/following` | `FollowListPage`（mode=following） |
| `/users/:username/followers` | `FollowListPage`（mode=followers） |

一覧の中身が違うだけで画面構造は同じなので、`mode` を props で渡して1つのページで共用する。
`useEffect` の依存配列に `mode` を入れているため、タブのリンクを踏むだけで再取得される。

### フォロー数はAPIの返り値で上書きする

`FollowButton` はフォロー状態が変わると `onChanged(status)` で親に最新状態を渡し、
親（`ProfilePage`）はそれで `followerCount` / `followedByMe` を**上書き**する。
画面側で ±1 する実装にすると、画面を開いたまま他の人がフォローしたときに実際の値とずれる。

### タブ切替は useEffect の依存配列で行う

`TimelinePage` は `timelineMode` ステートを持ち、一覧取得の `useEffect` の依存配列に入れている。
タブを押して値が変わると React が自動で再取得する。
併せてタブ切替時に `newPostsCount` を 0 に戻し、フォロー中タブではポーリングを止める。

## 既知の制限

- **フォロー中タブでは新着通知バナーが出ない**（新着APIが全体／フォロー中を区別しないため）
- **フォロー／フォロワー一覧はページングしない**（全件取得）
- **フォロー数の集計は毎回 COUNT する**。件数が増えたらカウンタ列のキャッシュ等が必要になる
- **フォロー中タイムラインは `LIMIT/OFFSET` 方式のページング**。全体タイムラインと同じ制限を持つ
- 通知機能はないため、フォローされたことは相手に伝わらない（フォロワー一覧で確認するのみ）
