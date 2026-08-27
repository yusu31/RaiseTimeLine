CREATE TABLE follows (
    id           BIGSERIAL PRIMARY KEY,
    follower_id  BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 同じ相手を二重にフォローできないようにする。アプリ側は ON CONFLICT DO NOTHING で冪等にする
    CONSTRAINT uk_follows UNIQUE (follower_id, following_id),
    -- 自己フォローの最後の砦。一次防衛はService層（CHECK違反は500になるため素通りさせない）
    CONSTRAINT ck_follows_not_self CHECK (follower_id <> following_id)
);

-- 「誰にフォローされているか」（フォロワー一覧）の検索用。
-- follower_id 側は uk_follows の複合インデックス先頭列で代用できるため別途作らない
CREATE INDEX idx_follows_following_id ON follows(following_id);
