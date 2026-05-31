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

test.describe('Reports', () => {
  test.describe('Dashboard', () => {
    test('get dashboard statistics', async () => {
      const response = await superAdminCtx.get('/api/reports/dashboard');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeTruthy();
    });

    test('teacher can read report dashboard without academic-calendar permission', async () => {
      const response = await teacherCtx.get('/api/reports/dashboard?allYears=true');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body.data?.academicYears)).toBeTruthy();
    });
  });

  test.describe('Subject Summary', () => {
    test('get subject summary report', async () => {
      // Get required params
      const subjectsRes = await superAdminCtx.get('/api/subjects');
      const subjectsBody = await subjectsRes.json();
      const subjects = subjectsBody.data;
      const subjectId = subjects[0]?.id;

      const ayRes = await superAdminCtx.get('/api/academic-years');
      let semesterId: string | undefined;
      if (ayRes.ok()) {
        const ayBody = await ayRes.json();
        const years = ayBody.data;
        semesterId = years?.[0]?.semesters?.[0]?.id;
      }

      if (subjectId && semesterId) {
        const response = await superAdminCtx.get(
          `/api/reports/subject-summary?subjectId=${subjectId}&semesterId=${semesterId}`
        );
        expect(response.status()).toBe(200);
      }
    });

    test('teacher can read assigned subject summary', async () => {
      const subjectsRes = await teacherCtx.get('/api/subjects');
      const subjectsBody = await subjectsRes.json();
      const subjectId = subjectsBody.data?.[0]?.id;

      const semesterRes = await teacherCtx.get('/api/academic-years/semesters');
      const semesterBody = await semesterRes.json();
      const semesterId = semesterBody.data?.[0]?.id;

      if (subjectId && semesterId) {
        const response = await teacherCtx.get(
          `/api/reports/subject-summary?subjectId=${subjectId}&semesterId=${semesterId}`
        );
        expect(response.status()).toBe(200);
      }
    });
  });

  test.describe('Semester Summary', () => {
    test('get semester summary report', async () => {
      const ayRes = await superAdminCtx.get('/api/academic-years');
      let semesterId: string | undefined;
      if (ayRes.ok()) {
        const ayBody = await ayRes.json();
        const years = ayBody.data;
        semesterId = years?.[0]?.semesters?.[0]?.id;
      }

      if (semesterId) {
        const response = await superAdminCtx.get(
          `/api/reports/semester-promotion-summary?semesterId=${semesterId}`
        );
        expect(response.status()).toBe(200);
      }
    });
  });
});
