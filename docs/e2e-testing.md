# E2Eテスト（Playwright）

## RaiseTimeLine（仮称）

**この文書の役割:** ブラウザE2Eテストに関する「正本」。実行手順・ディレクトリ構成・シナリオ一覧・
パフォーマンスしきい値の根拠・CI化の方針はここに1か所だけ書く。ツールの選定理由・比較表は
`docs/tech-stack.md`、どのユースケースを「なぜ」選んだかは `docs/testing-design.md` を参照。

**現時点ではCIで自動実行しない。手動実行のみ。**（詳細は本文末尾「CI化について」）

---

## 1. 目的

単体・結合テストが「部品が正しく動くか」を検証するのに対し、E2Eテストは「ユーザーが実際に行う
一連の操作（ログイン→投稿→いいね…）が、ブラウザからDBまで通しで壊れていないか」を検証する。
あわせて、ブラウザ側のパフォーマンス（FCP/LCP/CLS/DOMContentLoaded）とアクセシビリティ
（WCAG 2.1 AA）も一部計測する。

## 2. テスト対象の範囲

正常系のユースケーステスト（シナリオテスト）が中心。異常系はUIの入口として必ず通るもの
（認証エラー・重複登録エラー等）のみ含め、API層の網羅的な異常系は`docs/testing-design.md`の
対象（重複させない）。

## 3. ディレクトリ構成

```
e2e/
  playwright.config.ts   # 設定本体。storageState・記録設定・CI用設定を含む
  package.json
  fixtures/
    auth.fixture.ts       # storageStateのパス定数
    global-setup.ts       # テストデータ投入 + 3ユーザー分のstorageState事前保存
    global-teardown.ts    # テストデータのクリーンアップ
  pages/                  # Page Object Model（画面ごとの操作をクラスにまとめる）
  scenarios/              # シナリオテスト（*.spec.ts）
  accessibility/          # アクセシビリティテスト（axe-core）
  performance/            # ブラウザパフォーマンス計測
  data/                   # シード/クリーンアップSQL
  auth/                   # storageState保存先（.gitignore対象）
  results/                # レポート・動画・スクリーンショット（.gitignore対象）
```

**Page Object Model（POM）を採用した理由:** 画面のUI変更（ボタンのラベル変更等）が起きたとき、
修正箇所を`pages/`配下の該当ファイル1か所に閉じ込めるため。シナリオ（`scenarios/`）側はPage Objectの
メソッドを呼ぶだけにし、セレクタの詳細を知らなくてよい状態にする。

**storageStateを採用した理由:** E2Eのほとんどのシナリオはログイン済み状態が前提になる。毎回UIの
ログインフォームを操作すると実行時間が延びるため、`global-setup.ts`で一度だけAPIログインし、
その結果（Cookie・localStorage）をファイルに保存して全テストで使い回す。

## 4. 環境構成

k6（パフォーマンステスト）と同じ「専用DB・専用Spring Profile」方式。

| 項目 | 内容 |
|---|---|
| DB | `docker/postgres/init/03_create_e2e_db.sql`で`raisetimeline_e2e`を作成 |
| Spring Profile | `backend/src/main/resources/application-e2e.yml` |
| シードデータ | `e2e/data/seed-e2e-data.sql`。固定ユーザー3名（`e2euser_alice`/`e2euser_bob`/`e2euser_charlie`、共通パスワード`E2eTestPass1`） |
| クリーンアップ | `e2e/data/cleanup-e2e-data.sql`。`username LIKE 'e2euser_%'`で一括削除。新規登録テストが作るユーザーは`e2euser_signup_`プレフィックスで統一し、同じクリーンアップで消える |

## 5. シナリオ一覧

`docs/features.md`のUC-01〜15に対応。選定理由の詳細は`docs/testing-design.md`17章を参照。

| spec | 状態 | 対応UC/F |
|---|---|---|
| `auth.spec.ts` | 実装済み | F-06, UC-01, UC-06 |
| `post-lifecycle.spec.ts` | 未実装（PR2予定） | UC-02, UC-07, UC-08 |
| `comment-lifecycle.spec.ts` | 未実装（PR2予定） | UC-05 |
| `like.spec.ts` | 未実装（PR2予定） | UC-04 |
| `follow.spec.ts` | 未実装（PR2予定） | UC-12, UC-13 |
| `profile.spec.ts` | 未実装（PR2予定） | UC-10, UC-11 |
| `timeline.spec.ts` | 未実装（PR2予定） | UC-03, UC-09 |
| `search.spec.ts` | 未実装（PR2予定） | UC-14, UC-15 |

## 6. アクセシビリティテスト

（PR3で実装予定）`@axe-core/playwright`で`login`/`signup`/`timeline`/`post-detail`/`profile`/`search`
の主要6ページをWCAG 2.1 AA基準でチェックする。

## 7. ブラウザパフォーマンス計測

（PR3で実装予定）`page.evaluate()`でブラウザ標準のPerformance APIを直接読み、しきい値を超えたら
テストを失敗させる。

**page-load.perf.spec.ts**

| 指標 | しきい値 | 対象ページ |
|---|---|---|
| FCP | < 2s | 全ページ |
| LCP | < 3s | タイムライン、プロフィール |
| CLS | < 0.1 | 全ページ |
| DOMContentLoaded | < 3s | 全ページ |

**interaction.perf.spec.ts**

| 操作 | しきい値 |
|---|---|
| 投稿送信→タイムライン反映 | < 1s |
| いいねクリック→UI反映 | < 300ms |
| 無限スクロール→追加表示 | < 2s |
| 検索入力→結果表示 | < 1s |

しきい値はローカル実行で頻繁にflaky化する場合は調整する（調整したら理由と日付をここに追記する）。

## 8. 記録設定

講義要件「E2Eは必ず動画か画像を記録する」を満たすため、`playwright.config.ts`で成功時も含めて
`video: 'on'`・`screenshot: 'on'`を設定。`trace`（操作・ネットワーク・コンソールログの記録）は
容量が大きいため失敗時のみ（`retain-on-failure`）。

## 9. 実行手順

`e2e/README.md`を参照（同じ内容を二重管理しないため、コマンドはそちらに1か所だけ記載する）。

## 10. クリーンアップ手順

`global-teardown.ts`がテスト実行後に自動で`npm run cleanup`相当を実行する。手動で行う場合は
`cd e2e && npm run cleanup`。

## 11. レポート・録画の確認方法

`cd e2e && npm run report`で`e2e/results/report/index.html`をブラウザで開く。動画は
`e2e/results/test-results/<テスト名>/video.webm`、失敗時のトレースは
`npx playwright show-trace e2e/results/test-results/<テスト名>/trace.zip`で確認する。

## 12. CI化について

**現時点ではCIに組み込んでいない。** 次のCI/CD講義を踏まえて、`.github/workflows/ci.yml`への
組み込みを別途検討する。`playwright.config.ts`にはCI実行を想定した設定
（`webServer`のCI時自動起動、`retries`/`workers`のCI用調整）を用意済みのため、組み込み自体の
実装コストは低い。
