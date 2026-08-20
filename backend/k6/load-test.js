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
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
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

  sleep(1);
}