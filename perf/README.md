# パフォーマンステスト（k6）

RaiseTimeLineバックエンドAPIの負荷試験。**CIでは自動実行しない。任意のタイミングで手動実行する。**

非機能要件の根拠・P95/P99の説明・しきい値・データ分離戦略の詳細は `docs/performance-testing.md` を参照。

## 前提

- [k6](https://k6.io/) がインストールされていること（`winget install GrafanaLabs.k6`）
- 専用DB `raisetimeline_loadtest` が作成済みであること（`docs/performance-testing.md` 参照）
- 通常の開発用バックエンド（ポート8080）は停止しておくこと

## 実行手順

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
npm run test:stress    # ストレステスト（限界探索）
npm run test:spike     # スパイクテスト

# 4. レポート確認
# perf/results/ にHTML形式で出力される

# 5. テストデータクリーンアップ（テスト完了後、必ず実行）
npm run cleanup
```

## ディレクトリ構成

```
perf/
  package.json      # npm scripts定義
  scripts/           # load/stress/spikeの3パターン
  scenarios/         # timeline/post/interaction/profile + 共通認証(auth.js)
  config/            # ベースURL・しきい値定義
  data/              # シード/クリーンアップSQL・テスト画像
  results/           # レポート出力先（.gitignore対象）
```
