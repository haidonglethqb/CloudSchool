import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN');
});

test.afterAll(async () => {
  await superAdminCtx.dispose();
});

test.describe('Concurrent Load Tests', () => {
  test('handle 10 concurrent GET /api/students', async () => {
    const start = Date.now();
    const promises = Array.from({ length: 10 }, () =>
      superAdminCtx.get('/api/students')
    );

    const responses = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    for (const res of responses) {
      expect(res.status()).toBe(200);
    }

    console.log(`  10 concurrent /api/students: ${totalDuration}ms total`);
    expect(totalDuration).toBeLessThan(5000);
  });

  test('handle 10 concurrent GET /api/classes', async () => {
    const start = Date.now();
    const promises = Array.from({ length: 10 }, () =>
      superAdminCtx.get('/api/classes')
    );

    const responses = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    for (const res of responses) {
      expect(res.status()).toBe(200);
    }

    console.log(`  10 concurrent /api/classes: ${totalDuration}ms total`);
    expect(totalDuration).toBeLessThan(5000);
  });

  test('handle 20 concurrent mixed GET requests', async () => {
    const start = Date.now();
    const endpoints = [
      '/api/students', '/api/classes', '/api/subjects', '/api/settings',
      '/api/students', '/api/classes', '/api/subjects', '/api/settings',
      '/api/students', '/api/classes', '/api/subjects', '/api/settings',
      '/api/students', '/api/classes', '/api/subjects', '/api/settings',
      '/api/students', '/api/classes', '/api/subjects', '/api/settings',
    ];

    const promises = endpoints.map((ep) => superAdminCtx.get(ep));
    const responses = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    let successCount = 0;
    for (const res of responses) {
      if (res.status() === 200) successCount++;
    }

    console.log(`  20 mixed concurrent: ${totalDuration}ms, ${successCount}/20 success`);
    // At least 90% should succeed (rate limiting may kick in)
    expect(successCount).toBeGreaterThanOrEqual(18);
    expect(totalDuration).toBeLessThan(10000);
  });

  test('handle 5 concurrent POST /api/auth/login', async ({ request }) => {
    const start = Date.now();
    const promises = Array.from({ length: 5 }, () =>
      request.post('/api/auth/login', {
        data: {
          email: 'staff@demo.school.vn',
          password: 'staff123',
          tenantCode: 'THPT-DEMO',
        },
      })
    );

    const responses = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    let successCount = 0;
    for (const res of responses) {
      if (res.status() === 200) successCount++;
    }

    console.log(`  5 concurrent logins: ${totalDuration}ms, ${successCount}/5 success`);
    // Some may be rate-limited, but at least 3 should succeed
    expect(successCount).toBeGreaterThanOrEqual(3);
  });

  test('handle 50 concurrent GET /health', async ({ request }) => {
    const start = Date.now();
    const promises = Array.from({ length: 50 }, () => request.get('/health'));

    const responses = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    let successCount = 0;
    for (const res of responses) {
      if (res.status() === 200) successCount++;
    }

    console.log(`  50 concurrent /health: ${totalDuration}ms, ${successCount}/50 success`);
    expect(successCount).toBeGreaterThanOrEqual(45);
    expect(totalDuration).toBeLessThan(10000);
  });
});
