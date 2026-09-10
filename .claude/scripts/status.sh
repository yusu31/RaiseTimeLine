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
04|8|100%|テストの整備
05|4| 50%|品質の詰め（バグ修正・想定外テスト）  <-- いまここ
06|0|  - |デプロイ（AWS）
"

# ── フェーズの内訳（親番号|番号|進捗0-8|表示|名前） ─────────────
SUBPHASES="
04|04-1|8|100%|バックエンド単体テスト（Service 147 / Mapper 98）  PR #66 済
04|04-2|8|100%|フロント 土台編（API層・フック 47件）              PR #68 済
04|04-3|8|100%|フロント 操作編（4部品 71件）                      PR #70 済
04|04-4|8|100%|フロント 表示編（8部品 66件）                      PR #72 済
04|04-5|8|100%|残りの部品とフック（8ファイル 78件）                PR #74 済
05|05-1|8|100%|LikeButton の二重送信バグ修正（Red→修正→Green 4件） PR #76
05|05-2|8|100%|いいね失敗時のエラー表示（4画面を統一・8件）        PR #78
05|05-3|0|  0%|想定外のテスト（極端な入力・同時操作）
05|05-4|0|  0%|ブランチ保護の必須チェック設定（あなたのGitHub操作）
"

# テスト対象にしないもの（判断済み。蒸し返さないための記録）
#   api/*.ts 5件      client.ts を呼ぶだけの薄いラッパー。client.ts のテストで実質カバー
#   pages/*.tsx       画面まるごとは単体テストの粒度を超える。ただし画面にしか無いバグは
#                     その部分だけに絞ってテストする（PR #78 で TimelinePage / PostDetailPage の
#                     いいね失敗時のみ追加。網羅は目指さない）
#   types/*.ts 5件    型定義のみで実行コードがない
#   IconCropModal / cropImage   Canvas 依存で jsdom では動かない
#   icons.tsx         SVG を返すだけ
#   main.tsx / App.tsx / AuthContext.ts   起動処理と定義のみ

# ── 次にやること（番号|内容） ────────────────────────────────
NEXT="
1|想定外のテスト（極端な入力・同時操作）
2|ブランチ保護の必須チェック設定
3|エラー表示が成功しても消えない件（testing-design.md 11-6）  <-- 4画面まとめて直す
4|デプロイ（あなたの指示待ち）
"

# ── 最終計測値（テスト実行に時間がかかるため手で更新） ──────────
MEASURED_AT="2026-09-10"
BACKEND_TESTS=343
FRONTEND_TESTS=299

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
# 分母は「テスト対象にすると決めたもの」だけにする。
# 対象外の2件（Canvas依存の IconCropModal / SVGを返すだけの icons.tsx）を引く
comp_all=$(( $(ls frontend/src/components/*.tsx 2>/dev/null | grep -vc '\.test\.') - 2 ))
comp_tested=$(ls frontend/src/components/*.test.tsx 2>/dev/null | wc -l | tr -d ' ')
# フックと状態管理（AuthContext.ts は型と定義だけなので数えない）
hook_all=$(ls frontend/src/hooks/*.ts frontend/src/context/AuthProvider.tsx 2>/dev/null | wc -l | tr -d ' ')
hook_tested=$(ls frontend/src/hooks/*.test.tsx frontend/src/context/AuthProvider.test.tsx 2>/dev/null | wc -l | tr -d ' ')

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
printf '  コンポーネント %s / %s にテストあり  (対象外2件を除く)\n' "$comp_tested" "$comp_all"
printf '  フック・状態  %s / %s にテストあり\n' "$hook_tested" "$hook_all"
printf '  テスト件数    backend %s / frontend %s  (最終計測 %s)\n' \
  "$BACKEND_TESTS" "$FRONTEND_TESTS" "$MEASURED_AT"
line
