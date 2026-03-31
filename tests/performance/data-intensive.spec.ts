import { test, expect, APIRequestContext } from '@playwright/test';
import { createAuthContext, measureResponseTime } from '../helpers/api-client';

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

test.describe('Data-Intensive Operations', () => {
  test('batch score upsert with multiple scores < 2000ms', async () => {
    // Get required IDs
    const classesRes = await superAdminCtx.get('/api/classes');
    const classesBody = await classesRes.json();
    const classes = classesBody.data;

    const subjectsRes = await superAdminCtx.get('/api/subjects');
    const subjectsBody = await subjectsRes.json();
    const subjects = subjectsBody.data;
    const subjectId = subjects[0]?.id;

    const componentsRes = await superAdminCtx.get(`/api/score-components?subjectId=${subjectId}`);
    let scoreComponentId: string | undefined;
    if (componentsRes.ok()) {
      const componentsBody = await componentsRes.json();
      const components = componentsBody.data;
      scoreComponentId = components?.[0]?.id;
    }

    const classId = classes[0]?.id;
    const studentsRes = await superAdminCtx.get(`/api/students?classId=${classId}`);
    const studentsBody = await studentsRes.json();
    const students = studentsBody.data || [];

    const ayRes = await superAdminCtx.get('/api/academic-years');
    let semesterId: string | undefined;
    if (ayRes.ok()) {
      const ayBody = await ayRes.json();
      const years = ayBody.data;
      semesterId = years?.[0]?.semesters?.[0]?.id;
    }

    if (!scoreComponentId || !semesterId || students.length === 0) {
      test.skip();
      return;
    }

    // Build a batch of scores for all students
    const scores = students.map((s: any) => ({
      studentId: s.id,
      scoreComponentId,
      semesterId,
      value: Math.round((Math.random() * 4 + 6) * 100) / 100,
    }));

    const { response, duration } = await measureResponseTime(() =>
      staffCtx.post('/api/scores/batch', { data: { scores } })
    );

    console.log(`  Batch ${scores.length} scores: ${duration}ms (status: ${response.status()})`);
    expect([200, 201]).toContain(response.status());
    expect(duration).toBeLessThan(2000);
  });

  test('dashboard report generation < 2000ms', async () => {
    const { response, duration } = await measureResponseTime(() =>
      superAdminCtx.get('/api/reports/dashboard')
    );

    console.log(`  Dashboard report: ${duration}ms`);
    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(2000);
  });

  test('student list with pagination handles large page size', async () => {
    const { response, duration } = await measureResponseTime(() =>
      superAdminCtx.get('/api/students?page=1&limit=100')
    );

    console.log(`  Students list (limit=100): ${duration}ms`);
    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(2000);
  });

  test('semester summary report < 3000ms', async () => {
    const ayRes = await superAdminCtx.get('/api/academic-years');
    let semesterId: string | undefined;
    if (ayRes.ok()) {
      const ayBody = await ayRes.json();
      const years = ayBody.data;
      semesterId = years?.[0]?.semesters?.[0]?.id;
    }

    if (!semesterId) {
      test.skip();
      return;
    }

    const { response, duration } = await measureResponseTime(() =>
      superAdminCtx.get(`/api/reports/semester-summary?semesterId=${semesterId}`)
    );

    console.log(`  Semester summary report: ${duration}ms`);
    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(3000);
  });
});
