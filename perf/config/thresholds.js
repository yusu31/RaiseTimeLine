// パフォーマンス合格基準。
// docs/requirements.md 5.2節「各操作のレスポンス1秒以内」を上限の契約値とし、
// 各エンドポイントの内部目標値はそれより厳しく設定する（根拠は docs/performance-testing.md）。
export const thresholds = {
  'http_req_duration{scenario:login}': ['p(95)<800'],
  'http_req_duration{scenario:timeline}': ['p(95)<500'],
  'http_req_duration{scenario:post}': ['p(95)<1000'],
  'http_req_duration{scenario:like}': ['p(95)<300'],
  'http_req_duration{scenario:comments}': ['p(95)<500'],
  'http_req_duration{scenario:profile}': ['p(95)<400'],
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['avg<500'],
};
