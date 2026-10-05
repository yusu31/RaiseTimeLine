import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { thresholds } from '../config/thresholds.js';
import { timelineScenario } from '../scenarios/timeline.js';
import { postScenario } from '../scenarios/post.js';
import { interactionScenario } from '../scenarios/interaction.js';
import { profileScenario } from '../scenarios/profile.js';

// ストレステスト（限界探索）: 段階的に負荷を上げ、どこで崩れるかを見る。
// エラー率1%超過またはP95が2秒超過した段階を限界値とする（判断は実行結果を見て人が行う）。
export const options = {
  stages: [
    { duration: '3m', target: 10 },
    { duration: '3m', target: 30 },
    { duration: '3m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '3m', target: 150 },
    { duration: '3m', target: 200 },
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
    'results/stress-test-report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
