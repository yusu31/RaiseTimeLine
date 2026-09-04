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
| 画像トリミング | react-easy-crop | 6.x | アイコン画像の位置・拡大率の調整に使用（F-11後に追加）。ドラッグ・ピンチ操作と円形の切り抜き枠に対応しており、自前実装より確実。MITライセンス |
| テスト実行 | Vitest | 4.1.x | Viteの設定（`vite.config.ts`）をそのまま共有できるため、設定の二重管理が起きない。peer で `vite ^8` に対応済み |
| コンポーネントテスト | React Testing Library | 16.3.x | 内部状態ではなく「画面に何が表示され、操作で何が起きるか」を検証する方針に合う。peer で React 19 に対応済み |
| DOM環境 | jsdom | 30.x | Node上に仮想DOMを用意する。実ブラウザを起動しないため高速 |

> **`package.json` の `overrides` について:** `eslint-plugin-react@7.37.5` は peerDependencies で
> `eslint ^9.7` までしか宣言しておらず、本プロジェクトの eslint 10 と衝突して
> **新しいパッケージを一切追加できない状態**だった。実際には eslint 10 で正常に動作しているため、
> `overrides` で peer の要求をプロジェクトの eslint に読み替えている。
> `--legacy-peer-deps` はコマンドに付けるだけで記録が残らず、次に `npm install` する人が同じ問題に当たるため採用しなかった。
> eslint-plugin-react が eslint 10 に対応したら削除してよい。

### フロントエンドのテスト方針

| 項目 | 内容 |
|------|------|
| 実行コマンド | `npm test`（監視モード・開発中用） / `npm run test:run`（1回実行・PR前とCI用） |
| テストファイルの置き場所 | 対象ファイルと同じディレクトリに `対象名.test.ts(x)` を置く |
| 共通設定 | `src/test/setup.ts`（jest-domの読み込みと、各テスト後の後片付け） |
| グローバル関数 | **使わない**（`globals: false`）。`describe` / `it` / `expect` は各ファイルで明示的にimportする |
| タイムゾーン | `vite.config.ts` の `test.env.TZ` で `Asia/Tokyo` に固定 |

**テストは次の3種類に分類して書く。**

| 種類 | 対象 | 検証すること | 実装例 |
|------|------|------------|--------|
| 純粋関数 | `src/utils/*` | 入力に対する戻り値。特に境界値 | `formatDateTime.test.ts` |
| 表示 | コンポーネント | propsを渡したとき画面に何が出るか・何が出ないか | `PostCard.test.tsx` |
| ユーザー操作 | コンポーネント | クリック・入力の結果、コールバックが呼ばれるか | `LikeButton.test.tsx` |

> **タイムゾーンを固定する理由:** `formatDateTime` は `getFullYear()` / `getHours()` を使うため、
> 実行するPCの時刻設定で結果が変わる。固定しないと「自分の環境では通るがCIでは落ちる」という
> 再現困難な失敗が起きる。実際に `TZ` を `UTC` に変えるとテストが落ちることを確認済み。

> **`globals: false` を選んだ理由:** グローバル関数にすると設定は短くなるが、
> どこから来た関数か読んで分からなくなる。またESLintの未定義変数チェックのために
> 追加設定が必要になる。importを1行書く手間より、読みやすさと設定の単純さを優先した。

> **相対時刻のテストで時計を止める理由:** `formatRelativeTime` は `Date.now()` を使うため、
> そのままでは実行するたびに結果が変わる。`vi.setSystemTime()` で基準時刻を固定し、
> 「59秒前はたった今 / 60秒前は1分前」といった境界値を安定して検証できるようにしている。

## バックエンド

| カテゴリ | 使用技術 | バージョン | 選定理由 |
|----------|----------|-----------|---------|
| 言語 | Java | 21 | TaskManagementと同一のLTS版 |
| フレームワーク | Spring Boot | 3.4.5 | RaiseTechの講義で使用。TaskManagementと同一バージョン |
| 認証 | Spring Security + JWT | Boot同梱 + jjwt | 講義（No.24〜）がJWT方式のため。アクセストークン＋リフレッシュトークン構成 |
| ORマッパー | MyBatis | mybatis-spring-boot-starter 3.0.4 | SQLを自分で書くことで、実行されるクエリを意識しながら学べると判断した |
| DBマイグレーション | Flyway | Boot同梱 | 講義で導入するツール。DBの変更履歴をSQLファイルで管理できる |
| API仕様書 | springdoc-openapi | 2.8.8 | TaskManagementと同一。エンドポイントの動作確認（Swagger UI）に便利 |
| 画像ストレージ | AWS SDK for Java v2（`s3`） | BOM 2.54.9 | 画像のS3保存に使用。v1はメンテナンスモードで新規採用の対象外。個々の依存にバージョンを書かずBOMで一括管理する |
| ビルドツール | Gradle | 8.x | 前回課題と同じ |

> **`-Xlint:deprecation` を有効にしている**（`build.gradle` の `compileJava`）。
> AWS SDK 導入時に `DefaultCredentialsProvider.create()` が非推奨であることをこの警告で検知できたため、
> 以後も非推奨APIの使用に気づける状態を維持する。現在この警告は0件。

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
| 画像ストレージ | S3 | **確定・実装済み**（2026-09-02） | 投稿画像・アイコン画像の保存先。`StorageService` の実装を `app.storage.type` で切り替える方式にした。既定はローカル保存で、設定漏れ時にS3が有効化されて課金が発生しないようにしてある。バケット名・IAM・公開方針は [infrastructure.md](./infrastructure.md) を参照 |
| クラウド | AWS | 前提 | 講義・前回課題と同じ。転職市場での需要が高い |
| サーバー構成 | EC2 + RDS（PostgreSQL） + ALB | 前提 | 構成図は [infrastructure.md](./infrastructure.md) を参照。サーバー構築方式の詳細はデプロイフェーズで確定 |
| IaC | Terraform | 前提 | 前回課題で使用。インフラをコードで管理 |

## 共通

| カテゴリ | 使用技術 | 選定理由 |
|----------|----------|---------|
| バージョン管理 | Git / GitHub | 業界標準。Issue → ブランチ → PR のワークフローを厳守 |
| エディタ | Cursor / Claude Code | AI補助で開発効率を上げる |

---

## CI（GitHub Actions）

**設定ファイル:** `.github/workflows/ci.yml`

`main` 宛てのPR作成時と、`main` へのpush時に、フロントエンドとバックエンドの検証を自動実行する。

| ジョブ | 実行内容 | ローカルでの対応コマンド |
|--------|---------|------------------------|
| `frontend` | `npm ci` → `npm run lint` → `npm run test:run` → `npm run build` | 品質チェック（フロントエンド）と同じ |
| `backend` | PostgreSQL 17 のサービスコンテナを起動 → `./gradlew cleanTest build` | 品質チェック（バックエンド）と同じ |

2つのジョブは並列に実行される。互いに依存しないため、直列にする理由がない。

### 実行環境のバージョン

| 項目 | 値 | 根拠 |
|------|-----|------|
| Node.js | 24 | ローカルの実測値 v24.15.0 に合わせる |
| Java | 21（temurin） | `build.gradle` の toolchain 指定 |
| Gradle | 8.14.5 | リポジトリ同梱の wrapper をそのまま使う |
| PostgreSQL | 17 | `docker-compose.yml` と同一 |

> **バージョンを固定する理由:** CIとローカルで実行環境が違うと、「手元では通るのにCIで落ちる」
> （またはその逆）という、原因の切り分けが難しい失敗が起きる。CIは環境の差を検出する装置ではなく、
> **コードの誤りを検出する装置**にしたいので、環境側の変数は固定する。

> **`npm install` ではなく `npm ci` を使う理由:** `npm ci` は `package-lock.json` のとおりに
> 依存関係を厳密に入れ直す。`npm install` はバージョン範囲の指定によっては
> ロックファイルより新しいものを入れることがあり、ローカルとCIで別のコードを検証してしまう。

### テストDBの用意

バックエンドのテストは実際の PostgreSQL に接続する（モックではない）ため、CI側でもDBが必要になる。
サービスコンテナで `postgres:17` を起動し、`POSTGRES_DB` に `raisetimeline_test` を指定している。

| 環境 | `raisetimeline_test` を作る方法 |
|------|------------------------------|
| ローカル | `docker/postgres/init/01_create_test_db.sql` が初回起動時に実行される |
| CI | サービスコンテナの `POSTGRES_DB` 環境変数で最初から作らせる |

> **`--health-cmd pg_isready` を指定している理由:** DBコンテナは起動命令が通った直後には
> まだ接続を受け付けられない。待たずにテストを始めると接続エラーで落ちるため、
> `pg_isready`（接続可能な状態かを調べるコマンド）が成功するまで待たせている。

### テストの実行件数を必ず表示する

**`./gradlew build` は、テストが1件も実行されなくても `BUILD SUCCESSFUL` と表示する。**
「緑になった」ことと「検証された」ことは別である。これを取り違えないよう、2つの対策をしている。

| 対策 | 内容 |
|------|------|
| `cleanTest` を先に実行する | Gradleは入力が変わらないとテストを `UP-TO-DATE` として飛ばす。飛ばしても成功扱いになるため、毎回強制的に実行させる |
| `build.gradle` の `afterSuite` | テスト全体の集計結果（実行件数・成功・失敗・スキップ）をログに出力する。Gradleは既定では件数を表示しない |

出力例（ローカル・CI共通）:

```
テスト結果: SUCCESS / 実行 98 件 (成功 98 / 失敗 0 / スキップ 0)
```

フロントエンド側（Vitest）も同様に `Tests 25 passed (25)` と件数が出る。
**どちらも、件数が表示されていることまで確認して初めて「テストが通った」と判断する。**

### `backend/gradlew` の実行権限

`backend/gradlew` は Git 上で実行可能（`100755`）として記録している。

> **理由:** Windows はファイルの実行権限を扱わないため、Windows で作成・コミットすると
> `100644`（実行権限なし）で記録されることがある。GitHub Actions は Linux 上で動くため、
> その状態では `./gradlew: Permission denied` で必ず失敗する。
> ワークフロー内で `chmod +x` する方法もあるが、実行権限はファイル自体の属性であって
> CIの手順ではない。ワークフローが増えるたびに書き足す必要が出るため、リポジトリ側の記録を直した。
> 修正コマンド: `git update-index --chmod=+x backend/gradlew`

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
