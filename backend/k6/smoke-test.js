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
  // SPA: the HTML shell itself carries no "Sign In" text (the app renders
  // client-side). Assert what actually ships: the app root + a script tag.
  const loginRes = http.get(`${BASE_URL}/login`);
  const loginCheck = check(loginRes, {
    'login page loads': (r) => r.status === 200,
    'spa shell has app root': (r) => r.body.includes('id="root"'),
  });
  if (!loginCheck) errorRate.add(1);

  sleep(1);

  // Prerendered marketing page: /pricing must contain its H1 server-side.
  const pricingRes = http.get(`${BASE_URL}/pricing`);
  const pricingCheck = check(pricingRes, {
    'pricing is prerendered': (r) => r.status === 200 && r.body.includes('<h1'),
  });
  if (!pricingCheck) errorRate.add(1);

  sleep(1);

  // robots.txt ships (200 + Allow directive) — crawl-critical.
  const robotsRes = http.get(`${BASE_URL}/robots.txt`);
  const robotsCheck = check(robotsRes, {
    'robots.txt served': (r) => r.status === 200 && r.body.includes('User-agent'),
  });
  if (!robotsCheck) errorRate.add(1);

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
