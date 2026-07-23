# 機能詳細設計: 認証（signup / login / refresh / logout）

## 概要

ユーザー登録・ログイン・トークン再発行・ログアウトの認証機能（バックエンドAPI＋フロントエンド画面）。
当初「Phase 2」としていたユーザー登録（F-06）を、認証機能をひとまとまりで完成させるため認証フェーズで先行実装する。
バックエンド実装時点ではフロントエンドが未着手だったため、「ログイン後の画面」の代わりに認証必須の `GET /api/hello` を用意していた。
フロントエンド実装後は、このAPIをそのまま「ログイン後の仮画面（`/welcome`）」の表示内容として使っている
（タイムライン画面がまだ無いための代替。トークンがあれば200、なければ401が返ることで認証フローが機能していることも確認できる）。

## 技術方針: MyBatisを採用（JPAではない）

ORマッパーは **Spring Data JPA ではなく MyBatis** を使用する。SQLを自分で書くことで、実行されるクエリを意識しながら学べると判断した。
プロジェクト全体の技術方針（`CLAUDE.md`・`docs/tech-stack.md`）は本Issueの実装をもって更新する。

- **Mapperの実装方式はアノテーション方式を採用**（`@Insert`/`@Select`/`@Delete`）。今回のクエリは6個程度の単純なCRUD（INSERT/SELECT/DELETE、JOINなし）のため、XMLマッパーより完結でJavaコードだけで追いやすい。将来Phase 2以降でJOINを伴う複雑なクエリ（タイムライン取得など）が出てきたらXMLマッパーへの移行を検討する
- `mybatis.configuration.map-underscore-to-camel-case: true` を設定必須（DBはsnake_case、Javaはcamel）
- MyBatisはSQLの型チェックがコンパイル時に効かない。JPAの導出クエリと違い、SQL文字列のタイポは実行時までわからないため、テスト・curl動作確認を必ず行う

## エンドポイント仕様

| メソッド | パス | 認証 | 処理概要 |
|---|---|---|---|
| POST | /api/auth/signup | 不要 | email重複チェック→409 / BCryptハッシュ化→User保存→トークン2種発行→201+AuthResponse（登録後そのままログイン状態） |
| POST | /api/auth/login | 不要 | email検索→matches()不一致 or 未登録は同一の401「メールアドレスまたはパスワードが正しくありません」（存在有無を漏らさない）→200+AuthResponse |
| POST | /api/auth/refresh | 不要（リフレッシュトークン必須） | token検索→無い/期限切れ→401（期限切れは見つけ次第DBから削除）→200+新accessToken |
| POST | /api/auth/logout | 必要 | リクエストのrefreshTokenをdeleteByToken（@Transactional必須）→200 |
| GET | /api/hello | 必要 | SecurityContextのAuthenticatedUserから `{"message": "Hello, <displayName>さん！ログイン認証に成功しました。"}` を返す。**フロントの「ログイン後の仮画面」の代替**（フロント実装時に削除・置き換え予定） |

### リクエスト/レスポンス形式

**SignupRequest**: `{ "email", "displayName", "password" }`
**LoginRequest**: `{ "email", "password" }`
**RefreshTokenRequest**（refresh/logout共用）: `{ "refreshToken" }`

**AuthResponse**（signup/login）:
```json
{
  "accessToken": "...",
  "refreshToken": "<UUID>",
  "user": { "id": 1, "displayName": "鈴木", "email": "suzuki@example.com" }
}
```

**RefreshResponse**（refresh）: `{ "accessToken": "..." }`

**ErrorResponse**（共通）: `{ "status": 400, "error": "Bad Request", "message": "..." }`

### バリデーション（プロトタイプ app.js の実装仕様に準拠）

- `email`: 必須・メール形式・255文字以内
- `displayName`: 必須・50文字以内
- `password`: 必須・8文字以上72文字以内（72はBCryptの入力上限）

## JWT設計

- アクセストークン: 有効期限30分。`Authorization: Bearer <token>` ヘッダーで送信
- リフレッシュトークン: 有効期限14日。UUID形式。DBの `refresh_tokens` テーブルに保存し、ログアウト時に削除して無効化
- JWTは**DB非依存の自己完結型**: 発行時にuserId(subject)・email・displayNameをclaimsに埋め込む。`JwtAuthenticationFilter`はトークン検証成功後にDBを引かず、そのままprincipal（`AuthenticatedUser`）としてSecurityContextへセットする
- リフレッシュトークンのローテーションは行わない（シンプルさ優先。将来的な改善候補）

## 採用しなかった構成とその理由

- **UserDetailsService / AuthenticationManagerは使わない**: ログイン照合は`AuthService`が`passwordEncoder.matches()`を直接呼ぶ簡易構成。JWT構成でフォームログインの仕組みを経由しない方が初学者にコードが追いやすいため
- **XMLマッパーは使わない**（上記のMyBatis方針を参照）
- **フィルタ内でトークン不正・期限切れを検出しても例外を投げない**: 「何もセットせずchainを進める」設計にし、後段の`JsonAuthenticationEntryPoint`が401 JSONを返す。フィルタ内例外は`@RestControllerAdvice`に届かないため

## フロントエンド実装

`frontend/` を今回新規に構築した（React 19 + TypeScript + Vite + Tailwind CSS + React Router。バージョンは`docs/tech-stack.md`参照）。

### 画面・ルーティング

| パス | 画面 | 説明 |
|---|---|---|
| `/login` | ログイン画面 | email/passwordでログイン。ログイン済みなら`/welcome`へリダイレクト（`GuestRoute`） |
| `/signup` | 新規登録画面 | email/displayName/passwordで登録。**プロトタイプにある「ユーザー名（@handle）」項目はバックエンドの`SignupRequest`に存在しないため今回は含めていない**（プロフィール機能=F-07実装時に追加検討） |
| `/welcome` | ログイン後の仮画面 | 未ログインなら`/login`へリダイレクト（`ProtectedRoute`）。表示内容は`GET /api/hello`のレスポンス。タイムライン（F-02）実装時に置き換える |

### 状態管理・トークンの持ち方

- `AuthContext`（`context/AuthContext.ts` + `context/AuthProvider.tsx` + `hooks/useAuth.ts`）でログイン状態を管理する
  - コンポーネントとフックを同じファイルからexportすると ESLint の `react-refresh/only-export-components` に引っかかるため3ファイルに分割した
- `accessToken` / `refreshToken` / `user` をまとめて `localStorage`（キー: `raisetimeline.auth`）に保存し、リロード後もログイン状態を維持する
- **既知の制限:** 本来はXSS対策として`accessToken`はメモリ（React state）のみで保持するほうが安全。今回は最小実装としてlocalStorageにまとめて保存する方式にした
- `/welcome`画面に**ログアウトボタン**を実装済み（Issue #13）。`POST /api/auth/logout`を呼んでリフレッシュトークンをDBから削除し、ローカルの認証状態（Context・localStorage）を破棄してログイン画面へ遷移する。ログアウトAPI呼び出しが失敗してもローカルの状態は必ず破棄する（`try/finally`）

### APIとの通信

- `vite.config.ts` に `/api` → `http://localhost:8080` のプロキシを設定し、フロントのfetchは相対パス（`/api/auth/login`等）で呼び出す（TaskManagementと同じ方式）
- `api/client.ts` の `apiRequest` が共通のfetchラッパー。エラー時はバックエンドの`ErrorResponse`から`message`を取り出し`ApiError`としてthrowする
- **バグ修正（Issue #13）:** `apiRequest`は当初「レスポンスが204のときだけ本文なし」として扱っていたが、`POST /api/auth/logout`は本文なしの**200**を返すため、`response.json()`が空文字列のパースに失敗してエラーになっていた。ステータスコードで判定するのではなく、**本文が空文字列かどうか**で判定する方式に修正した

### アクセストークンの自動リフレッシュ

バックエンドは実装当初からアクセストークン（30分）＋リフレッシュトークン（14日、DB保存）の2トークン構成だったが、
フロントエンドは`refreshToken`を保存するだけで実際には使っていなかった（アクセストークン切れ後は401になるだけ）。
これを解消するため、認証必須API呼び出し用の `hooks/useAuthorizedRequest.ts` を追加した。

- 呼び出し先が401を返したら、保持している`refreshToken`で`POST /api/auth/refresh`を呼び、新しい`accessToken`を取得して**元のリクエストを1回だけ自動的に再試行する**
- リフレッシュ自体も失敗する場合（リフレッシュトークンが無効・期限切れ）は`logout()`でログイン状態を破棄する。`ProtectedRoute`が反応して自動的に`/login`へ戻る
- 現時点で認証必須APIは`GET /api/hello`のみだが、Phase 2以降で投稿・いいね・コメントなど認証必須APIが増える前提で、特定のAPIに依存しない汎用フックとして作った
- 動作確認は、正規にログイン後に`localStorage`の`accessToken`だけを不正な値に書き換えて再アクセスし、「401→自動リフレッシュ→再試行成功」を確認。さらに`refreshToken`も無効な値にして、「refresh自体が401→自動ログアウト→`/login`へリダイレクト」も確認した（Playwrightでの自動テストによる）
