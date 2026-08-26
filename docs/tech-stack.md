# 技術スタック

## RaiseTimeLine（仮称）

使用技術・バージョン・選定理由を定義する。

> **バージョン方針（講師指示）:** 前回課題 TaskManagement と同じバージョンを使用する。
> 下表のバージョンは TaskManagement の実物（build.gradle / package.json / docker-compose.yml）を確認して合わせた。

---

## フロントエンド

| カテゴリ | 使用技術 | バージョン | 選定理由 |
|----------|----------|-----------|---------|
| 言語 | TypeScript | ~6.0 | 型安全で開発時のミスを減らせる。TaskManagementと同一 |
| ライブラリ | React | 19.2.x | TaskManagementと同一 |
| ビルドツール | Vite | 8.x | 高速な開発サーバー。TaskManagementと同一 |
| ルーティング | React Router | 7.x | ログイン画面⇄タイムライン⇄投稿詳細の画面遷移に必要（今回から追加。TaskManagementは単一画面のため不使用だった） |
| スタイリング | Tailwind CSS | 4.x | ユーティリティクラスで素早くUIを組める（今回から追加） |
| HTTPクライアント | fetch API（標準） | - | 標準機能で十分。追加ライブラリ不要 |
| 状態管理 | React useState / Context | - | この規模なら外部ライブラリ不要。ログインユーザー情報は Context で保持 |

## バックエンド

| カテゴリ | 使用技術 | バージョン | 選定理由 |
|----------|----------|-----------|---------|
| 言語 | Java | 21 | TaskManagementと同一のLTS版 |
| フレームワーク | Spring Boot | 3.4.5 | RaiseTechの講義で使用。TaskManagementと同一バージョン |
| 認証 | Spring Security + JWT | Boot同梱 + jjwt | 講義（No.24〜）がJWT方式のため。アクセストークン＋リフレッシュトークン構成 |
| ORマッパー | MyBatis | mybatis-spring-boot-starter 3.0.4 | SQLを自分で書くことで、実行されるクエリを意識しながら学べると判断した |
| DBマイグレーション | Flyway | Boot同梱 | 講義で導入するツール。DBの変更履歴をSQLファイルで管理できる |
| API仕様書 | springdoc-openapi | 2.8.8 | TaskManagementと同一。エンドポイントの動作確認（Swagger UI）に便利 |
| ビルドツール | Gradle | 8.x | 前回課題と同じ |

## SQLの記述方針（MyBatis）

**SQLはすべて Mapper XML に記述する。Javaのアノテーション（`@Select` / `@Insert` / `@Update` / `@Delete`）は使わない。**

| 項目 | ルール |
|------|--------|
| SQLの置き場所 | `backend/src/main/resources/mapper/{Mapper名}.xml` の1か所のみ |
| Mapperインターフェース | `@Mapper` とメソッド定義のみを持つ。SQLは書かない |
| 引数 | 単一引数でも `@Param` を明示する |
| 自動採番の取得 | `<insert useGeneratedKeys="true" keyProperty="id">` を使う |
| XMLの読み込み設定 | `application.yml` の `mybatis.mapper-locations: classpath:mapper/*.xml`（本番・テスト共通） |
| カラム名の対応 | `mybatis.configuration.map-underscore-to-camel-case: true` によりスネークケース列を自動でキャメルケースに変換する（`author_username` → `authorUsername`） |

**この方針にした理由:**

- 当初は「JOINを伴うものだけXML、単純なCRUDはアノテーション」と書き分けていたが、SQLを探すのに毎回2か所を見る必要があり可読性を損ねていた
- アノテーション方式ではSQLがJavaの文字列リテラルになるため、改行のたびに `" + "` の連結が必要で、SQL自体が読みづらくなる
- SQLがXMLに集約されていれば、Javaを読まずにSQLだけをレビューできる
- `@Param` を明示するのは、コンパイラの `-parameters` オプション（Spring Bootが暗黙に有効化している）への依存をなくすため。ビルド設定の変更で全クエリが動かなくなる事故を防ぐ

---

## データベース

| カテゴリ | 使用技術 | バージョン | 選定理由 |
|----------|----------|-----------|---------|
| データベース | PostgreSQL | 17 | TaskManagementと同一（docker image: postgres:17） |
| ローカル環境 | Docker + docker-compose | - | 環境構築を簡単にするためコンテナで動かす |

## インフラ・デプロイ（S3は確定・その他は前提）

| カテゴリ | 使用技術 | 状態 | 選定理由 |
|----------|----------|------|---------|
| 画像ストレージ | S3 | **確定**（本番） | 投稿画像・アイコン画像の保存先。ローカル開発中はファイルシステム保存で代替し、`StorageService`抽象化でS3実装に切替可能な設計にした |
| クラウド | AWS | 前提 | 講義・前回課題と同じ。転職市場での需要が高い |
| サーバー構成 | EC2 + RDS（PostgreSQL） + ALB | 前提 | 構成図は [infrastructure.md](./infrastructure.md) を参照。サーバー構築方式の詳細はデプロイフェーズで確定 |
| IaC | Terraform | 前提 | 前回課題で使用。インフラをコードで管理 |

## 共通

| カテゴリ | 使用技術 | 選定理由 |
|----------|----------|---------|
| バージョン管理 | Git / GitHub | 業界標準。Issue → ブランチ → PR のワークフローを厳守 |
| エディタ | Cursor / Claude Code | AI補助で開発効率を上げる |

---

## ポート番号（固定・変更禁止）

| サーバー | ポート | 備考 |
|---------|--------|------|
| React（フロントエンド） | **5173** | Viteのデフォルトポート（TaskManagementと同一） |
| Spring Boot（バックエンド） | **8080** | application.yml のデフォルト |
| PostgreSQL（データベース） | **5432** | docker-compose で起動 |

> **なぜポートを固定するか:** フロントエンドのAPI呼び出し先とバックエンドのCORS設定が特定のポートを前提にしているため。別ポートで動かすと通信が失敗する。

---

## 採用しない技術と理由

| 技術 | 採用しない理由 |
|------|--------------|
| セッション方式の認証 | 講義がJWT方式で進むため。JWTのほうがスケーラビリティが高いという講義内容も踏まえた |
| JOOQ | 講師いわく「少し使いづらい」 |
| Spring Data JPA | 認証機能の実装フェーズでMyBatisへ変更（当初はJPAを想定していたが、SQLを自分で書く学習効果を優先し撤回） |
| Next.js | SSR（サーバー側レンダリング）が不要なSPA構成のため。Vite + React で十分 |
| Redux | Context API で十分な規模。学習コストに見合わない |
| GraphQL | REST API で十分。学習コストが高い |
| WebSocket | リアルタイム更新（通知など）はMVP後に検討 → F-12（タイムラインの新着チェック）で、WebSocketではなく定期チェック＋通知バナー方式（X/Twitter方式）を採用することで決着した |
| カウンタキャッシュ | いいね数・コメント数はCOUNT集計で十分な規模。数字ずれ事故のリスクを避ける |
| MyBatisのアノテーション方式（`@Select` 等） | SQLの置き場所がXMLと2か所に分かれて可読性が落ちるため、XML方式に一本化した。詳細は「SQLの記述方針（MyBatis）」を参照 |
