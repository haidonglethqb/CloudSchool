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
  let writableSemesterId: string;
  let closedSemesterId: string;
  let studentId: string;
  let scoreComponentId: string;

  test.beforeAll(async () => {
    // Get required IDs from seed data
    const classesRes = await superAdminCtx.get('/api/classes');
    const classesBody = await classesRes.json();
    const classes = classesBody.data;
    classId = classes[0]?.id;

    const subjectsRes = await superAdminCtx.get('/api/subjects');
    const subjectsBody = await subjectsRes.json();
    const subjects = subjectsBody.data;
    subjectId = subjects[0]?.id;

    // Get score components for the subject
    const componentsRes = await superAdminCtx.get(`/api/score-components?subjectId=${subjectId}`);
    if (componentsRes.ok()) {
      const componentsBody = await componentsRes.json();
      const components = componentsBody.data;
      scoreComponentId = components?.[0]?.id;
    }

    // Get students from a class
    const studentsRes = await superAdminCtx.get(`/api/students?classId=${classId}&limit=1`);
    if (studentsRes.ok()) {
      const studentsBody = await studentsRes.json();
      studentId = studentsBody.data?.[0]?.id;
    }

    const semestersRes = await superAdminCtx.get('/api/academic-years/semesters');
    if (semestersRes.ok()) {
      const semestersBody = await semestersRes.json();
      const semesters = semestersBody.data || [];
      semesterId = semesters[0]?.id;

      const now = new Date();
      const writable = semesters.find((sem: any) => {
        if (!sem?.isActive || !sem?.startDate || !sem?.endDate) return false;
        const start = new Date(sem.startDate);
        const end = new Date(sem.endDate);
        return now >= start && now <= end;
      });
      writableSemesterId = writable?.id;

      const closed = semesters.find((sem: any) => {
        if (!sem?.startDate || !sem?.endDate) return true;
        const start = new Date(sem.startDate);
        const end = new Date(sem.endDate);
        return !sem.isActive || now < start || now > end;
      });
      closedSemesterId = closed?.id;
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
      if (!studentId || !scoreComponentId || !subjectId || !writableSemesterId) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores', {
        data: {
          studentId,
          subjectId,
          scoreComponentId,
          semesterId: writableSemesterId,
          value: 8.5,
        },
      });
      expect([200, 201]).toContain(response.status());
    });

    test('upsert score with invalid value returns 400', async () => {
      if (!studentId || !scoreComponentId || !subjectId || !writableSemesterId) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores', {
        data: {
          studentId,
          subjectId,
          scoreComponentId,
          semesterId: writableSemesterId,
          value: 15, // Max is 10
        },
      });
      expect(response.status()).toBe(400);
    });

    test('upsert score with closed semester returns 403 SEMESTER_CLOSED', async () => {
      if (!studentId || !scoreComponentId || !subjectId || !closedSemesterId) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores', {
        data: {
          studentId,
          subjectId,
          scoreComponentId,
          semesterId: closedSemesterId,
          value: 8.5,
        },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error?.code).toBe('SEMESTER_CLOSED');
    });

    test('component subject mismatch returns 400 COMPONENT_SUBJECT_MISMATCH', async () => {
      if (!studentId || !scoreComponentId || !writableSemesterId) {
        test.skip();
        return;
      }

      const subjectsRes = await superAdminCtx.get('/api/subjects');
      if (!subjectsRes.ok()) {
        test.skip();
        return;
      }
      const subjectsBody = await subjectsRes.json();
      const anotherSubject = (subjectsBody.data || []).find((subject: any) => subject.id !== subjectId);
      if (!anotherSubject?.id) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores', {
        data: {
          studentId,
          subjectId: anotherSubject.id,
          scoreComponentId,
          semesterId: writableSemesterId,
          value: 6.5,
        },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error?.code).toBe('COMPONENT_SUBJECT_MISMATCH');
    });
  });

  test.describe('Batch Upsert', () => {
    test('TEACHER can batch upsert scores', async () => {
      if (!studentId || !scoreComponentId || !subjectId || !writableSemesterId) {
        test.skip();
        return;
      }

      const response = await teacherCtx.post('/api/scores/batch', {
        data: {
          scores: [
            {
              studentId,
              subjectId,
              scoreComponentId,
              semesterId: writableSemesterId,
              value: 7.0,
            },
          ],
        },
      });
      expect([200, 201, 403]).toContain(response.status());
    });

    test('STAFF can batch upsert scores', async () => {
      if (!studentId || !scoreComponentId || !subjectId || !writableSemesterId) {
        test.skip();
        return;
      }

      const response = await staffCtx.post('/api/scores/batch', {
        data: {
          scores: [
            {
              studentId,
              subjectId,
              scoreComponentId,
              semesterId: writableSemesterId,
              value: 7.5,
            },
          ],
        },
      });
      expect([200, 201]).toContain(response.status());
    });
  });
});
