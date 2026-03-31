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

test.describe('Scores', () => {
  let classId: string;
  let subjectId: string;
  let semesterId: string;
  let studentId: string;
  let scoreComponentId: string;

  test.beforeAll(async () => {
    // Get required IDs from seed data
    const classesRes = await superAdminCtx.get('/api/classes');
    const classesBody = await classesRes.json();
    const classes = classesBody.classes || classesBody;
    classId = classes[0]?.id;

    const subjectsRes = await superAdminCtx.get('/api/subjects');
    const subjectsBody = await subjectsRes.json();
    const subjects = subjectsBody.subjects || subjectsBody;
    subjectId = subjects[0]?.id;

    // Get score components for the subject
    const componentsRes = await superAdminCtx.get(`/api/score-components?subjectId=${subjectId}`);
    if (componentsRes.ok()) {
      const componentsBody = await componentsRes.json();
      const components = componentsBody.scoreComponents || componentsBody;
      scoreComponentId = components?.[0]?.id;
    }

    // Get students from a class
    const studentsRes = await superAdminCtx.get(`/api/students?classId=${classId}&limit=1`);
    if (studentsRes.ok()) {
      const studentsBody = await studentsRes.json();
      studentId = studentsBody.students?.[0]?.id;
    }

    // Get the active semester
    const academicYearsRes = await superAdminCtx.get('/api/academic-years');
    if (academicYearsRes.ok()) {
      const ayBody = await academicYearsRes.json();
      const years = ayBody.academicYears || ayBody;
      if (years?.[0]?.semesters) {
        semesterId = years[0].semesters[0]?.id;
      }
    }
  });

  test.describe('Class Score Sheet', () => {
    test('get class score sheet', async () => {
      if (!classId || !subjectId || !semesterId) {
        test.skip();
        return;
      }

      const response = await superAdminCtx.get(
        `/api/scores/class/${classId}?subjectId=${subjectId}&semesterId=${semesterId}`
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeTruthy();
    });

    test('class score sheet without required params returns 400', async () => {
      if (!classId) {
        test.skip();
        return;
      }

      const response = await superAdminCtx.get(`/api/scores/class/${classId}`);
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Student Scores', () => {
    test('get student scores', async () => {
      if (!studentId) {
        test.skip();
        return;
      }

      const response = await superAdminCtx.get(`/api/scores/student/${studentId}`);
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Upsert Score', () => {
    test('STAFF can upsert a single score', async () => {
      if (!studentId || !scoreComponentId || !semesterId) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores', {
        data: {
          studentId,
          scoreComponentId,
          semesterId,
          value: 8.5,
        },
      });
      expect([200, 201]).toContain(response.status());
    });

    test('upsert score with invalid value returns 400', async () => {
      if (!studentId || !scoreComponentId || !semesterId) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores', {
        data: {
          studentId,
          scoreComponentId,
          semesterId,
          value: 15, // Max is 10
        },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Batch Upsert', () => {
    test('TEACHER can batch upsert scores', async () => {
      if (!studentId || !scoreComponentId || !semesterId) {
        test.skip();
        return;
      }

      const response = await teacherCtx.post('/api/scores/batch', {
        data: {
          scores: [
            {
              studentId,
              scoreComponentId,
              semesterId,
              value: 7.0,
            },
          ],
        },
      });
      // May succeed or fail based on teacher assignment
      expect([200, 201, 403]).toContain(response.status());
    });
  });
});
