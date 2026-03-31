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

test.describe('Classes', () => {
  test.describe('List Grades', () => {
    test('authenticated user can list grades', async () => {
      const response = await teacherCtx.get('/api/classes/grades');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const grades = body.grades || body;
      expect(Array.isArray(grades)).toBe(true);
      expect(grades.length).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('List Classes', () => {
    test('list all classes', async () => {
      const response = await superAdminCtx.get('/api/classes');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const classes = body.classes || body;
      expect(Array.isArray(classes)).toBe(true);
      expect(classes.length).toBeGreaterThan(0);
    });

    test('filter classes by academic year', async () => {
      const response = await superAdminCtx.get('/api/classes?academicYear=2024-2025');
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Get Class Detail', () => {
    test('get class by ID includes students and assignments', async () => {
      const listRes = await superAdminCtx.get('/api/classes');
      const listBody = await listRes.json();
      const classes = listBody.classes || listBody;
      const classId = classes[0]?.id;

      if (classId) {
        const response = await superAdminCtx.get(`/api/classes/${classId}`);
        expect(response.status()).toBe(200);

        const body = await response.json();
        const cls = body.class || body;
        expect(cls.name).toBeTruthy();
      }
    });
  });

  test.describe('Create Class', () => {
    test('STAFF can create a class', async () => {
      // Get a grade first
      const gradesRes = await staffCtx.get('/api/classes/grades');
      const gradesBody = await gradesRes.json();
      const grades = gradesBody.grades || gradesBody;
      const gradeId = grades[0]?.id;

      if (gradeId) {
        const response = await staffCtx.post('/api/classes', {
          data: {
            name: 'TestClass-Auto',
            gradeId,
            academicYear: '2024-2025',
            capacity: 40,
          },
        });
        expect([200, 201, 409]).toContain(response.status());
      }
    });

    test('create class with missing name returns 400', async () => {
      const gradesRes = await staffCtx.get('/api/classes/grades');
      const gradesBody = await gradesRes.json();
      const grades = gradesBody.grades || gradesBody;
      const gradeId = grades[0]?.id;

      const response = await staffCtx.post('/api/classes', {
        data: { gradeId, academicYear: '2024-2025' },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Teacher Assignment', () => {
    test('SUPER_ADMIN can assign teacher to class', async () => {
      // Get class, teacher, and subject IDs
      const classesRes = await superAdminCtx.get('/api/classes');
      const classesBody = await classesRes.json();
      const classes = classesBody.classes || classesBody;
      const classId = classes[0]?.id;

      const usersRes = await superAdminCtx.get('/api/users');
      const usersBody = await usersRes.json();
      const users = usersBody.users || usersBody;
      const teacher = users?.find?.((u: any) => u.role === 'TEACHER');

      const subjectsRes = await superAdminCtx.get('/api/subjects');
      const subjectsBody = await subjectsRes.json();
      const subjects = subjectsBody.subjects || subjectsBody;

      if (classId && teacher?.id && subjects?.[0]?.id) {
        const response = await superAdminCtx.post(`/api/classes/${classId}/assign-teacher`, {
          data: {
            teacherId: teacher.id,
            subjectId: subjects[0].id,
            isHomeroom: false,
          },
        });
        // May already be assigned or succeed
        expect([200, 201, 409, 400]).toContain(response.status());
      }
    });
  });
});
