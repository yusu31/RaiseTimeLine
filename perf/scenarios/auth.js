import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PERF_USER_PASSWORD, randomPerfUsername, randomPerfEmail } from '../config/config.js';

// ランダムなテストユーザーでログインし、アクセストークンを取得する共通関数。
// 戻り値が null の場合は呼び出し側で以降の処理をスキップすること（失敗を握りつぶさないため）。
export function login() {
  const username = randomPerfUsername();
  const email = randomPerfEmail(username);

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password: PERF_USER_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'login' },
    }
  );

  const ok = check(res, {
    'login: ステータス200': (r) => r.status === 200,
    'login: accessTokenが返る': (r) => !!r.json('accessToken'),
  });

  if (!ok) {
    return null;
  }

  const body = res.json();
  return {
    accessToken: body.accessToken,
    userId: body.user.id,
    username: body.user.username,
  };
}

export function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}
