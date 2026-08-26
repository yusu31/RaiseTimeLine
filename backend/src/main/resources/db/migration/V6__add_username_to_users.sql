-- users テーブルに @ユーザー名（username）を追加する。
-- 既存行が存在する状態で NOT NULL 列をいきなり追加すると失敗するため、次の4段階に分けて適用する。

-- 1. まずは NULL を許容する状態で列を追加する
ALTER TABLE users ADD COLUMN username VARCHAR(15);

-- 2. 既存ユーザーには id を使った一意な仮の名前を割り当てる（例: user1, user2 ...）
UPDATE users SET username = 'user' || id WHERE username IS NULL;

-- 3. 全行が埋まったので必須列に変更する
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- 4. 一意制約を付ける（UNIQUE 制約により検索用のインデックスも自動で作成される）
ALTER TABLE users ADD CONSTRAINT uk_users_username UNIQUE (username);
