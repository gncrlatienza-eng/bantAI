// bantAI load test — Sprint 5 (WBS 5.4.2)
//
// Prerequisites: install k6 — https://k6.io/docs/getting-started/installation
//
// Run against local dev server (auth not required for ingest in dev mode):
//   k6 run test/load/k6.js
//
// Run with a real JWT token (required for reports endpoint):
//   k6 run test/load/k6.js \
//     --env BASE_URL=http://localhost:3000/api \
//     --env JWT_TOKEN=<your-token>
//
// Override VU count and duration:
//   k6 run test/load/k6.js --vus 100 --duration 2m
//
// Pass/fail thresholds: p95 < 500 ms, error rate < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';

// 5 VUs stays under the 120 req/min global rate limit (each VU: 3 calls + 1s sleep).
export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const authHeaders = JWT_TOKEN
  ? { Authorization: `Bearer ${JWT_TOKEN}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' };

// POST /api/sms/ingest — primary classification hot path
function testIngest() {
  const payload = JSON.stringify({
    sender: '+639171234567',
    body: 'Congratulations! You won. Click http://bit.ly/claimprize to collect.',
    receivedAt: new Date().toISOString(),
  });
  const res = http.post(`${BASE_URL}/sms/ingest`, payload, {
    headers: authHeaders,
  });
  check(res, {
    'ingest 201': (r) => r.status === 201,
    'ingest has messageId': (r) => {
      try {
        return !!JSON.parse(r.body).messageId;
      } catch {
        return false;
      }
    },
  });
}

// GET /api/campaigns — list active campaign clusters
function testCampaigns() {
  const res = http.get(`${BASE_URL}/campaigns`, { headers: authHeaders });
  check(res, { 'campaigns 200': (r) => r.status === 200 });
}

// GET /api/reports — admin report list (200 with admin token, 401 with user token)
// responseCallback marks 401 as expected so it doesn't inflate http_req_failed.
function testReports() {
  const res = http.get(`${BASE_URL}/reports`, {
    headers: authHeaders,
    responseCallback: http.expectedStatuses(200, 401),
  });
  check(res, {
    'reports 200 or 401': (r) => r.status === 200 || r.status === 401,
  });
}

export default function () {
  testIngest();
  testCampaigns();
  testReports();
  sleep(1);
}
