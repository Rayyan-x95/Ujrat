import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
const SUPABASE_URL = __ENV.SUPABASE_URL || BASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || __ENV.VITE_SUPABASE_ANON_KEY || 'anon';

export default function () {
  // Test login page
  const loginRes = http.get(`${BASE_URL}/login`);
  const loginCheck = check(loginRes, {
    'login page loads': (r) => r.status === 200,
    'login page has form': (r) => r.body.includes('Sign In'),
  });
  if (!loginCheck) errorRate.add(1);

  sleep(1);

  // Test invalid portal token
  const portalRes = http.get(`${BASE_URL}/portal/invalid-token`);
  const portalCheck = check(portalRes, {
    'portal shows error': (r) => r.status === 200 && r.body.includes('Security'),
  });
  if (!portalCheck) errorRate.add(1);

  sleep(1);

  // Test static assets
  const cssRes = http.get(`${BASE_URL}/dist/assets/index.css`);
  const cssCheck = check(cssRes, {
    'css loads': (r) => r.status === 200,
  });
  if (!cssCheck) errorRate.add(1);

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