-- このスクリプトは raisetimeline_loadtest 専用。
-- 誤って開発用DB(raisetimeline)や結合テスト用DB(raisetimeline_test)に対して実行しないための安全装置
DO $$
BEGIN
  IF current_database() <> 'raisetimeline_loadtest' THEN
    RAISE EXCEPTION 'このスクリプトは raisetimeline_loadtest 専用です（現在接続中: %）', current_database();
  END IF;
END $$;

-- パスワードハッシュ生成にpgcryptoのcrypt()/gen_salt('bf')を使う。
-- Spring SecurityのBCryptPasswordEncoder（$2a$, strength 10）と形式・検証ともに互換性があることを
-- ローカルでログインAPI経由で確認済み（docs/performance-testing.md参照）。
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. テストユーザー100名（perfuser001〜perfuser100）
--    全員共通パスワード 'LoadTest123!'（シナリオ側のauth.jsもこの値を使う）
INSERT INTO users (display_name, email, password_hash, username)
SELECT
    'Perf User ' || i,
    'perfuser' || LPAD(i::text, 3, '0') || '@perfload.test',
    crypt('LoadTest123!', gen_salt('bf', 10)),
    'perfuser' || LPAD(i::text, 3, '0')
FROM generate_series(1, 100) AS i;

-- 2. 投稿10,000件（100ユーザーに均等分散、過去30日間のタイムスタンプ）
INSERT INTO posts (user_id, content, created_at, updated_at)
SELECT
    user_ids[1 + ((gs - 1) % array_length(user_ids, 1))],
    '[perfload] 投稿本文 ' || gs,
    CURRENT_TIMESTAMP - (random() * interval '30 days'),
    CURRENT_TIMESTAMP
FROM generate_series(1, 10000) AS gs,
     (SELECT array_agg(id ORDER BY id) AS user_ids FROM users WHERE username LIKE 'perfuser%') u;

-- 3. フォロー関係（各ユーザーがランダムに10〜30人をフォロー。自己フォローは除外）
INSERT INTO follows (follower_id, following_id)
SELECT follower.id, target.id
FROM (SELECT id FROM users WHERE username LIKE 'perfuser%') follower
CROSS JOIN LATERAL (
    SELECT id FROM users
    WHERE username LIKE 'perfuser%' AND id <> follower.id
    ORDER BY random()
    LIMIT (10 + floor(random() * 21))::int
) target
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- 4. いいね20,000件（重複（同一post×同一user）はON CONFLICTで自然に減る）
INSERT INTO likes (post_id, user_id)
SELECT
    post_ids[1 + floor(random() * array_length(post_ids, 1))::int],
    user_ids[1 + floor(random() * array_length(user_ids, 1))::int]
FROM generate_series(1, 20000),
     (SELECT array_agg(id) AS post_ids FROM posts WHERE content LIKE '[perfload]%') p,
     (SELECT array_agg(id) AS user_ids FROM users WHERE username LIKE 'perfuser%') u
ON CONFLICT (post_id, user_id) DO NOTHING;

-- 5. コメント5,000件
INSERT INTO comments (post_id, user_id, content, created_at)
SELECT
    post_ids[1 + floor(random() * array_length(post_ids, 1))::int],
    user_ids[1 + floor(random() * array_length(user_ids, 1))::int],
    '[perfload] コメント本文 ' || gs,
    CURRENT_TIMESTAMP - (random() * interval '30 days')
FROM generate_series(1, 5000) AS gs,
     (SELECT array_agg(id) AS post_ids FROM posts WHERE content LIKE '[perfload]%') p,
     (SELECT array_agg(id) AS user_ids FROM users WHERE username LIKE 'perfuser%') u;

-- 投入結果の確認（npm run seed 実行時に目視できるように表示する）
SELECT 'users' AS table_name, count(*) AS rows FROM users WHERE username LIKE 'perfuser%'
UNION ALL
SELECT 'posts', count(*) FROM posts WHERE content LIKE '[perfload]%'
UNION ALL
SELECT 'follows', count(*) FROM follows f
    JOIN users u ON u.id = f.follower_id WHERE u.username LIKE 'perfuser%'
UNION ALL
SELECT 'likes', count(*) FROM likes l
    JOIN users u ON u.id = l.user_id WHERE u.username LIKE 'perfuser%'
UNION ALL
SELECT 'comments', count(*) FROM comments c
    JOIN users u ON u.id = c.user_id WHERE u.username LIKE 'perfuser%';
