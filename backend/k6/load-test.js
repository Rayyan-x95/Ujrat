import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 25 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
const SUPABASE_URL = __ENV.SUPABASE_URL || BASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || __ENV.VITE_SUPABASE_ANON_KEY || 'anon';
const errorRate = new Rate('errors');

export default function () {
  const endpoints = [
    { path: '/login', name: 'Login Page' },
    { path: '/portal/invalid-token', name: 'Portal Error' },
  ];

  for (const endpoint of endpoints) {
    const res = http.get(`${BASE_URL}${endpoint.path}`);
    const checkResult = check(res, {
      [`${endpoint.name} loads`]: (r) => r.status === 200,
    });
    if (!checkResult) errorRate.add(1);
    sleep(0.5);
  }

  // Track 6 smoke: read-only dashboard RPC (no money writes).
  const rpcRes = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_dashboard_data`,
    JSON.stringify({ p_workspace_id: '00000000-0000-0000-0000-000000000000', p_profile_id: '' }),
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' } }
  );
  const rpcCheck = check(rpcRes, {
    'dashboard RPC responds (200/401)': (r) => r.status === 200 || r.status === 401,
  });
  if (!rpcCheck) errorRate.add(1);

  sleep(1);
}