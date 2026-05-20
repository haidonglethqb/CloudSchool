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
      const studentId = listBody.data?.[0]?.id;

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

    test('PARENT cannot read internal class and subject endpoints', async () => {
      const classesRes = await parentCtx.get('/api/classes');
      expect(classesRes.status()).toBe(403);

      const classesByIdRes = await parentCtx.get('/api/classes/invalid-id');
      expect(classesByIdRes.status()).toBe(403);

      const subjectsRes = await parentCtx.get('/api/subjects');
      expect(subjectsRes.status()).toBe(403);
    });

    test('PARENT cannot read internal reports/settings/scores endpoints', async () => {
      const dashboardRes = await parentCtx.get('/api/reports/dashboard');
      expect(dashboardRes.status()).toBe(403);

      const settingsRes = await parentCtx.get('/api/settings');
      expect(settingsRes.status()).toBe(403);

      const scoreSheetRes = await parentCtx.get('/api/scores/class/invalid-id?subjectId=x&semesterId=y');
      expect(scoreSheetRes.status()).toBe(403);
    });
  });

  test.describe('STAFF restrictions', () => {
    test('STAFF cannot delete student', async () => {
      const listRes = await staffCtx.get('/api/students?limit=1');
      const listBody = await listRes.json();
      const studentId = listBody.data?.[0]?.id;

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

    test('STAFF cannot create user', async () => {
      const response = await staffCtx.post('/api/users', {
        data: {
          fullName: 'Unauthorized Staff Create',
          email: `staff-no-create-${Date.now()}@test.local`,
          password: 'Secret123',
          role: 'TEACHER',
        },
      });
      expect(response.status()).toBe(403);
    });
  });

  test.describe('SUPER_ADMIN capabilities', () => {
    test('SUPER_ADMIN can create STAFF or TEACHER users', async () => {
      const email = `rbac-user-${Date.now()}@test.local`;
      const createStaffRes = await superAdminCtx.post('/api/users', {
        data: {
          fullName: 'RBAC Staff',
          email,
          password: 'Secret123',
          role: 'STAFF',
        },
      });
      expect([200, 201]).toContain(createStaffRes.status());
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
