import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { login, authHeaders } from './auth.js';

// 投稿IDはデータから動的に取得する（固定IDだとシードし直すたびに壊れるため）。
function pickRandomPostId(headers) {
  const res = http.get(`${BASE_URL}/api/posts?page=0&size=20`, {
    headers,
    tags: { scenario: 'timeline' },
  });
  const posts = res.json('posts');
  if (!posts || posts.length === 0) return null;
  const idx = Math.floor(Math.random() * posts.length);
  return posts[idx].id;
}

// いいね・コメントシナリオ。
export function interactionScenario() {
  const session = login();
  if (!session) return;
  const headers = authHeaders(session.accessToken);

  const postId = pickRandomPostId(headers);
  if (!postId) return;

  // いいね → 取り消し（冪等性ロジックの負荷確認）
  const likeRes = http.post(`${BASE_URL}/api/posts/${postId}/likes`, null, {
    headers,
    tags: { scenario: 'like' },
  });
  check(likeRes, {
    'like: ステータス200': (r) => r.status === 200,
  });

  http.del(`${BASE_URL}/api/posts/${postId}/likes`, null, {
    headers,
    tags: { scenario: 'like' },
  });

  // コメント一覧取得 → 投稿
  const listRes = http.get(`${BASE_URL}/api/posts/${postId}/comments`, {
    headers,
    tags: { scenario: 'comments' },
  });
  check(listRes, {
    'comments(list): ステータス200': (r) => r.status === 200,
  });

  const createRes = http.post(
    `${BASE_URL}/api/posts/${postId}/comments`,
    JSON.stringify({ content: `[perfload] k6コメント ${Date.now()}` }),
    {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { scenario: 'comments' },
    }
  );
  check(createRes, {
    'comments(create): ステータス201': (r) => r.status === 201,
  });
}
