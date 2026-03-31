import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext } from '../helpers/api-client';

let superAdminCtx: APIRequestContext;
let staffCtx: APIRequestContext;

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN');
  staffCtx = await createAuthContext('STAFF');
});

test.afterAll(async () => {
  await superAdminCtx.dispose();
  await staffCtx.dispose();
});

test.describe('Reports', () => {
  test.describe('Dashboard', () => {
    test('get dashboard statistics', async () => {
      const response = await superAdminCtx.get('/api/reports/dashboard');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeTruthy();
    });
  });

  test.describe('Subject Summary', () => {
    test('get subject summary report', async () => {
      // Get required params
      const subjectsRes = await superAdminCtx.get('/api/subjects');
      const subjectsBody = await subjectsRes.json();
      const subjects = subjectsBody.subjects || subjectsBody;
      const subjectId = subjects[0]?.id;

      const ayRes = await superAdminCtx.get('/api/academic-years');
      let semesterId: string | undefined;
      if (ayRes.ok()) {
        const ayBody = await ayRes.json();
        const years = ayBody.academicYears || ayBody;
        semesterId = years?.[0]?.semesters?.[0]?.id;
      }

      if (subjectId && semesterId) {
        const response = await superAdminCtx.get(
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
        const years = ayBody.academicYears || ayBody;
        semesterId = years?.[0]?.semesters?.[0]?.id;
      }

      if (semesterId) {
        const response = await superAdminCtx.get(
          `/api/reports/semester-summary?semesterId=${semesterId}`
        );
        expect(response.status()).toBe(200);
      }
    });
  });
});
