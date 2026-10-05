import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { login, authHeaders } from './auth.js';

// タイムライン閲覧シナリオ。全体タブ・フォロー中タブ・ページ送りを一通り叩く。
export function timelineScenario() {
  const session = login();
  if (!session) return;

  const headers = authHeaders(session.accessToken);

  // 全体タイムライン（1ページ目）
  const resAll = http.get(`${BASE_URL}/api/posts?page=0&size=20`, {
    headers,
    tags: { scenario: 'timeline' },
  });
  check(resAll, {
    'timeline(all): ステータス200': (r) => r.status === 200,
    'timeline(all): postsを含む': (r) => Array.isArray(r.json('posts')),
  });

  // 次ページ（hasNextがtrueのときのみ意味があるが、存在確認のみ行う）
  http.get(`${BASE_URL}/api/posts?page=1&size=20`, {
    headers,
    tags: { scenario: 'timeline' },
  });

  // フォロー中タブ
  const resFollowing = http.get(`${BASE_URL}/api/posts?page=0&size=20&timeline=following`, {
    headers,
    tags: { scenario: 'timeline' },
  });
  check(resFollowing, {
    'timeline(following): ステータス200': (r) => r.status === 200,
  });
}
