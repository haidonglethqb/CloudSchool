import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  test('GET /health response has valid ISO timestamp', async ({ request }) => {
    const response = await request.get('/health');
    const body = await response.json();

    const date = new Date(body.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });

  test('GET unknown route returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent-route');
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
