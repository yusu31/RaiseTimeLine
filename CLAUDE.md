# RaiseTimeLine プロジェクト ガイドライン

## ユーザー情報

- エンジニア初学者（プログラミングスクール RaiseTech 在籍中）
- OS: Windows 11 / エディタ: Cursor（Claude Code拡張入り）
- 完了済み課題: Trello風タスク管理アプリ（Spring Boot + React + PostgreSQL）、予定管理アプリ Roami（Rails + Next.js + MySQL）
- 今回は講師の講義進行に合わせて、X風タイムラインSNSアプリを開発する

## 応答・説明スタイル（厳守）

- **すべての応答・コメント・説明は日本語で行うこと**
- 操作・コマンドを伝えるときは「裏で何が起きているか」を平易な言葉で必ず説明する
- 専門用語には必ず平易な補足をつける
- 「なぜそうするのか」の理由を省かない
- 手順は番号付きで一つずつ示す

## プロジェクト概要

**アプリ名:** RaiseTimeLine（仮称）
**概要:** X（旧Twitter）風のタイムライン形式SNSアプリ。投稿・コメント・いいね・画像添付ができる。
**差別化:** インプレッション数を表示しない・リツイート機能を作らない

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | React 19 + TypeScript + Vite + Tailwind CSS |
| バックエンド | Java 21 + Spring Boot 3.x（REST API） |
| 認証 | Spring Security + JWT（アクセストークン＋リフレッシュトークン） |
| ORマッパー | Spring Data JPA |
| DBマイグレーション | Flyway |
| データベース | PostgreSQL 17（ローカルは Docker） |
| 画像ストレージ | AWS S3（確定） |
| デプロイ | AWS: EC2 + RDS + ALB 前提（詳細はデプロイフェーズで確定） |

> **バージョン方針（講師指示）:** ライブラリのバージョンは前回課題 TaskManagement と同じものを使う。
> 詳細は docs/tech-stack.md を参照。

## サーバー起動・ポート管理（厳守）

### 使用ポート

| サーバー | ポート | 変更可否 |
|----------|--------|--------|
| フロントエンド（Vite） | **3000** | 禁止 |
| バックエンド（Spring Boot） | **8080** | 禁止 |
| データベース（PostgreSQL） | **5432** | 禁止 |

### 禁止事項

- **別ポートでの代替起動は絶対に行わない**（例: 8081, 3001 など）
- ポートを変更するためにアプリの設定ファイルを書き換えることも禁止
- 理由: フロントのAPI呼び出し先とバックエンドのCORS設定が特定ポート前提のため

### ポート競合時の対応手順

```powershell
# 1. ポート使用状況の確認（例: 8080）
netstat -ano | findstr :8080

# 2. 競合プロセスの停止（PIDを確認してから実行）
taskkill /PID <PID> /F
```

## ディレクトリ構成（予定）

```
RaiseTimeLine/
├── backend/        # Java + Spring Boot（REST API）
├── frontend/       # React + TypeScript（Vite）
├── docs/           # 要件定義・設計ドキュメント
│   └── features/   # 機能別詳細設計（各機能の実装直前に作成）
├── docker-compose.yml
└── CLAUDE.md
```

## ドキュメント運用ルール（厳守）

- **分冊・重複なし方針:** requirements.md は「目次役」。詳細は features.md / screen-design.md /
  database-design.md / design.md / tech-stack.md に**1か所だけ**書く。同じ内容を複数ファイルに書かない
- **ドキュメントは実装を「正」として修正する**（ドキュメントに合わせて実装を変えない）
- `docs/features/` の機能別詳細設計は、各機能の**実装直前**に作成する
- `docs/infrastructure.md` はデプロイフェーズで作成する

## GitHubワークフロー（厳守）

```
Issue作成 → ブランチ作成 → 実装 → ローカルで動作確認 → PR作成 → マージ → クリーンアップ
```

- **作業前に必ずIssueを作成する**
- **ローカルで動作確認してからPRを作成する（確認前のPR作成禁止）**
- ブランチ命名: `{type}/{説明}-#{Issue番号}`（例: `feature/timeline-api-#5`）
- コミットメッセージ: `{type}: {日本語説明}` + `Closes #番号`
- **mainへの直接プッシュ禁止・force push禁止**（ブランチ保護ルールで強制済み）
- **PRのマージはユーザー自身がGitHub上で確認して行う**（Claude/AIはマージ操作をしない）
- マージ後のクリーンアップはClaudeが行う: `git checkout main` → `git pull` → `git branch -d 作業ブランチ` → `git remote prune origin`

## 品質チェック

- 品質チェック作業は **1つのIssue + 1つのPR** でまとめて対応すること

### フロントエンド

```powershell
cd frontend
npm run lint    # 0 errors, 0 warnings を確認
```

### バックエンド

```powershell
cd backend
./gradlew build   # ビルドとテストがすべて成功することを確認
```

## 注意事項

- Phase 順を厳守する（Phase 1 完成まで Phase 2 に着手しない）
- 有料APIを呼び出す実装を行う前に、必ずユーザーに確認を取ること（課金が発生するため）
- 秘密情報（JWTの署名鍵・DBパスワード等）をGitにコミットしない。環境変数または `.gitignore` 済み設定ファイルで管理する
