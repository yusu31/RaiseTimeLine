// ベースURL。環境変数 BASE_URL で切替可能（既定はローカルのバックエンド）
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// seed-perf-data.sql で作成したテストユーザーの共通パスワード
export const PERF_USER_PASSWORD = 'LoadTest123!';
export const PERF_USER_COUNT = 100;

export function randomPerfUsername() {
  const n = Math.floor(Math.random() * PERF_USER_COUNT) + 1;
  return 'perfuser' + String(n).padStart(3, '0');
}

export function randomPerfEmail(username) {
  return `${username}@perfload.test`;
}
