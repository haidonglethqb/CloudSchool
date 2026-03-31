import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;
let staffCtx: APIRequestContext;
let parentCtx: APIRequestContext;
let teacherCtx: APIRequestContext;

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN');
  staffCtx = await createAuthContext('STAFF');
  parentCtx = await createAuthContext('PARENT');
  teacherCtx = await createAuthContext('TEACHER');
});

test.afterAll(async () => {
  await superAdminCtx.dispose();
  await staffCtx.dispose();
  await parentCtx.dispose();
  await teacherCtx.dispose();
});

test.describe('Fees', () => {
  let createdFeeId: string;

  test.describe('List Fees', () => {
    test('SUPER_ADMIN can list fees', async () => {
      const response = await superAdminCtx.get('/api/fees');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const fees = body.data;
      expect(Array.isArray(fees)).toBe(true);
    });

    test('TEACHER cannot list fees', async () => {
      const response = await teacherCtx.get('/api/fees');
      expect(response.status()).toBe(403);
    });
  });

  test.describe('Create Fee', () => {
    test('STAFF can create fee', async () => {
      const response = await staffCtx.post('/api/fees', {
        data: {
          name: 'Học phí AutoTest',
          amount: 1500000,
          category: 'TUITION',
          dueDate: '2025-03-31',
        },
      });
      expect([200, 201]).toContain(response.status());

      if (response.ok()) {
        const body = await response.json();
        createdFeeId = body.data?.id;
      }
    });

    test('create fee without amount returns 400', async () => {
      const response = await staffCtx.post('/api/fees', {
        data: {
          name: 'Missing Amount Fee',
          category: 'TUITION',
        },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Get Fee Detail', () => {
    test('get fee by ID', async () => {
      if (!createdFeeId) {
        test.skip();
        return;
      }

      const response = await superAdminCtx.get(`/api/fees/${createdFeeId}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      const fee = body.data;
      expect(fee.name).toBe('Học phí AutoTest');
    });
  });

  test.describe('Parent Fee View', () => {
    test('PARENT can view their childrens fees', async () => {
      const response = await parentCtx.get('/api/fees/parent/my-fees');
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Delete Fee', () => {
    test('SUPER_ADMIN can delete fee', async () => {
      if (!createdFeeId) {
        test.skip();
        return;
      }

      const response = await superAdminCtx.delete(`/api/fees/${createdFeeId}`);
      expect([200, 204]).toContain(response.status());
    });
  });
});
