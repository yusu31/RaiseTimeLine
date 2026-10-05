---
name: performance-test
description: RaiseTimeLine プロジェクトのk6パフォーマンステスト（負荷試験）を実行するスキル。ユーザーが「負荷試験して」「パフォーマンステストして」「k6実行して」「load-testして」「stress-testして」「spike-testして」「負荷試験のレポートを見て」「負荷試験のデータをクリーンアップして」などと言った場合は必ずこのスキルを使うこと。専用DB・専用プロファイルを使う前提条件と、実行後クリーンアップ必須のルールがある。
---

# k6パフォーマンステスト実行スキル

RaiseTimeLine バックエンドAPIの負荷試験（k6）の実行手順。**CIでは自動実行しない。常に手動実行する。**

> **詳細な根拠は正本を見る。** P95/P99の説明・しきい値の数値と根拠・データ分離戦略の詳細設計は
> `docs/performance-testing.md`、ツール選定理由は `docs/tech-stack.md`、シナリオ選定理由は
> `docs/testing-design.md` 16章を参照。本スキルは「手順を迷わず実行する」ことに特化する。

## 前提条件（厳守）

- k6がインストール済みであること（初回のみ: `winget install GrafanaLabs.k6`。
  **`k6.k6` というIDは存在しない**ので打ち間違えない）
- 専用DB `raisetimeline_loadtest` が作成済みであること（初回のみの手動セットアップ手順は
  `docs/performance-testing.md` 5章）
- 通常の開発用バックエンド（ポート8080、プロファイル指定なし）が**停止していること**。
  loadtestプロファイルのバックエンドと混在させない

## 実行前チェック

```powershell
netstat -ano | findstr :8080   # 開発用バックエンドが生きていないか確認。生きていたら停止する
docker compose ps              # DBコンテナが起動しているか確認
```

## 実行手順

```powershell
# 1. インフラ起動（loadtestプロファイルでバックエンドを起動）
docker compose up -d
cd backend
$env:SPRING_PROFILES_ACTIVE="loadtest"
.\gradlew bootRun

# 2. テストデータ投入（別ターミナルで。初回 or DBリセット後のみ必要）
cd perf
npm run seed

# 3. テスト実行（目的に応じて1つを選ぶ）
npm run test:load      # 通常負荷: 2分ランプアップ→10分維持→2分ランプダウン（計14分）
npm run test:stress    # 限界探索: 10→30→50→100→150→200 VUs 各3分（計18分）
npm run test:spike     # 急な負荷変動（計8分）

# 4. レポート確認
# perf/results/ にHTMLレポートが出力される（次節「レポートの見方」を参照）

# 5. クリーンアップ（必須・省略しない）
npm run cleanup
```

## レポートの見方

- コンソールに出るしきい値の PASS/FAIL は自動判定の結果にすぎない。**`perf/results/` のHTMLレポートを
  実際に開いて、どのエンドポイントが遅いか・エラーの傾向を人の目で確認する工程を必ず挟む**
- しきい値の数値・エンドポイント対応表は `docs/performance-testing.md` 4章を参照

## 禁止事項

- 開発用DB (`raisetimeline`) ・結合テスト用DB (`raisetimeline_test`) に対してシード投入・
  クリーンアップを実行すること。`cleanup-perf-data.sql` には接続先が `raisetimeline_loadtest`
  以外だと即エラー停止する安全装置があるが、それに頼らず常に接続先を確認してから実行する
- テスト完了後に `npm run cleanup` を省略すること（次回実行時にデータが混在する）
- CIへの自動実行統合（`workflow_dispatch` 等）。スコープ外として見送り済み
  （理由は `docs/performance-testing.md` 11章）
- `stress-test.js` / `spike-test.js` の時間設定を短縮して実行した結果を、
  本番相当の計測結果として報告すること。短縮版は動作確認目的に限定する
