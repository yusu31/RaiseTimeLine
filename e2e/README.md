# E2Eテスト（Playwright）

RaiseTimeLineのブラウザE2Eテスト。ユーザー操作の一連の流れ（シナリオ）を実際のブラウザで検証する。

ツール選定理由・ディレクトリ構成の意図・パフォーマンスしきい値の根拠は `docs/e2e-testing.md` を参照。

## 前提

- [Playwright](https://playwright.dev/) のブラウザバイナリがインストール済みであること（初回のみ `npx playwright install` が必要）
- 専用DB `raisetimeline_e2e` が作成済みであること（`docker compose up -d` で自動作成される。既にボリュームがある場合は手動で `CREATE DATABASE raisetimeline_e2e;` を実行する）
- 通常の開発用バックエンド（ポート8080）は停止しておくこと

## 実行手順

```powershell
# 1. インフラ起動
docker compose up -d
cd backend
$env:SPRING_PROFILES_ACTIVE="e2e"
.\gradlew bootRun

# 2. フロントエンド起動（別ターミナル）
cd frontend
npm run dev

# 3. テスト実行（別ターミナル）
cd e2e
npm ci
npx playwright install --with-deps chromium
npm run test            # 既定シナリオ（@slowを除く）をChromiumで実行
npm run test:all        # Firefox/WebKitも含めて実行
npm run test:perf       # パフォーマンステストのみ
npm run test:a11y       # アクセシビリティテストのみ
npm run test:headed     # ブラウザ表示付きで目視確認

# 4. レポート確認
npm run report          # e2e/results/report/index.html
```

`global-setup`/`global-teardown`がテスト実行の前後に自動でデータ投入・クリーンアップを行うため、個別の`npm run seed`/`cleanup`はデバッグ時のみ使う。

## ディレクトリ構成

```
e2e/
  playwright.config.ts
  fixtures/     # global-setup（データ投入+storageState保存）・global-teardown（cleanup）
  pages/        # Page Object Model（画面ごとの操作をまとめたクラス）
  scenarios/    # シナリオテスト（*.spec.ts）
  accessibility/ # アクセシビリティテスト（axe-core）
  performance/   # ブラウザパフォーマンス計測
  data/          # シード/クリーンアップSQL
  auth/          # storageState保存先（.gitignore対象）
  results/       # レポート・動画・スクリーンショット出力先（.gitignore対象）
```

## CIについて

現時点ではCI（GitHub Actions）に組み込んでいない。次のCI/CD講義を踏まえて組み込みを検討する。`playwright.config.ts`にはCI実行を想定した設定（`webServer`自動起動・`retries`/`workers`）を用意済みのため、組み込みコストは低い。
