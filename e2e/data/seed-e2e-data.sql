-- このスクリプトは raisetimeline_e2e 専用。
-- 誤って開発用DB(raisetimeline)や他のテスト用DBに対して実行しないための安全装置
DO $$
BEGIN
  IF current_database() <> 'raisetimeline_e2e' THEN
    RAISE EXCEPTION 'このスクリプトは raisetimeline_e2e 専用です（現在接続中: %）', current_database();
  END IF;
END $$;

-- パスワードハッシュ生成にpgcryptoのcrypt()/gen_salt('bf')を使う。
-- perf/data/seed-perf-data.sql と同じ方式（Spring SecurityのBCryptPasswordEncoderと互換性あり）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 固定ユーザー3名。共通パスワード 'E2eTestPass1'（E2Eテストコード側もこの値を使う）
INSERT INTO users (display_name, email, password_hash, username)
VALUES
    ('E2E Alice', 'e2euser_alice@e2etest.local', crypt('E2eTestPass1', gen_salt('bf', 10)), 'e2euser_alice'),
    ('E2E Bob', 'e2euser_bob@e2etest.local', crypt('E2eTestPass1', gen_salt('bf', 10)), 'e2euser_bob'),
    ('E2E Charlie', 'e2euser_charlie@e2etest.local', crypt('E2eTestPass1', gen_salt('bf', 10)), 'e2euser_charlie');

-- aliceの投稿を2件（検索シナリオ用のキーワードを含む）
INSERT INTO posts (user_id, content, created_at, updated_at)
SELECT id, 'E2Eテストの固定投稿です。検索キーワード: raisetech', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users WHERE username = 'e2euser_alice';

INSERT INTO posts (user_id, content, created_at, updated_at)
SELECT id, 'E2Eテストの固定投稿その2です。', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users WHERE username = 'e2euser_alice';

-- bobの投稿を25件（timeline.spec.tsの無限スクロールシナリオ用。1ページ20件のため21件以上必要）
INSERT INTO posts (user_id, content, created_at, updated_at)
SELECT
    id,
    'E2Eテスト用タイムライン投稿 ' || gs,
    CURRENT_TIMESTAMP - (gs || ' minutes')::interval,
    CURRENT_TIMESTAMP - (gs || ' minutes')::interval
FROM users, generate_series(1, 25) AS gs
WHERE username = 'e2euser_bob';

-- charlieの投稿を2件（timeline.spec.tsの「フォロー中」タブ表示確認用。aliceがcharlieをフォロー済みのため）
INSERT INTO posts (user_id, content, created_at, updated_at)
SELECT id, 'E2Eテスト用フォロー中タイムライン投稿1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users WHERE username = 'e2euser_charlie';

INSERT INTO posts (user_id, content, created_at, updated_at)
SELECT id, 'E2Eテスト用フォロー中タイムライン投稿2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users WHERE username = 'e2euser_charlie';

-- alice -> charlie のフォロー関係を1件事前投入（follow解除シナリオの初期状態として使う）
INSERT INTO follows (follower_id, following_id)
SELECT a.id, c.id
FROM users a, users c
WHERE a.username = 'e2euser_alice' AND c.username = 'e2euser_charlie';

-- 投入結果の確認（global-setup実行時に目視できるように表示する）
SELECT 'users' AS table_name, count(*) AS rows FROM users WHERE username LIKE 'e2euser_%'
UNION ALL
SELECT 'posts', count(*) FROM posts p JOIN users u ON u.id = p.user_id WHERE u.username LIKE 'e2euser_%'
UNION ALL
SELECT 'follows', count(*) FROM follows f JOIN users u ON u.id = f.follower_id WHERE u.username LIKE 'e2euser_%';
