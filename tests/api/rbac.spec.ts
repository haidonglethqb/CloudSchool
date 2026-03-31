import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;
let staffCtx: APIRequestContext;
let teacherCtx: APIRequestContext;
let parentCtx: APIRequestContext;

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN');
  staffCtx = await createAuthContext('STAFF');
  teacherCtx = await createAuthContext('TEACHER');
  parentCtx = await createAuthContext('PARENT');
});

test.afterAll(async () => {
  await superAdminCtx.dispose();
  await staffCtx.dispose();
  await teacherCtx.dispose();
  await parentCtx.dispose();
});

test.describe('RBAC - Role-Based Access Control', () => {
  test.describe('TEACHER restrictions', () => {
    test('TEACHER cannot create student', async () => {
      const response = await teacherCtx.post('/api/students', {
        data: {
          fullName: 'Unauthorized Student',
          gender: 'MALE',
          dateOfBirth: '2009-01-01',
        },
      });
      expect(response.status()).toBe(403);
    });

    test('TEACHER cannot delete student', async () => {
      const listRes = await superAdminCtx.get('/api/students?limit=1');
      const listBody = await listRes.json();
      const studentId = listBody.students?.[0]?.id;

      if (studentId) {
        const response = await teacherCtx.delete(`/api/students/${studentId}`);
        expect(response.status()).toBe(403);
      }
    });

    test('TEACHER cannot manage fees', async () => {
      const response = await teacherCtx.get('/api/fees');
      expect(response.status()).toBe(403);
    });

    test('TEACHER cannot update settings', async () => {
      const response = await teacherCtx.put('/api/settings', {
        data: { maxClassSize: 50 },
      });
      expect(response.status()).toBe(403);
    });

    test('TEACHER cannot manage users', async () => {
      const response = await teacherCtx.get('/api/users');
      expect(response.status()).toBe(403);
    });
  });

  test.describe('PARENT restrictions', () => {
    test('PARENT cannot list all students', async () => {
      const response = await parentCtx.get('/api/students');
      expect(response.status()).toBe(403);
    });

    test('PARENT cannot create class', async () => {
      const response = await parentCtx.post('/api/classes', {
        data: {
          name: 'Unauthorized Class',
          gradeId: 'fake-id',
          academicYear: '2024-2025',
        },
      });
      expect(response.status()).toBe(403);
    });

    test('PARENT cannot create subject', async () => {
      const response = await parentCtx.post('/api/subjects', {
        data: { name: 'Unauth Subject', code: 'UA' },
      });
      expect(response.status()).toBe(403);
    });

    test('PARENT cannot manage fees', async () => {
      const response = await parentCtx.post('/api/fees', {
        data: {
          name: 'Unauth Fee',
          amount: 100,
          category: 'TUITION',
        },
      });
      expect(response.status()).toBe(403);
    });

    test('PARENT cannot update settings', async () => {
      const response = await parentCtx.put('/api/settings', {
        data: { passScore: 1 },
      });
      expect(response.status()).toBe(403);
    });
  });

  test.describe('STAFF restrictions', () => {
    test('STAFF cannot delete student', async () => {
      const listRes = await staffCtx.get('/api/students?limit=1');
      const listBody = await listRes.json();
      const studentId = listBody.students?.[0]?.id;

      if (studentId) {
        const response = await staffCtx.delete(`/api/students/${studentId}`);
        expect(response.status()).toBe(403);
      }
    });

    test('STAFF cannot update settings', async () => {
      const response = await staffCtx.put('/api/settings', {
        data: { maxClassSize: 50 },
      });
      expect(response.status()).toBe(403);
    });
  });

  test.describe('Unauthenticated access', () => {
    test('unauthenticated user cannot access protected routes', async ({ request }) => {
      const endpoints = [
        '/api/students',
        '/api/classes',
        '/api/subjects',
        '/api/scores/class/fake-id',
        '/api/fees',
        '/api/settings',
        '/api/reports/dashboard',
        '/api/users',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint);
        expect(response.status()).toBe(401);
      }
    });
  });
});
