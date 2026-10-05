import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { login, authHeaders } from './auth.js';

// open()はinitコンテキスト（スクリプト読み込み時）でしか呼べないため、トップレベルで読み込む。
// パスはこのファイル（post.js）からの相対パス。
const testImage = open('../data/test-image.jpg', 'b');

// 投稿作成シナリオ。マルチパート（content + image）で送る。
export function postScenario() {
  const session = login();
  if (!session) return;

  const headers = authHeaders(session.accessToken);

  const payload = {
    content: `[perfload] k6投稿 ${Date.now()}`,
    image: http.file(testImage, 'test-image.jpg', 'image/jpeg'),
  };

  const res = http.post(`${BASE_URL}/api/posts`, payload, {
    headers,
    tags: { scenario: 'post' },
  });

  check(res, {
    'post: ステータス201': (r) => r.status === 201,
  });
}
