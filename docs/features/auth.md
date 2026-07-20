# 機能詳細設計: 認証（signup / login / refresh / logout）

## 概要

ユーザー登録・ログイン・トークン再発行・ログアウトのバックエンドAPI。
当初「Phase 2」としていたユーザー登録（F-06）を、認証機能をひとまとまりで完成させるため認証フェーズで先行実装する。
フロントエンドは今回対象外のため、「ログイン後の画面」の代わりに認証必須の `GET /api/hello` を用意する
（トークンがあれば200、なければ401が返ることで認証フローが機能していることを確認できる）。

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
