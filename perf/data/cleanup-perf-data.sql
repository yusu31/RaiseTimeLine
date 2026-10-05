-- このスクリプトは raisetimeline_loadtest 専用。
-- 誤って開発用DB(raisetimeline)や結合テスト用DB(raisetimeline_test)に対して実行しないための安全装置
DO $$
BEGIN
  IF current_database() <> 'raisetimeline_loadtest' THEN
    RAISE EXCEPTION 'このスクリプトは raisetimeline_loadtest 専用です（現在接続中: %）', current_database();
  END IF;
END $$;

-- users を削除するだけでよい理由：
-- posts/comments/likes/follows/refresh_tokens はすべて user_id に
-- ON DELETE CASCADE が設定されている（V2, V3, V4, V5, V8 マイグレーション）。
-- そのため users を消すと関連データが自動的にすべて消える
DELETE FROM users WHERE username LIKE 'perfuser%';

-- 削除結果の確認（0件になっていることを目視できるように表示する）
SELECT 'users' AS table_name, count(*) AS remaining_rows FROM users WHERE username LIKE 'perfuser%'
UNION ALL
SELECT 'posts', count(*) FROM posts WHERE content LIKE '[perfload]%';
