import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;
let staffCtx: APIRequestContext;
let teacherCtx: APIRequestContext;

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

test.describe('Settings', () => {
  test.describe('Get Settings', () => {
    test('authenticated user can read settings', async () => {
      const response = await teacherCtx.get('/api/settings');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const settings = body.data;
      expect(settings).toBeTruthy();
      expect(settings.minAge).toBeDefined();
      expect(settings.maxAge).toBeDefined();
      expect(settings.maxClassSize).toBeDefined();
      expect(settings.passScore).toBeDefined();
    });
  });

  test.describe('Update Settings', () => {
    test('SUPER_ADMIN can update settings', async () => {
      const response = await superAdminCtx.put('/api/settings', {
        data: {
          minAge: 15,
          maxAge: 20,
          maxClassSize: 40,
          passScore: 5.0,
        },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      const settings = body.data;
      expect(settings.maxClassSize).toBe(40);
    });

    test('STAFF cannot update settings', async () => {
      const response = await staffCtx.put('/api/settings', {
        data: { maxClassSize: 50 },
      });
      expect(response.status()).toBe(403);
    });

    test('TEACHER cannot update settings', async () => {
      const response = await teacherCtx.put('/api/settings', {
        data: { passScore: 3.0 },
      });
      expect(response.status()).toBe(403);
    });

    test('invalid settings values return 400', async () => {
      const response = await superAdminCtx.put('/api/settings', {
        data: {
          minAge: -1,
        },
      });
      expect(response.status()).toBe(400);
    });
  });
});
