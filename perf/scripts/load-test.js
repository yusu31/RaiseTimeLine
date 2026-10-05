import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { thresholds } from '../config/thresholds.js';
import { timelineScenario } from '../scenarios/timeline.js';
import { postScenario } from '../scenarios/post.js';
import { interactionScenario } from '../scenarios/interaction.js';
import { profileScenario } from '../scenarios/profile.js';

// 通常負荷テスト: 2分かけて50VUsまでランプアップ→10分維持→2分でランプダウン。
// ユーザー配分: Timeline 60% / Post 15% / Interaction 15% / Profile 10%
export const options = {
  scenarios: {
    timeline: {
      executor: 'ramping-vus',
      exec: 'timeline',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '10m', target: 30 },
        { duration: '2m', target: 0 },
      ],
    },
    post: {
      executor: 'ramping-vus',
      exec: 'post',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 8 },
        { duration: '10m', target: 8 },
        { duration: '2m', target: 0 },
      ],
    },
    interaction: {
      executor: 'ramping-vus',
      exec: 'interaction',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 8 },
        { duration: '10m', target: 8 },
        { duration: '2m', target: 0 },
      ],
    },
    profile: {
      executor: 'ramping-vus',
      exec: 'profile',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 5 },
        { duration: '10m', target: 5 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds,
};

export function timeline() {
  timelineScenario();
  sleep(1);
}
export function post() {
  postScenario();
  sleep(1);
}
export function interaction() {
  interactionScenario();
  sleep(1);
}
export function profile() {
  profileScenario();
  sleep(1);
}

export function handleSummary(data) {
  return {
    'results/load-test-report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
