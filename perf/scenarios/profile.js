import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { login, authHeaders } from './auth.js';

// プロフィール閲覧シナリオ。ユーザー名はログイン結果（データ）から取得する。
export function profileScenario() {
  const session = login();
  if (!session) return;
  const headers = authHeaders(session.accessToken);

  const profileRes = http.get(`${BASE_URL}/api/users/${session.username}`, {
    headers,
    tags: { scenario: 'profile' },
  });
  check(profileRes, {
    'profile: ステータス200': (r) => r.status === 200,
  });

  const postsRes = http.get(`${BASE_URL}/api/users/${session.username}/posts?page=0&size=20`, {
    headers,
    tags: { scenario: 'profile' },
  });
  check(postsRes, {
    'profile(posts): ステータス200': (r) => r.status === 200,
  });
}
