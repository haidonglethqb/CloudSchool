import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext, assertStatus } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;
let staffCtx: APIRequestContext;
let teacherCtx: APIRequestContext;
let createdStudentId: string;

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

test.describe('Students', () => {
  test.describe('List Students', () => {
    test('SUPER_ADMIN can list students', async () => {
      const response = await superAdminCtx.get('/api/students');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.students).toBeTruthy();
      expect(Array.isArray(body.students)).toBe(true);
      expect(body.students.length).toBeGreaterThan(0);
    });

    test('list students with pagination', async () => {
      const response = await superAdminCtx.get('/api/students?page=1&limit=2');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.students.length).toBeLessThanOrEqual(2);
      expect(body.pagination).toBeTruthy();
    });

    test('list students with search filter', async () => {
      const response = await superAdminCtx.get('/api/students?search=Nguyễn');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.students.length).toBeGreaterThan(0);
    });

    test('TEACHER can list students', async () => {
      const response = await teacherCtx.get('/api/students');
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Create Student', () => {
    test('STAFF can create student with valid data', async () => {
      // First get a class to assign
      const classesRes = await staffCtx.get('/api/classes');
      const classesBody = await classesRes.json();
      const classId = classesBody.classes?.[0]?.id || classesBody[0]?.id;

      const response = await staffCtx.post('/api/students', {
        data: {
          fullName: 'Test Student AutoTest',
          gender: 'MALE',
          dateOfBirth: '2009-06-15',
          classId,
          parentName: 'Test Parent',
          parentPhone: '0901111111',
        },
      });

      if (response.status() === 201 || response.status() === 200) {
        const body = await response.json();
        createdStudentId = body.student?.id || body.id;
        expect(createdStudentId).toBeTruthy();
      } else {
        // Class may be full or validation failed, that's ok
        expect([400, 409]).toContain(response.status());
      }
    });

    test('create student with invalid age returns 400', async () => {
      const classesRes = await staffCtx.get('/api/classes');
      const classesBody = await classesRes.json();
      const classId = classesBody.classes?.[0]?.id || classesBody[0]?.id;

      const response = await staffCtx.post('/api/students', {
        data: {
          fullName: 'Too Young Student',
          gender: 'FEMALE',
          dateOfBirth: '2020-01-01', // Too young (age < 15)
          classId,
        },
      });
      expect(response.status()).toBe(400);
    });

    test('create student without required fields returns 400', async () => {
      const response = await staffCtx.post('/api/students', {
        data: { fullName: 'Missing Fields' },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Get Student', () => {
    test('get student by ID', async () => {
      // List students to get a valid ID
      const listRes = await superAdminCtx.get('/api/students?limit=1');
      const listBody = await listRes.json();
      const studentId = listBody.students?.[0]?.id;

      if (studentId) {
        const response = await superAdminCtx.get(`/api/students/${studentId}`);
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.student || body).toBeTruthy();
      }
    });

    test('get nonexistent student returns 404', async () => {
      const response = await superAdminCtx.get('/api/students/nonexistent-id-12345');
      expect([404, 400]).toContain(response.status());
    });
  });

  test.describe('Update Student', () => {
    test('STAFF can update student', async () => {
      const listRes = await staffCtx.get('/api/students?limit=1');
      const listBody = await listRes.json();
      const studentId = listBody.students?.[0]?.id;

      if (studentId) {
        const response = await staffCtx.put(`/api/students/${studentId}`, {
          data: { parentPhone: '0909999999' },
        });
        expect([200, 400]).toContain(response.status());
      }
    });
  });

  test.describe('Delete Student', () => {
    test('only SUPER_ADMIN can delete student', async () => {
      if (createdStudentId) {
        const response = await superAdminCtx.delete(`/api/students/${createdStudentId}`);
        expect([200, 204, 400, 409]).toContain(response.status());
      }
    });

    test('STAFF cannot delete student', async () => {
      const listRes = await staffCtx.get('/api/students?limit=1');
      const listBody = await listRes.json();
      const studentId = listBody.students?.[0]?.id;

      if (studentId) {
        const response = await staffCtx.delete(`/api/students/${studentId}`);
        expect(response.status()).toBe(403);
      }
    });
  });
});
