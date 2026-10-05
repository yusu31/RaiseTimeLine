# パフォーマンステスト（負荷試験）

## RaiseTimeLine（仮称）

**この文書の役割:** バックエンドAPIの負荷試験（k6）に関する「正本」。しきい値の数値・根拠・
実行手順・クリーンアップ手順はここに1か所だけ書く。ツールの選定理由・比較表は `docs/tech-stack.md`、
どのシナリオ・負荷パターンを「なぜ」選んだかは `docs/testing-design.md` を参照。

**CIでは自動実行しない。任意のタイミングで手動実行する。**

---

## 1. 目的

単体・結合テストが「機能要件」（何ができるか）を検証するのに対し、このテストは
「非機能要件」（どれくらいの品質で動くか）を検証する。`docs/requirements.md` 5.2節
「各操作のレスポンス1秒以内」を根拠に、エンドポイント別のしきい値（threshold）を設定し、
k6で実際に満たせているかを確認する。

---

## 2. テスト対象の範囲

### バックエンドAPI（今回の対象）

k6によるHTTPレベルの負荷試験。APIのレスポンスタイム・スループット・エラー率を計測する。

### フロントエンド（ブラウザパフォーマンス）について

パフォーマンス測定には大きく2つの観測点があり、目的も手法も異なる。

| 観測点 | 測るもの | 代表的な指標 | 代表的な道具 |
|---|---|---|---|
| ブラウザ側（フロントエンド） | ユーザーが画面を触ったときの「見た目の速さ・快適さ」。描画・JS実行・レイアウトシフトなど | Core Web Vitals（LCP・CLS・INPなど） | Lighthouse CI, Playwright/Puppeteer |
| サーバー側（バックエンドAPI） | サーバーが同時に多数のリクエストを受けたときに、処理をどこまで速く・安定して返せるか | レスポンスタイム（P95/P99）・エラー率・スループット | k6, Gatling, JMeter |

今回導入するk6は後者（サーバー側のAPI負荷試験）専用のツールであり、ブラウザを起動せずHTTPリクエストだけを
大量に送る。ブラウザのレンダリング性能やCore Web Vitalsは一切計測しない。

この2つは原因と結果の関係にあることが多い（APIが遅ければ画面も遅くなる）が、逆にAPIが高速でも
フロントエンドの実装（不要な再レンダリング・画像サイズ・JSバンドルサイズなど）が原因で画面が遅く
感じられることもある。そのためこの2つは別々のテストで検証する必要があり、どちらか一方だけでは
「速いアプリ」を保証できない。

**今回はバックエンドAPIの負荷試験（k6）のみを対象とする。** ブラウザ側のパフォーマンス測定
（Core Web Vitals・Lighthouseなど）は、次回予定されているPlaywright E2Eテストの文脈、または
別の専用タスクで扱う。

---

## 3. P95・P99とは何か（初学者向け補足）

負荷試験では「平均レスポンスタイム」だけを見てはいけない。平均は、ごく一部の極端に遅いリクエスト
（外れ値）が多数の速いリクエストに埋もれて見えなくなってしまう指標だから。例えば999件が100msで返り、
1件だけ10秒かかった場合、平均は約110msとなり、「10秒かかった1件」の存在がほぼ見えなくなる。
しかし実際にそのリクエストを経験したユーザーには、確実に10秒の遅さが発生している。

そこで使うのが「パーセンタイル」という考え方。レスポンスタイムを速い順に並べたとき、

- **P95（95パーセンタイル）**: 速い方から95%のリクエストがこの時間以内に収まっている値。残りの5%はこれより遅い
- **P99（99パーセンタイル）**: 速い方から99%のリクエストがこの時間以内に収まっている値。残りの1%（100件に1件）だけがこれより遅い

P99はP95よりも「外れ値に近い、より厳しい裾の性能」を表す。P95とP99の差が大きい場合、一部のリクエストだけ
極端に遅い何らかの原因（N+1クエリ・特定ユーザーのデータ量・GCの一時停止など）が疑われる。

本プロジェクトの負荷試験では、エンドポイントごとにP95のしきい値（threshold）を設定し、
「だいたい速い」だけでなく「ほとんどのユーザーが体感する速さ」が基準を満たしていることを確認する。

---

## 4. しきい値と根拠

`docs/requirements.md` 5.2節「各操作のレスポンス1秒以内」を**上限の契約値**とし、各エンドポイントの
**内部目標値はそれより厳しく**設定する。これはSLA（契約上の基準）違反の手前で気づけるようにする、
という実務上一般的な考え方で、非機能要件の「余裕を持たせる」の裏返しでもある
（契約値ギリギリを目標にすると、わずかな性能劣化で即座に契約違反になってしまう）。

| メトリクス | 閾値 |
|---|---|
| `POST /api/auth/login` P95 | < 800ms |
| `GET /api/posts`（タイムライン）P95 | < 500ms |
| `POST /api/posts` P95 | < 1000ms |
| `POST/DELETE /api/posts/{id}/likes` P95 | < 300ms |
| `GET/POST .../comments` P95 | < 500ms |
| `GET /api/users/{username}` 等 P95 | < 400ms |
| 全体エラー率 | < 1% |
| 全体平均レスポンスタイム | < 500ms |

いずれも契約上の上限（1000ms）を超えていない範囲に収めており、「厳しすぎる基準」にはなっていない。

`perf/config/thresholds.js` にコードとして定義し、k6の`options.thresholds`に反映している
（`http_req_duration{scenario:xxx}` のタグで、どのシナリオの計測かを区別する）。

---

## 5. テストデータ分離戦略

### 現場では何が一般的か

実務では、負荷試験は**本番や開発中のデータに影響を与えない、隔離された環境**で行うのが原則。
企業では専用の「負荷試験環境（performance/staging環境）」を用意することが多い。このプロジェクトの
規模でそれを模すなら、**専用のデータベースを1つ切る**のが最も素直な再現。

### 採用する方式：専用DB `raisetimeline_loadtest`

既存の`raisetimeline`（開発用）・`raisetimeline_test`（結合テスト用、各テスト前に全テーブルTRUNCATEされる）
とは別に、3つ目のDBを用意している。

| 判断 | 理由 |
|---|---|
| 既存`raisetimeline_test`を流用しない | 結合テストが各テスト前に`TRUNCATE CASCADE`を実行する。負荷試験中に`./gradlew test`を走らせるとデータが消える |
| 既存`raisetimeline`（開発用）を流用しない | 開発中の手動データと大量の負荷試験データ（数千〜1万件規模）が混在し、安全性に不安が残る |
| 専用DBを新設する | 開発・結合テストと完全に独立。何と同時に走らせても衝突しない |

データ本体にも`perfuser`プレフィックス（アンダースコア`_`を含めない）を付け、専用DBと合わせて
**二重の安全策**にしている。SQLの`LIKE`では`_`は「任意の1文字」を表すワイルドカードのため、
プレフィックスに`_`を含めると`LIKE 'perfuser_%'`のような書き方の意図が曖昧になる。

### 初回セットアップ（手動1回のみ）

`docker-compose.yml`の`postgres_data`という名前付きvolumeが既に存在する環境では、
`docker/postgres/init/02_create_loadtest_db.sql`を追加するだけでは適用されない
（`docker-entrypoint-initdb.d`はvolumeが空の状態で最初にコンテナを作ったときしか実行されない）。
以下を手動で1回だけ実行する。

```powershell
docker exec -it <コンテナ名> psql -U raisetime -d raisetimeline -c "CREATE DATABASE raisetimeline_loadtest;"
```

### パスワードハッシュの生成方法

`seed-perf-data.sql`はSQL直接投入（API経由の逐次signupより高速）のため、パスワードハッシュを
PostgreSQLの`pgcrypto`拡張（`crypt()` / `gen_salt('bf', 10)`）で生成している。これがSpring Security
の`BCryptPasswordEncoder`（`$2a$`, strength 10）と完全に互換性があることをローカルで実証済み
（pgcryptoで生成したハッシュを持つユーザーで、実際に`POST /api/auth/login`が200を返すことを確認した）。

---

## 6. シナリオ一覧

| シナリオ | ファイル | 対象エンドポイント |
|---|---|---|
| timeline | `perf/scenarios/timeline.js` | `GET /api/posts?page&size&tab` |
| post | `perf/scenarios/post.js` | `POST /api/posts`（マルチパート: content + image） |
| interaction | `perf/scenarios/interaction.js` | `POST/DELETE /api/posts/{id}/likes`, `GET/POST .../comments` |
| profile | `perf/scenarios/profile.js` | `GET /api/users/{username}`, `GET .../posts` |

`perf/scenarios/auth.js`がログイン→JWTトークン取得の共通関数（テストユーザーをランダムに選ぶ）。

どのシナリオを・なぜ選んだかの詳細な理由は `docs/testing-design.md` 16章を参照。

---

## 7. 3つの負荷パターン

| パターン | ファイル | 内容 |
|---|---|---|
| Load Test（通常負荷） | `perf/scripts/load-test.js` | 2分かけて50 VUsまでランプアップ→10分維持→2分でランプダウン。配分: timeline 60% / post 15% / interaction 15% / profile 10% |
| Stress Test（限界探索） | `perf/scripts/stress-test.js` | 段階的負荷: 10→30→50→100→150→200 VUs（各3分）。エラー率1%超過またはP95が2秒超過した段階を限界値とする |
| Spike Test（急な負荷変動） | `perf/scripts/spike-test.js` | 10 VUs(2分)→100 VUs(1分)→10 VUs(2分)→150 VUs(1分)→10 VUs(2分) |

---

## 8. 実行手順

```powershell
# 1. インフラ起動
docker compose up -d
cd backend
$env:SPRING_PROFILES_ACTIVE="loadtest"
.\gradlew bootRun

# 2. テストデータ投入（初回 or DBリセット後。別ターミナルで）
cd perf
npm run seed

# 3. テスト実行
npm run test:load      # 通常負荷テスト
npm run test:stress    # ストレステスト
npm run test:spike     # スパイクテスト

# 4. レポート確認
# perf/results/ にHTML形式で出力される（k6-reporter）

# 5. テストデータクリーンアップ（テスト完了後、必ず実行）
npm run cleanup
```

k6のインストール（初回のみ）: `winget install GrafanaLabs.k6`
（`k6.k6`というIDは存在しない。`winget search k6`で確認したところ正しいIDは`GrafanaLabs.k6`だった）

---

## 9. クリーンアップ手順

`perf/data/cleanup-perf-data.sql`が、`users`テーブルから`perfuser%`のユーザーを削除する。
`posts`/`comments`/`likes`/`follows`/`refresh_tokens`はすべて`user_id`に`ON DELETE CASCADE`が
設定されているため（V2, V3, V4, V5, V8マイグレーション）、usersを消すだけで関連データが
自動的にすべて消える。

安全装置として、スクリプト冒頭で接続先DBが`raisetimeline_loadtest`以外なら即エラーで停止する
（`DO $$ ... RAISE EXCEPTION`）。誤って開発用DB・結合テスト用DBに対して実行する事故を防ぐ。

---

## 10. レポートの見方

`npm run test:load`等を実行すると、コンソールにテキストサマリー（しきい値のPASS/FAIL）が出力され、
`perf/results/`にHTMLレポート（k6-reporter）も生成される。**自動判定の結果（しきい値PASS/FAIL）を
見るだけでなく、HTMLレポートを人が開いて、どのエンドポイントが遅いか・エラーの傾向を見る工程を必ず挟む。**

---

## 11. CIでは自動実行しない

GitHub Actionsへの`workflow_dispatch`統合は今回のスコープに含めていない。理由は、
GitHub-hosted runnerは性能が一定でない共有環境のため、そこで測ったP95/P99の絶対値はローカル実行
より参考値程度の意味しかないこと、また設定・検証の工数が今回の主眼（非機能要件の理解・P95/P99・
データクリーンアップ）から外れたスコープ拡大になることから。**将来、ローカル実行だけでは不便だと
感じた時点で改めて検討する。**
