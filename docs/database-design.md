# データベース設計書

## RaiseTimeLine（仮称）

ER図・テーブル定義・インデックス設計を定義する。
API設計は [設計書（design.md）](./design.md) を参照。

---

## 1. ER図

> ER図（Entity Relationship Diagram）＝「テーブル同士がどうつながっているか」を表した図。
> `||--o{` は「1対多」（例：1人のユーザーが多数の投稿を持つ）を意味する。GitHub上で自動的に図として表示される。

```mermaid
erDiagram
    users ||--o{ posts : "投稿する"
    users ||--o{ comments : "コメントする"
    users ||--o{ likes : "いいねする"
    users ||--o{ refresh_tokens : "持つ"
    posts ||--o{ comments : "コメントされる"
    posts ||--o{ likes : "いいねされる"

    users {
        bigint id PK
        varchar display_name "表示名"
        varchar email UK "メールアドレス（重複不可）"
        varchar password_hash "BCryptハッシュ"
        text bio "自己紹介（Phase 2）"
        timestamp created_at
        timestamp updated_at
    }

    posts {
        bigint id PK
        bigint user_id FK "投稿者"
        varchar content "本文（280文字以内）"
        varchar image_path "画像パス（NULL可）"
        timestamp created_at
        timestamp updated_at
    }

    comments {
        bigint id PK
        bigint post_id FK "対象の投稿"
        bigint user_id FK "コメントした人"
        varchar content "本文（280文字以内）"
        timestamp created_at
    }

    likes {
        bigint id PK
        bigint post_id FK "対象の投稿"
        bigint user_id FK "いいねした人"
        timestamp created_at
    }

    refresh_tokens {
        bigint id PK
        bigint user_id FK "トークンの持ち主"
        varchar token UK "トークン値（UUID）"
        timestamp expires_at "有効期限"
        timestamp created_at
    }
```

### 設計のポイント（学習メモ）

1. **いいね数・コメント数は列として持たない。**
   `likes` / `comments` の行数を COUNT で数えて算出する（導出値）。
   数を列に持つと「実際の行数と数字がずれる」事故が起きるため、まずは都度集計が安全。
   （大規模SNSでは高速化のためにカウンタ列を持つこともある＝カウンタキャッシュ。今回は発展知識として知っておくだけでよい）
2. **二重いいねはDBの制約で防ぐ。**
   `likes` に（post_id, user_id）の**ユニーク制約**を張る。アプリのコードでチェックしても、
   同時リクエスト（連打）はすり抜けることがあるため、最後の砦はDBに置く。
3. **外部キー（FK）で「存在しない投稿へのコメント」を防ぐ。**
   comments.post_id は posts.id を参照する外部キーにする。親の投稿が消えたら
   コメント・いいねも一緒に消えるように `ON DELETE CASCADE` を設定する（Phase 2 の投稿削除で効いてくる）。

---

## 2. テーブル定義

### users（ユーザー）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|----|------|-----------|------|
| id | BIGSERIAL | 不可 | 自動採番 | 主キー |
| display_name | VARCHAR(50) | 不可 | - | 表示名（タイムラインに表示される名前） |
| email | VARCHAR(255) | 不可 | - | メールアドレス（ログインID）。ユニーク制約 |
| password_hash | VARCHAR(255) | 不可 | - | BCryptでハッシュ化したパスワード |
| bio | TEXT | 可 | NULL | 自己紹介（Phase 2 のプロフィール機能で使用） |
| created_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | 更新日時 |

### posts（投稿）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|----|------|-----------|------|
| id | BIGSERIAL | 不可 | 自動採番 | 主キー |
| user_id | BIGINT | 不可 | - | 投稿者。users.id への外部キー |
| content | VARCHAR(280) | 不可 | - | 本文（1〜280文字。アプリ側でもバリデーション） |
| image_path | VARCHAR(255) | 可 | NULL | 添付画像の保存パス（画像なしの場合は NULL） |
| created_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | 投稿日時（タイムラインの並び順に使用） |
| updated_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | 更新日時（Phase 2 の編集機能で使用） |

### comments（コメント）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|----|------|-----------|------|
| id | BIGSERIAL | 不可 | 自動採番 | 主キー |
| post_id | BIGINT | 不可 | - | 対象の投稿。posts.id への外部キー（ON DELETE CASCADE） |
| user_id | BIGINT | 不可 | - | コメントしたユーザー。users.id への外部キー |
| content | VARCHAR(280) | 不可 | - | コメント本文（1〜280文字） |
| created_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | コメント日時 |

### likes（いいね）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|----|------|-----------|------|
| id | BIGSERIAL | 不可 | 自動採番 | 主キー |
| post_id | BIGINT | 不可 | - | 対象の投稿。posts.id への外部キー（ON DELETE CASCADE） |
| user_id | BIGINT | 不可 | - | いいねしたユーザー。users.id への外部キー |
| created_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | いいねした日時 |

> **ユニーク制約:** (post_id, user_id) — 同じユーザーが同じ投稿に2回いいねできない

### refresh_tokens（リフレッシュトークン）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|----|------|-----------|------|
| id | BIGSERIAL | 不可 | 自動採番 | 主キー |
| user_id | BIGINT | 不可 | - | トークンの持ち主。users.id への外部キー（ON DELETE CASCADE） |
| token | VARCHAR(255) | 不可 | - | トークン値（UUID）。ユニーク制約 |
| expires_at | TIMESTAMP | 不可 | - | 有効期限（期限切れトークンは使用不可） |
| created_at | TIMESTAMP | 不可 | CURRENT_TIMESTAMP | 発行日時 |

---

## 3. 列挙値（Enum）の定義

現時点で固定値カラムはなし。
（Phase 3 のフォロー機能や将来の通知機能を実装する際に、通知種別などで必要になる可能性がある）

---

## 4. インデックス設計

> インデックス＝本の「索引」。検索を速くする仕組み。よく検索条件・並び替えに使う列に張る。

| テーブル | カラム | 種別 | 理由 |
|---------|--------|------|------|
| users | email | UNIQUE | ログイン時にメールアドレスで検索する。重複防止も兼ねる |
| posts | created_at | INDEX | タイムラインは常に「新着順」で並べるため |
| posts | user_id | INDEX | Phase 2 のプロフィール画面で「特定ユーザーの投稿一覧」を取得するため |
| comments | post_id | INDEX | 投稿詳細でその投稿のコメントを取得する・コメント数を数えるため |
| likes | (post_id, user_id) | UNIQUE | 二重いいね防止。post_id での検索（いいね数の集計）にも使える |
| refresh_tokens | token | UNIQUE | トークン再発行時にトークン値で検索するため |

---

## 5. マイグレーション実行順序（Flyway）

> Flyway は `V1__xxx.sql` のような連番ファイルを順番に実行して、DBの状態をバージョン管理するツール。
> 外部キーの参照先（親テーブル）を先に作る必要があるため、順序が重要。

| 順序 | ファイル名（予定） | 内容 |
|------|------------------|------|
| V1 | V1__create_users.sql | users テーブル作成 |
| V2 | V2__create_posts.sql | posts テーブル作成（users を参照） |
| V3 | V3__create_comments.sql | comments テーブル作成（users, posts を参照） |
| V4 | V4__create_likes.sql | likes テーブル作成＋ユニーク制約（users, posts を参照） |
| V5 | V5__create_refresh_tokens.sql | refresh_tokens テーブル作成（users を参照） |
| V6 | V6__insert_seed_users.sql | Phase 1 用のテストユーザー投入（シードデータ） |
