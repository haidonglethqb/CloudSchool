import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext, assertStatus } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN');
});

test.afterAll(async () => {
  await superAdminCtx.dispose();
});

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('tenant user login with valid credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'admin@demo.school.vn',
          password: 'admin123',
          tenantCode: 'THPT-DEMO',
        },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user).toBeTruthy();
      expect(body.user.email).toBe('admin@demo.school.vn');
      expect(body.user.role).toBe('SUPER_ADMIN');

      const cookies = response.headers()['set-cookie'];
      expect(cookies).toContain('token=');
      expect(cookies).toContain('httponly');
    });

    test('platform admin login without tenantCode', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'admin@cloudschool.vn',
          password: 'admin123',
        },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user.role).toBe('PLATFORM_ADMIN');
    });

    test('login with invalid password returns 401', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'admin@demo.school.vn',
          password: 'wrongpassword',
          tenantCode: 'THPT-DEMO',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('login with invalid tenantCode returns 401', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'admin@demo.school.vn',
          password: 'admin123',
          tenantCode: 'INVALID-CODE',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('login with missing email returns 400', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          password: 'admin123',
          tenantCode: 'THPT-DEMO',
        },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Current User', () => {
    test('GET /api/auth/me returns current user', async () => {
      const response = await superAdminCtx.get('/api/auth/me');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user).toBeTruthy();
      expect(body.user.email).toBe('admin@demo.school.vn');
      expect(body.user.role).toBe('SUPER_ADMIN');
    });

    test('GET /api/auth/me without token returns 401', async ({ request }) => {
      const response = await request.get('/api/auth/me');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Logout', () => {
    test('POST /api/auth/logout clears token cookie', async () => {
      const response = await superAdminCtx.post('/api/auth/logout');
      expect(response.status()).toBe(200);

      const cookies = response.headers()['set-cookie'];
      if (cookies) {
        expect(cookies).toContain('token=');
      }
    });
  });

  test.describe('Subscription Plans', () => {
    test('GET /api/auth/plans returns plans (public)', async ({ request }) => {
      const response = await request.get('/api/auth/plans');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.plans || body)).toBe(true);
    });
  });
});
