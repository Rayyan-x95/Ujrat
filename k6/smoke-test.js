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
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';

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

  sleep(1);
}