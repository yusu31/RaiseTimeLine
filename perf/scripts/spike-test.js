import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { thresholds } from '../config/thresholds.js';
import { timelineScenario } from '../scenarios/timeline.js';
import { postScenario } from '../scenarios/post.js';
import { interactionScenario } from '../scenarios/interaction.js';
import { profileScenario } from '../scenarios/profile.js';

// スパイクテスト: 急激な負荷変動に耐えられるかを見る。
export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 150 },
    { duration: '2m', target: 10 },
  ],
  thresholds,
};

const actions = [timelineScenario, postScenario, interactionScenario, profileScenario];

export default function () {
  const action = actions[Math.floor(Math.random() * actions.length)];
  action();
  sleep(1);
}

export function handleSummary(data) {
  return {
    'results/spike-test-report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
