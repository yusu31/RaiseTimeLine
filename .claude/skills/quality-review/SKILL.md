---
name: quality-review
description: RaiseTimeLine プロジェクトの品質チェックスキル。ユーザーが「品質チェックして」「lintチェックして」「ESLintエラーを確認して」「バックエンドのビルドチェックして」「ドキュメントと実装が合ってるか確認して」「コードレビューポイントを確認して」などと言った場合は必ずこのスキルを使うこと。フロントエンド・バックエンド・ドキュメント整合性の3レイヤーを確認する。
---

# 品質レビュースキル（Quality Review）

RaiseTimeLineプロジェクトの品質チェックを行うスキル。
フロントエンド・バックエンド・ドキュメント整合性の3つのレイヤーを確認する。

---

## ルール

- 品質チェック作業はすべて **1つのIssue + 1つのPR** でまとめて対応する
- ドキュメントは**実装を「正」として修正**する（ドキュメントに合わせて実装を変えない）

---

## フロントエンド：ESLint実行・ビルド確認・Reactアンチパターンチェック

### 実行コマンド

```powershell
cd frontend
npm run lint
# → 0 errors, 0 warnings を確認
```

### チェックポイント

| # | 観点 | 確認内容 |
|---|---|---|
| 1 | `react-hooks/set-state-in-effect` | `useEffect` 内で `setState` を同期呼び出ししていないか |
| 2 | `react-hooks/exhaustive-deps` | 依存配列に漏れがないか |
| 3 | `react/jsx-key` | `.map()` 内の Fragment に `key` があるか（`<>` ではなく `<Fragment key={...}>`） |
| 4 | ESLintプラグイン設定 | `eslint-plugin-react` が `eslint.config.js` で有効になっているか |
| 5 | XSS対策 | `dangerouslySetInnerHTML` を使用していないか（投稿・コメントはユーザー入力のため特に重要） |

### よくあるアンチパターン

```tsx
// NG: useEffect 内での同期 setState
useEffect(() => {
  setLoading(true);   // ← エラー
  fetchData().then(...);
}, [key]);

// OK: 派生値として計算 or 非同期コールバック内でのみ setState
const loading = refreshKey !== lastFetchedKey;
```

```tsx
// NG: <> に key はつけられない
{items.map((item) => (
  <>
    <Component key={item.id} />
    <div key={`zone-${item.id}`} />
  </>
))}

// OK: Fragment に key をつける
{items.map((item) => (
  <Fragment key={item.id}>
    <Component />
    <div />
  </Fragment>
))}
```

---

## バックエンド：Checkstyle実行・ビルド確認・Spring Bootアンチパターンチェック

### 実行コマンド

```powershell
cd backend
.\gradlew check
# → BUILD SUCCESSFUL を確認
```

### チェックポイント

| # | 観点 | 確認内容 |
|---|---|---|
| 1 | import | 完全修飾名（`new java.util.ArrayList<>()`）を使わず `import` に統一されているか |
| 2 | N+1対策 | タイムライン取得でいいね数・コメント数を投稿ごとに個別クエリしていないか（COUNT + GROUP BY で集計しているか） |
| 3 | 例外ハンドリング | `@RestControllerAdvice` でバリデーションエラー・JSONエラーを統一処理し、docs/design.md のエラーレスポンス形式と一致しているか |
| 4 | 権限チェック | 投稿の編集・削除（Phase 2）で「自分の投稿か」をサーバー側で検証しているか |
| 5 | 認証まわり | パスワードをBCryptでハッシュ化しているか。JWTの署名鍵・DBパスワード等の秘密情報をコードにハードコードしていないか |
| 6 | バリデーション | 本文280文字・画像5MB/JPEG/PNG の制限がサーバー側でも検証されているか（フロントだけに頼らない） |

### よくあるアンチパターン

```java
// NG: 完全修飾名
List<String> list = new java.util.ArrayList<>();

// OK: import に統一
import java.util.ArrayList;
List<String> list = new ArrayList<>();
```

```java
// NG: タイムラインの投稿ごとにいいね数を個別クエリ（N+1問題）
for (Post post : posts) {
    long likes = likeRepository.countByPostId(post.getId()); // ← 投稿数だけクエリが飛ぶ
}

// OK: 投稿ID一覧に対して COUNT + GROUP BY でまとめて集計し、Mapで突き合わせる
```

---

## ドキュメント整合性：設計書と実装の乖離チェック

### チェックポイント

| ファイル | 確認観点 |
|---|---|
| `docs/requirements.md` | 前提条件（技術・ポート・S3）・非機能要件が実装と一致しているか |
| `docs/features.md` | 機能一覧の実装状況（🚧/✅）が実態と一致しているか。受け入れ条件を満たしているか |
| `docs/design.md` | APIエンドポイント（メソッド・パス・レスポンス形式）が実装と一致しているか |
| `docs/database-design.md` | テーブル定義・制約が実際のEntityクラス・Flywayマイグレーションと一致しているか |
| `docs/screen-design.md` | 画面一覧・遷移が実装と一致しているか |
| `docs/tech-stack.md` | 使用ライブラリ・バージョンが build.gradle / package.json と一致しているか |

### 確認手順

1. 実装コード（Entityクラス・Controllerクラス・マイグレーションSQL）を読む
2. ドキュメントの記載と比較する
3. 乖離があればドキュメント側を修正する（実装は変えない）
