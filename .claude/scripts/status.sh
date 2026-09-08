#!/usr/bin/env bash
# RaiseTimeLine の現在地を1画面で表示する。
# 使い方: bash .claude/scripts/status.sh
#
# フェーズと残作業は下の設定を手で更新する（節目ごとにClaudeが更新する）。
# ブランチ・Issue/PR 件数・テストファイル数は毎回その場で取得する。

set -u
cd "$(dirname "$0")/../.." || exit 1

# ── フェーズ（番号|進捗0-8|表示|名前） ───────────────────────────
PHASES="
01|8|100%|要件定義・設計
02|8|100%|機能実装（全12機能）
03|8|100%|土台づくり（CI・Issue/PRテンプレート）
04|5| 60%|テストの整備          <-- いまここ
05|0|  0%|品質の詰め（バグ修正・想定外テスト）
06|0|  - |デプロイ（AWS）
"

# ── フェーズの内訳（親番号|番号|進捗0-8|表示|名前） ─────────────
SUBPHASES="
04|04-1|8|100%|バックエンド単体テスト（Service 147 / Mapper 98）  PR #66 済
04|04-2|8|100%|フロント 土台編（API層・フック 47件）              PR #68 済
04|04-3|8|100%|フロント 操作編（4部品 71件）  Issue #69            <-- PR確認待ち
04|04-4|0|  0%|フロント 表示編（8部品）
04|04-5|0|  0%|残りの部品とフック（8ファイル・AuthProvider 等）
"

# テスト対象にしないもの（判断済み。蒸し返さないための記録）
#   api/*.ts 5件      client.ts を呼ぶだけの薄いラッパー。client.ts のテストで実質カバー
#   pages/*.tsx 7件   画面まるごとは単体テストの粒度を超える
#   types/*.ts 5件    型定義のみで実行コードがない
#   IconCropModal / cropImage   Canvas 依存で jsdom では動かない
#   icons.tsx         SVG を返すだけ
#   main.tsx / App.tsx / AuthContext.ts   起動処理と定義のみ

# ── 次にやること（番号|内容） ────────────────────────────────
NEXT="
1|フロント コンポーネント編（残り12ファイル） <-- 講師指示の未完了部分
2|LikeButton の二重送信バグ修正
3|想定外のテスト（レース条件・二重送信・極端な入力）
4|ブランチ保護の必須チェック設定
5|デプロイ（あなたの指示待ち）
"

# ── 最終計測値（テスト実行に時間がかかるため手で更新） ──────────
MEASURED_AT="2026-09-09"
BACKEND_TESTS=343
FRONTEND_TESTS=143

bar() { # $1=埋まっている数(0-8)
  local n=$1 i out=""
  for ((i = 0; i < 8; i++)); do
    if [ "$i" -lt "$n" ]; then out="$out#"; else out="$out-"; fi
  done
  printf '%s' "$out"
}

line() { printf '%s\n' "------------------------------------------------------------"; }

# ── 実測（その場で取得） ───────────────────────────────────
branch=$(git branch --show-current 2>/dev/null || echo '?')
commit=$(git log --oneline -1 --format='%h' 2>/dev/null || echo '?')
dirty=$(git status --porcelain 2>/dev/null | grep -cv '^??' || true)
issues=$(gh issue list --state open --json number --jq 'length' 2>/dev/null || echo '?')
prs=$(gh pr list --state open --json number --jq 'length' 2>/dev/null || echo '?')
comp_all=$(ls frontend/src/components/*.tsx 2>/dev/null | grep -vc '\.test\.' || echo 0)
comp_tested=$(ls frontend/src/components/*.test.tsx 2>/dev/null | wc -l | tr -d ' ')

line
printf ' RaiseTimeLine  現在地\n'
line
printf '\n'

# フェーズ（内訳があればぶら下げて表示する）
echo "$PHASES" | while IFS='|' read -r num prog pct name; do
  [ -z "${num:-}" ] && continue
  printf '  %s  [%s] %s  %s\n' "$num" "$(bar "$prog")" "$pct" "$name"

  echo "$SUBPHASES" | grep "^${num}|" | while IFS='|' read -r _ snum sprog spct sname; do
    [ -z "${snum:-}" ] && continue
    printf '        %s [%s] %s  %s\n' "$snum" "$(bar "$sprog")" "$spct" "$sname"
  done
done

printf '\n'
line
printf ' 次にやること\n'
line
echo "$NEXT" | while IFS='|' read -r rank task; do
  [ -z "${rank:-}" ] && continue
  printf '  %s. %s\n' "$rank" "$task"
done

printf '\n'
line
printf ' いまの状態（この表示を出した時点で取得）\n'
line
printf '  ブランチ      %s (%s)  未コミット %s件\n' "$branch" "$commit" "$dirty"
printf '  Issue / PR    オープン %s件 / %s件\n' "$issues" "$prs"
printf '  コンポーネント %s / %s にテストあり  <-- 講師指示の未達部分\n' "$comp_tested" "$comp_all"
printf '  テスト件数    backend %s / frontend %s  (最終計測 %s)\n' \
  "$BACKEND_TESTS" "$FRONTEND_TESTS" "$MEASURED_AT"
line
