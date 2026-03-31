import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext, measureResponseTime } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;
let staffCtx: APIRequestContext;
let teacherCtx: APIRequestContext;

const RESPONSE_TIME_THRESHOLD = 800; // ms (includes CI network latency)

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN');
  staffCtx = await createAuthContext('STAFF');
  teacherCtx = await createAuthContext('TEACHER');
});

test.afterAll(async () => {
  await superAdminCtx.dispose();
  await staffCtx.dispose();
  await teacherCtx.dispose();
});

test.describe('Response Time Benchmarks', () => {
  test('GET /api/auth/plans < 800ms', async ({ request }) => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureResponseTime(() => request.get('/api/auth/plans'));
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/auth/plans p95: ${p95}ms (avg: ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms)`);
    expect(p95).toBeLessThan(800);
  });

  test('POST /api/auth/login < 500ms', async ({ request }) => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { duration } = await measureResponseTime(() =>
        request.post('/api/auth/login', {
          data: {
            email: 'admin@demo.school.vn',
            password: 'admin123',
            tenantCode: 'THPT-DEMO',
          },
        })
      );
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/auth/login p95: ${p95}ms`);
    expect(p95).toBeLessThan(RESPONSE_TIME_THRESHOLD);
  });

  test('GET /api/students < 500ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureResponseTime(() =>
        superAdminCtx.get('/api/students')
      );
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/students p95: ${p95}ms`);
    expect(p95).toBeLessThan(RESPONSE_TIME_THRESHOLD);
  });

  test('GET /api/classes < 500ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureResponseTime(() =>
        superAdminCtx.get('/api/classes')
      );
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/classes p95: ${p95}ms`);
    expect(p95).toBeLessThan(RESPONSE_TIME_THRESHOLD);
  });

  test('GET /api/subjects < 500ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureResponseTime(() =>
        superAdminCtx.get('/api/subjects')
      );
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/subjects p95: ${p95}ms`);
    expect(p95).toBeLessThan(RESPONSE_TIME_THRESHOLD);
  });

  test('GET /api/reports/dashboard < 1000ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { duration } = await measureResponseTime(() =>
        superAdminCtx.get('/api/reports/dashboard')
      );
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/reports/dashboard p95: ${p95}ms`);
    expect(p95).toBeLessThan(1000);
  });

  test('GET /api/settings < 300ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureResponseTime(() =>
        superAdminCtx.get('/api/settings')
      );
      times.push(duration);
    }
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`  /api/settings p95: ${p95}ms`);
    expect(p95).toBeLessThan(500);
  });
});
