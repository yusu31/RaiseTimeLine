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
05|8|100%|品質の詰め（バグ修正・想定外テスト）
06|8|100%|監視運用とログ設計（講義No.32）
07|8|100%|デプロイ（S3+CloudFront+ECS Fargate+ALB+RDS、EC2不使用、講義No.38〜39）
08|8|100%|非機能要件・パフォーマンステスト（k6、講義No.35）
09|8|100%|E2Eテスト・ブラウザパフォーマンス・アクセシビリティ（Playwright、講義No.36）
10|8|100%|CI整備（GitHub Actions、講義No.37）
11|8|100%|Javaバージョンアップ（21→25、Spring Boot 3.4→4.0）
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
05|05-3|8|100%|想定外のテスト（極端な入力・同時操作。21件・バグ3件を発見） PR #80
05|05-4|8|100%|ブランチ保護の必須チェック設定（CIが赤だとマージ不可に） PR #88
05|05-5|8|100%|例外ハンドラの取りこぼしを直す（A・C / 400・409）      PR #83
05|05-6|8|100%|ページ位置のけた溢れを直す（B・4か所を long に）        PR #84
05|05-7|8|100%|エラー表示が消えない件を直す（9か所まとめて・9件）    PR #86
06|06-1|8|100%|構造化ログの土台（プロファイル分割）                PR #90
06|06-2|8|100%|リクエスト相関ID（RequestIdFilter）                 PR #92
06|06-3|8|100%|例外ハンドラの未ログ9種にWARN追加                   PR #94
06|06-4|8|100%|認証イベントのログ（ログイン成功/JWT検証失敗/MDCにuserId） PR #96
06|06-5|8|100%|主要業務イベントのINFOログ（登録・投稿作成/削除）      PR #98
06|06-6|8|100%|機密情報チェック＋運用設計書（docs/operations.md）      PR #102
06|06-7|8|100%|講義33との答え合わせ（テスト件数比較・logback代替の確認）  コード変更なし
08|08-1|8|100%|基盤整備（専用DB raisetimeline_loadtest・loadtestプロファイル） PR #109
08|08-2|8|100%|シナリオ一式・非機能要件ドキュメント（4シナリオ+3負荷パターン） PR #111
08|08-3|8|100%|スキル化（.claude/skills/performance-test/）               PR #113
08|08-4|8|100%|本番時間設定での実行・レポートの読み方（stress/spike、k6-reporter） コード変更なし
09|09-1|8|100%|基盤整備・認証シナリオ（専用DB raisetimeline_e2e・POM・storageState） PR #117
09|09-2|8|100%|残りシナリオ実装（投稿/コメント/いいね/フォロー/プロフィール/タイムライン/検索・計33件） PR #121
09|09-3|8|100%|パフォーマンス計測・アクセシビリティ（axe-coreでa11y違反2件を検出・修正） PR #123
10|10-1|8|100%|バックエンド静的解析（Checkstyle、google_checks.xmlベース・段階導入） PR #127
10|10-2|8|100%|E2EテストのCI自動実行（seed:ci新設・global-setup/teardownをCI分岐） PR #129
10|10-3|8|100%|検証PR（3系統に1件ずつテスト追加・Rulesetの必須チェック3つを確認） PR #131
11|11-1|8|100%|Spring Boot 4.0.8 + MyBatis 4.0.0化（Flyway starter切替・Jackson3移行） PR #135
11|11-2|8|100%|Gradle wrapper 9.8.1化（foojay-resolverでtoolchain自動DL対応） PR #137
11|11-3|8|100%|Checkstyle 14.3.0化（Java25新文法対応・警告件数は変化なし） PR #139
11|11-4|8|100%|Java toolchain 25化（ci.ymlのjava-versionも追従） PR #141
11|11-5|8|100%|最終検証・ドキュメント総仕上げ（積み重ねの破損なしを確認） PR #143
07|07-1|8|100%|Spring Boot Actuator導入・ヘルスチェック追加（ECS/ALB用） PR #150
07|07-2|8|100%|CORS許可オリジンの環境変数化 PR #152
07|07-3|8|100%|backend用Dockerfile新規作成（マルチステージビルド） PR #154
07|07-4|8|100%|TerraformでVPCネットワーク基盤構築（NAT Gateway不採用に変更） PR #156
07|07-5|8|100%|TerraformでRDS(PostgreSQL)構築（apply→Flyway8件適用を確認→destroy） PR #160
07|07-6|8|100%|TerraformでECRリポジトリ構築（イメージ3件をpush済み） PR #162
07|07-7|8|100%|TerraformでECSクラスター・タスク定義・IAM2ロール構築（Fargate単発起動で確認） PR #164
07|07-8|8|100%|TerraformでALB・ECSサービス構築、JWT署名鍵をSecrets Managerで注入（prodで渡し忘れは起動失敗） PR #168
07|07-9|8|100%|S3+CloudFrontでフロント配信、/api/*をALBへ振り分け（SPAの深いURLはCloudFront Function） PR #170
07|07-10|8|100%|docs/infrastructure.md確定版・CLAUDE.mdのEC2記載修正（途中で見つけた時刻9時間ずれは PR #172 で修正） PR #174
"

# 05-5・05-6 は 05-3（PR #80）の探索で見つかった。
# 「探しに行く回」なので工程が増えるのは想定内。分母が増えた結果、
# 完了は 2/4（50%）から 3/6（50%）になり、数字は動かなかった。
# 05-5（PR #83）で 4/6（67%）、05-6（PR #84）で 5/6（83%）。
# 探索で見つけた3件（A・B・C）はこれで全部直した。
# 05-7（PR #86）は Issue #77 のときに見つけて「まとめて直せるまで」待っていた課題。
# 05-4（PR #88）で必須チェックを設定し、フェーズ05は 7/7（100%）で完了。
# CIが赤いとマージボタンが押せなくなった。注意力ではなく構造で防ぐ状態になった。

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
1|次回apply時: ECS上で作成直後の投稿が「たった今」と出るか確認（#171/#172の最終確認。apply前に課金確認）
"

# フェーズ06（監視運用とログ設計、講義No.32）は6 Issue全部完了（#89,#91,#93,#95,#97,#101）。
# 実装計画の正本は C:\Users\3fort\.claude\plans\260915-no-32-datadog-robust-panda.md。
# 06-7（2026-09-20）は次の講義33「テストとログ実装の解説」のメモを先にもらい、模範解答と
# 自分の実装を突き合わせた回。コード変更なし。テスト件数が講師の目安の2〜8倍あったが、
# フェーズ05の探索実績・testing-design.mdの網羅方針で説明が付くと判断した。詳細はObsidianの
# ClaudeCode-School「2026-09-20_講義33の答え合わせとテスト件数の差」を参照。

# スコープ外で見つけて直した小さいバグ（phaseに紐付かない）
#   Issue #103 / PR #104（2026-09-19）: 壊れたJSONを送ると500だったのを400に修正
#   （HttpMessageNotReadableException専用ハンドラをGlobalExceptionHandlerに追加）

# フェーズ08（非機能要件・パフォーマンステスト、講義No.35）は2026-10-05〜10-06に完了。
# デプロイ（フェーズ07）より先に実施したが、デプロイは課金が発生するため明示指示待ちのまま
# なので番号はそのまま07に残し、08を新設して「いまここ」を移した。
# 08-4（2026-10-06）は stress-test・spike-test を本番の時間設定（各18分・8分）で実行し、
# k6-reporterのHTMLレポートの読み方（Breached Thresholds・P95しきい値・平均の罠）を学んだ回。
# 詳細はObsidianの ClaudeCode-School「2026-10-06_パフォーマンステストの実行とレポートの読み方」を参照。

# フェーズ10（CI整備、講義No.37）は2026-10-10〜10-11に完了。既存の.github/workflows/ci.ymlに
# 静的解析（Checkstyle）とE2Eジョブを追加し、Rulesetの必須チェックを2つから3つ（フロントエンド・
# バックエンド・E2E）に増やした。Checkstyleはgoogle_checks.xmlベースでignoreFailures=trueの
# 段階導入（Javadocチェックのみコメントアウトで無効化）。E2EはGitHub Actionsのservicesコンテナに
# docker exec依存のseed/cleanupが使えないため、CI専用のseed:ciを新設しprocess.env.CIで分岐。
# 10-3（PR #131）では3系統に1件ずつテストを追加し、Rulesetの必須チェックが実際にPR画面上で
# 機能する（全部グリーンでないとマージ不可）ことを確認した。合わせてPaaS比較（Render推奨・
# Neon無料プランのDB併用）を提案したが、これは会話内の提示のみで完結させ、実装・docs化はしていない
# （デプロイ方式の確定はフェーズ07の課題として保留）。Javaバージョンアップ（21→25、
# Spring Boot 3.4→3.5）も「CIという安全網を先に作ってから」の方針で今回のスコープ外のまま。
# 詳細はObsidianの ClaudeCode-School「2026-10-10_CIパイプラインとJava・DB選定の判断」
# 「2026-10-10_E2EテストのCI自動実行とポート競合のデバッグ」を参照。

# フェーズ11（Javaバージョンアップ、21→25・Spring Boot 3.4→4.0）は2026-10-12〜10-13に完了。
# 前回（フェーズ10）で保留した「3.4→3.5→将来4.0」の2段階プランを再調査し、Spring Boot 3.5は
# 2026-06-30にOSS版サポート終了済みと判明したため、一段飛びで4.0へ上げることにユーザーと合意。
# 5 Issue/PRに分割し、①Spring Boot4.0+MyBatis4.0→②Gradle9.8.1→③Checkstyle14.3.0→
# ④Java25→⑤最終検証の順で進めた（Spring Boot3.4.5+Gradle9.xは非公式サポートの組み合わせ
# だったため、Gradle更新より先にSpring Boot更新を行う順序にした）。
# Spring Boot4.0のモジュール分割で、Flywayの自動設定が`flyway-core`直接依存だけでは
# 有効化されなくなる「静かな失敗」と、JSON処理の既定がJackson2→Jackson3に変わり
# `ObjectMapper`がBean登録されなくなる破壊的変更の2点が実際に影響した
# （どちらもimportパス・依存の切替で解決、アプリの振る舞い自体は変更不要）。
# ローカルにJDK25が無く`foojay-resolver-convention`プラグインの追加が必要だったことも判明。
# 詳細はObsidianの ClaudeCode-School学習記録（フェーズ11回）を参照。

# フェーズ07（デプロイ）は2026-10-13〜14に講義No.38を受けて着手。実装計画の正本は
# C:\Users\3fort\.claude\plans\eventual-baking-kay.md。講義メモとClaude独自調査を比較した後、
# 講師の計画書（スクリーンショット）が共有され、両者を突き合わせて計画を確定した。
# 当初は講師案（プライベートサブネット+NAT Gateway）で進めたが、Issue4のapply直前に
# 過去2プロダクト（TaskManagement・Roami）の実績とAWS Cost Explorerの実課金（過去10ヶ月実質$0）
# を確認した結果、どちらもNAT Gateway不使用の最小構成だったと判明。講師に確認し
# 「NAT Gatewayは無くても問題ない」との回答を得たため、ECS Fargateはパブリックサブネット+SG絞り
# （Claude独自案）に変更した。講義No.39で「無料枠対象外のリソースは動作確認後terraform destroy
# してよい」という運用方針が明示されたため、以降のTerraform系Issueはapply→確認→destroyで進める。
# 07-1〜07-3（コード改修、課金なし）→07-4（VPC基盤、apply実地検証済み）まで完了。
# 新設されたcert-quizスキル（資格試験連動クイズ、7資格対象）を今回初めて使用し、
# AWS基礎知識の確認クイズ5問（正答率20%）を実施・記録した。詳細はObsidianの
# ClaudeCode-School「2026-10-14_AWSデプロイの技術解説とTerraform計画」を参照。
# 07-8〜07-10（2026-10-15〜16）でALB・ECSサービス・S3+CloudFrontを構築しdocsを確定。Terraform計画のIssue1〜10は完了。
# 課金リソースはすべてdestroy済み（待機中の無課金: ECR・ECSクラスター・ロググループ・IAMロール2つ）。
# 07-5〜07-7（2026-10-14〜15）でRDS・ECR・ECS+IAMをTerraform化。方針どおり「apply→確認→destroy」
# で進め、現在はVPC・RDSのみ破棄済み（課金なし）。ECRリポジトリ・ECSクラスター・IAMロール2つ
# （タスク実行ロール／タスクロールの最小権限分離）は待機中で無課金。ECS用SGは ingress なしで、
# 8080番の許可はIssue8でALB用SGと一緒に追加する。JWT署名鍵はSecrets Managerで注入すると決定済み
# （公開リポジトリのapplication.yml既定値が本番で使われるのを防ぐため）。
# 詳細はObsidianの ClaudeCode-School「2026-10-15_ECSのIAMロール分離とFargate単発起動」を参照。

# フェーズ09（E2Eテスト・講義No.36）は2026-10-07〜10-08に完了。Playwrightを採用し、
# Page Object Model・storageStateによる認証高速化を導入（ユーザー自身の計画と講師側
# ClaudeCodeの計画を比較検討して確定）。実装計画の正本は
# C:\Users\3fort\.claude\plans\e2e-playwright-e2e-atomic-lantern.md。
# 09-3のアクセシビリティテスト（axe-core）は実装中に実際のプロダクトコードの違反を2件検出し、
# その場で修正した：ブランドカラー#1D9BF0のコントラスト比不足（3:1→WCAG AA基準4.5:1を満たす
# #1A73C2に変更、16ファイル）、投稿カード/コメント一覧の著者アバターリンクの読み上げ名欠如
# （aria-label追加）。CIへの組み込みは次のCI/CD講義を踏まえて別途検討する方針で見送った
# （`playwright.config.ts`にCI用設定は用意済み）。

# ── 最終計測値（テスト実行に時間がかかるため手で更新） ──────────
MEASURED_AT="2026-10-14"
BACKEND_TESTS=399
FRONTEND_TESTS=312

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
