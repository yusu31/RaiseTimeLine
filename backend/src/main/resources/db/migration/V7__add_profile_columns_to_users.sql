-- users テーブルにプロフィール用の列（自己紹介・アイコン画像）を追加する。
-- どちらも未設定を許す列なので、V6 の username のような段階的な移行は不要で
-- NULL 許容のまま追加するだけでよい。

-- 自己紹介。アプリ側では160文字以内に制限するが、
-- 上限を将来変更しやすいよう DB は長さ無制限の TEXT にしておく
ALTER TABLE users ADD COLUMN bio TEXT;

-- アイコン画像の「保存パス」。URL ではなくパスを持つ点に注意。
-- posts.image_path と同じ方針で、公開URLへの変換は StorageService が行う。
-- フルURLを保存すると、ローカル保存から S3 へ移行したときに全行が使えなくなるため
ALTER TABLE users ADD COLUMN icon_image_path VARCHAR(255);
