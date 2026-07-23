# 機能詳細設計: 投稿（タイムライン表示 / 投稿作成 / 編集 / 削除 / 画像投稿）

## 概要

タイムライン表示・投稿作成（F-02）、投稿の編集・削除（F-08）、画像投稿（F-05）をまとめて実装する。
F-08は当初Phase 2の予定だったが、投稿機能の基本操作の一部として捉え、F-02・F-05と同時にPhase 1で実装することにした
（詳細は [docs/requirements.md](../requirements.md) の機能一覧を参照）。
コメント機能（F-03）・いいね機能（F-04）は今回のスコープ外（次フェーズで対応）。

## 技術方針

### MapperはアノテーションとXMLを併用（今回からXMLマッパーを初導入）

`docs/features/auth.md`に「将来JOINを伴う複雑なクエリ（タイムライン取得など）が出てきたらXMLマッパーへの移行を検討する」と記載していた通り、
タイムライン取得は`posts`×`users`のJOINが必要になったため、ここでXMLマッパー（`PostMapper.xml`）を初導入する。

- 単純なCRUD（INSERT/UPDATE/DELETE、単票SELECT）は既存パターン通りアノテーション方式（`@Insert`/`@Update`/`@Delete`/`@Select`）を維持する
- JOINを伴うSELECT（タイムライン一覧・投稿詳細）のみXMLマッパーに分離する
- `application.yml`に`mybatis.mapper-locations: classpath:mapper/*.xml`を追加する必要がある

### 画像保存の抽象化: `StorageService`

画像は本番環境ではAWS S3に保存する方針が確定しているが、ローカル開発中に毎回S3バケットを用意するのは学習効率上望ましくない。
そのため`StorageService`インターフェース＋`LocalStorageService`（ローカルファイルシステム実装）で保存処理を抽象化した。

```java
public interface StorageService {
    String store(MultipartFile file);       // 保存し、DBに残す識別子（ファイル名）を返す
    String toPublicUrl(String storedPath);   // フロントのimg src用URLに変換
    void delete(String storedPath);          // 投稿削除時のファイル削除
}
```

- ローカル実装は`backend/uploads/`ディレクトリに保存し、`/uploads/**`で静的配信する（`.gitignore`対象）
- 将来のデプロイフェーズでは`S3StorageService implements StorageService`を追加し、Spring Profileで差し替えるだけで済む設計
- 画像バリデーション（拡張子・Content-Type・5MB以内）は`LocalStorageService`側で実施する

### 権限チェック: Spring Securityの`AccessDeniedException`を使わない理由

投稿の編集・削除で「他人の投稿を操作しようとした場合」に403を返す必要があるが、
Spring Securityが提供する`org.springframework.security.access.AccessDeniedException`は使わず、
独自の`PostAccessDeniedException`＋`GlobalExceptionHandler`への個別ハンドラ追加で対応した。

理由: 既存の`GlobalExceptionHandler`には`Exception.class`のcatch-allハンドラがあり、
`@RestControllerAdvice`はDispatcherServletの例外解決（`ExceptionHandlerExceptionResolver`）としてSpring Securityの
`ExceptionTranslationFilter`より内側（先）で解決される。そのため、Controller/Service層でSpring Securityの
`AccessDeniedException`を投げても、`SecurityConfig`で設定した`JsonAccessDeniedHandler`（403想定）には届かず、
catch-allに先に拾われて500になってしまう。専用例外＋既存の`ErrorResponse`統一フォーマットで返す方が安全かつ一貫している。

判定順序: ①投稿が存在しない → 404（`PostNotFoundException`）②存在するが他人の投稿 → 403（`PostAccessDeniedException`）。

## エンドポイント仕様

API一覧・レスポンス例・エラーレスポンス形式は [docs/design.md](../design.md) を参照。ここでは実装レベルの詳細のみ記載する。

| メソッド | パス | 処理概要 |
|---|---|---|
| GET | /api/posts | `size+1`件取得して`hasNext`を判定（`COUNT(*)`を別発行しない軽量な方式） |
| GET | /api/posts/{id} | 存在しなければ404 |
| POST | /api/posts | `multipart/form-data`。本文バリデーション→（画像があれば）`StorageService.store()`→INSERT→201 |
| PUT | /api/posts/{id} | JSONボディ。**本文のみ編集可、画像は変更不可**。所有者チェック→UPDATE→200 |
| DELETE | /api/posts/{id} | 所有者チェック→DELETE→（画像があれば）`StorageService.delete()`→200（空ボディ） |

### POSTだけmultipart・PUTはJSONという非対称設計にした理由

画像添付を伴う`POST`はSpring MVCの`@RequestParam`（`content`と`image`を個別に受け取る）で実装する。
JavaのrecordとMultipartFileの併用バインディングは不安定になりやすいため、あえて`@Valid @RequestBody`にしていない。
一方`PUT`は画像を扱わずJSONのみのため、既存の認証APIと同じ`@Valid @RequestBody`パターンを踏襲する。

### 例外→ステータスコード対応表

| 例外 | ステータス |
|---|---|
| `InvalidPostContentException`（本文が空・281文字以上） | 400 |
| `InvalidImageException`（非対応形式・5MB超） | 400 |
| `MaxUploadSizeExceededException`（Springのmultipart上限超過） | 400 |
| `PostNotFoundException` | 404 |
| `PostAccessDeniedException`（他人の投稿を操作） | 403 |

## 設計判断（要確認事項）

**投稿編集は本文のみとし、画像の変更は不可とした。** 静的プロトタイプ（`prototype/app.js`）の編集モーダルは画像も編集できる作りになっているが、
「Phase 1を作り込みすぎない」という`docs/requirements.md`のリスク方針（機能の作りすぎ＝スコープ膨張）に沿い、
今回は本文のみの編集にスコープを絞った。画像を変更したい場合は投稿を削除して再投稿する運用とする。

## セキュリティ設計

- `/uploads/**`は`SecurityConfig`で`permitAll`にする。`<img>`タグでの画像読み込みはブラウザがAuthorizationヘッダーを
  付与しないため、他のAPIと同じ「認証必須」のままだと画像が401で表示できなくなる
- アップロード画像はサーバー側でUUIDを採番したファイル名で保存する（クライアントから渡されたファイル名をそのまま使わない。パストラバーサル対策）
- 拡張子とContent-Typeの両方を検証する（`docs/design.md`のセキュリティ設計を踏襲）

## フロントエンド実装

`frontend/`にタイムライン画面（`/timeline`）を実装した。ログイン後の遷移先を暫定の`/welcome`（`GET /api/hello`を表示するだけの仮画面）から置き換え、`WelcomePage.tsx`・`GET /api/hello`前提のコード一式は削除した。

### ファイル構成

- `types/post.ts`: `Post`/`PostAuthor`/`PostListResponse`型
- `api/postApi.ts`: `fetchTimeline`/`createPost`/`updatePost`/`deletePost`。`useAuthorizedRequest`はフック（コンポーネント内でのみ呼べる）のため、呼び出し関数を引数として受け取る形にした
- `pages/TimelinePage.tsx`: タイムライン本体。投稿一覧・ページネーション（「もっと見る」）・投稿作成/編集/削除の状態管理をまとめて持つ
- `components/PostComposer.tsx`: 投稿フォーム（本文＋画像選択＋プレビュー＋文字数カウンター）
- `components/PostCard.tsx`: 投稿カード（自分の投稿のときのみ編集・削除ボタンを表示）
- `components/PostEditModal.tsx`: 編集モーダル（本文のみ）
- `components/DeleteConfirmDialog.tsx`: 削除確認ダイアログ（汎用）

### `api/client.ts`のFormData対応

画像付き投稿は`FormData`で送信する必要があるが、既存の`apiRequest`は`body`が`undefined`でなければ無条件で`JSON.stringify`し`Content-Type: application/json`を付与する実装だったため、そのままでは画像アップロードが壊れる。`body instanceof FormData`の場合は`JSON.stringify`せず`Content-Type`ヘッダーも付与しない（ブラウザに`multipart/form-data; boundary=...`を自動設定させる）よう修正した。

### 自分の投稿かどうかの判定

バックエンドのレスポンスに`isOwnedByMe`のようなフィールドは持たせず、フロントエンド側で`post.author.id === user.id`（`AuthContext`が保持するログインユーザー情報と比較）で判定している。バックエンドに真実の権限チェック（403を返す）があるため、フロント側の判定はあくまで表示の出し分け用。

### 状態更新の方針

投稿作成・編集・削除のたびにタイムライン全体を再取得するのではなく、成功したレスポンスを使ってローカルの配列を直接更新する（作成は先頭に追加、編集は該当要素を置き換え、削除は該当要素を除去）。ページネーション中の一覧が再取得によって崩れるのを防ぐため。

## 既知の制限

- 画像は1枚まで（複数枚添付は将来の拡張候補）
- 画像編集は不可（変更したい場合は削除→再投稿）
- ローカル環境の`backend/uploads/`はバックアップの仕組みがない（学習用途のため許容）
- `likeCount`/`commentCount`/`likedByMe`はF-03/F-04未実装のため`0`/`0`/`false`固定で返す
