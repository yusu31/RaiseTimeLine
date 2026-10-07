-- このスクリプトは raisetimeline_e2e 専用。
DO $$
BEGIN
  IF current_database() <> 'raisetimeline_e2e' THEN
    RAISE EXCEPTION 'このスクリプトは raisetimeline_e2e 専用です（現在接続中: %）', current_database();
  END IF;
END $$;

-- users を削除するだけでよい。posts/comments/likes/follows はすべて
-- user_id に ON DELETE CASCADE が設定されている。
-- 新規登録シナリオが作るユーザーは e2euser_signup_ プレフィックスで統一しているため、
-- e2euser_ 全体を対象にすれば固定ユーザーとテスト生成ユーザーの両方が消える
DELETE FROM users WHERE username LIKE 'e2euser_%';
