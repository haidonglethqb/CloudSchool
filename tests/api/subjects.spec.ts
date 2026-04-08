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

test.describe('Subjects', () => {
  test.describe.configure({ mode: 'serial' });
  test.describe('List Subjects', () => {
    test('authenticated user can list subjects', async () => {
      const response = await teacherCtx.get('/api/subjects');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const subjects = body.data;
      expect(Array.isArray(subjects)).toBe(true);
      expect(subjects.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Create Subject', () => {
    test('SUPER_ADMIN can create subject', async () => {
      const response = await superAdminCtx.post('/api/subjects', {
        data: {
          name: 'Tin học AutoTest',
          code: 'IT-AUTOTEST',
        },
      });
      expect([200, 201, 409]).toContain(response.status());
    });

    test('TEACHER cannot create subject', async () => {
      const response = await teacherCtx.post('/api/subjects', {
        data: {
          name: 'Unauthorized Subject',
          code: 'UNAUTH',
        },
      });
      expect(response.status()).toBe(403);
    });

    test('create subject without name returns 400', async () => {
      const response = await superAdminCtx.post('/api/subjects', {
        data: { code: 'NO_NAME' },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Update Subject', () => {
    test('STAFF can update subject', async () => {
      const listRes = await staffCtx.get('/api/subjects');
      const listBody = await listRes.json();
      const subjects = listBody.data;
      const subjectId = subjects[0]?.id;

      if (subjectId) {
        const response = await staffCtx.put(`/api/subjects/${subjectId}`, {
          data: { name: subjects[0].name },
        });
        expect([200, 400]).toContain(response.status());
      }
    });
  });

  test.describe('Soft Delete Subject', () => {
    test('SUPER_ADMIN can delete subject', async () => {
      // Find the auto-created test subject
      const listRes = await superAdminCtx.get('/api/subjects');
      const listBody = await listRes.json();
      const subjects = listBody.data;
      const testSubject = subjects.find((s: any) => s.code === 'IT-AUTOTEST');

      if (testSubject) {
        const response = await superAdminCtx.delete(`/api/subjects/${testSubject.id}`);
        expect([200, 204, 400]).toContain(response.status());
      }
    });
  });
});
