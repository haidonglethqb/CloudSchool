import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('GET /api/auth/plans returns 200 (public endpoint health check)', async ({ request }) => {
    const response = await request.get('/api/auth/plans');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toBeTruthy();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API returns valid JSON responses', async ({ request }) => {
    const response = await request.get('/api/auth/plans');
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('GET unknown route returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent-route');
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
