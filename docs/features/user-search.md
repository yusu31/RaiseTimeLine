# 機能詳細設計: ユーザー検索（F-10）

## 概要

@ユーザー名・表示名の部分一致で他のユーザーを探せる。ヘッダーの🔍から専用画面（`/search`）へ遷移し、
検索結果をクリックするとそのユーザーのプロフィール（`/users/:username`）へ移動する。

フォロー（F-11）の入口はプロフィール画面にあるため、**この機能は「相手を見つける」ところまでを担当する**。
検索結果にフォローボタンは置かない。

## 技術方針

### 大文字小文字を区別しない検索に `ILIKE` を使う

```sql
WHERE username ILIKE '%' || #{keyword} || '%' ESCAPE '\'
   OR display_name ILIKE '%' || #{keyword} || '%' ESCAPE '\'
```

`ILIKE` は PostgreSQL の「大文字小文字を区別しない `LIKE`」。
`LOWER(username) LIKE LOWER(...)` と書く手もあるが、**列に関数をかけると通常のインデックスが使えなくなる**。
本プロジェクトは PostgreSQL 固定のため、DB固有の構文を許容して `ILIKE` を選んだ。

### LIKEのワイルドカードはService層でエスケープする

`%` と `_` は LIKE のワイルドカード。エスケープしないと **`%` の1文字検索が `LIKE '%%%'` となり全ユーザーに一致する。**
「空文字なら空配列を返す」という防御を入れていても、`%` 1文字では素通りしてしまう。

```java
private String escapeLikeWildcards(String keyword) {
    return keyword.replace("\\", "\\\\")   // ← 必ず最初に置換する
            .replace("%", "\\%")
            .replace("_", "\\_");
}
```

**バックスラッシュを最初に置換する。** 順番を逆にすると、後の処理が「自分で足したエスケープ文字」まで
二重に変換してしまい意味が壊れる。

なお `#{keyword}` を使っている限り **SQLインジェクションは発生しない**（MyBatis がプレースホルダとして値を渡すため）。
これは「SQLは壊れないが検索の意味が壊れる」という別種の問題。

### 空のキーワードではDBに問い合わせない

```java
if (trimmed.isEmpty()) {
    return List.of();
}
```

プロトタイプ（localStorage）は空欄で全件を表示していたが、実DBで全件を返すのは件数が増えたときに危険なため
**空配列を返す**。フロント側でも空欄のときはAPIを呼ばない。二重に防いでいる。

### Mapperの戻り値に専用クラスを作らない

フォロー一覧は `FollowUserDetail` という専用クラスを使っているが、あれは `follows` と `users` を結合し
さらに `followedByMe` を計算するために `users` に無い列が必要だったため。

ユーザー検索は `users` テーブルだけを見て余分な列も無いので、既存の `findByUsername` と同じく
**`User` をそのまま返す**。クラスを増やさない。

### 検索結果は `followedByMe` を持たない

`UserSearchResultResponse` は `id` / `username` / `displayName` / `iconImageUrl` のみ。
検索結果にフォローボタンを出さないため、フォロー状態を計算する必要がない。
結果が閲覧者に依存しないので、**Controller で認証ユーザーを受け取っていない**
（認証必須であることは `SecurityConfig` の `anyRequest().authenticated()` が担保する）。

### 入力は300msデバウンスする

打鍵のたびにAPIを呼ぶと、5文字入力しただけで5回のリクエストが飛ぶ。
入力が止まってから 300ms 後に検索する。

```tsx
useEffect(() => {
  const timerId = setTimeout(() => setDebouncedKeyword(keyword.trim()), SEARCH_DEBOUNCE_MS)
  return () => clearTimeout(timerId)
}, [keyword])
```

次の打鍵でクリーンアップ関数が前のタイマーを破棄するため、**最後の1回だけが生き残る**。

### 空欄に戻したときに state をリセットしない

`useEffect` の中で同期的に `setState` を呼ぶと再描画が連鎖する（ESLint `react-hooks/set-state-in-effect`）。
空欄のときは結果を描画しない分岐が既にあるので、**古い結果を消す必要がない**。
エラー表示だけ `debouncedKeyword !== '' && error` に絞って、前のキーワードのエラーが残らないようにしている。

## API

`GET /api/users?q={keyword}`（認証必須）。レスポンス例とステータスコードは
[docs/design.md](../design.md) の「レスポンス例」を参照。

## 画面

`UserSearchPage`（`frontend/src/pages/UserSearchPage.tsx`）。
読み込み中／エラー／未入力／該当なし／結果ありの5状態を持つ。
ワイヤーフレームは [docs/screen-design.md](../screen-design.md) の WF-06。

`UserListItem` のような共通コンポーネントへの切り出しは**行っていない**。
`FollowListPage` にも影響が及び、検索機能のPRに無関係な変更が混ざるため。必要になったら別Issueで扱う。

## 将来課題

| 項目 | 内容 |
|------|------|
| ページングなし | 上限50件で打ち切っている。ユーザー数が増えたら対応が必要 |
| インデックスが効かない | `LIKE '%...%'`（中間一致）は通常のB-treeインデックスを使えない。件数が増えたら `pg_trgm` 拡張やPostgreSQLの全文検索を検討する |
| 検索キーワードがURLに残らない | `/search?q=...` にしていないため、検索結果を共有できずリロードで消える |
