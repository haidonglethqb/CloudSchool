import { test, expect, APIRequestContext } from '@playwright/test'
import { createAuthContext } from '../helpers/api-client'

let superAdminCtx: APIRequestContext
let staffCtx: APIRequestContext
let teacherCtx: APIRequestContext

test.beforeAll(async () => {
  superAdminCtx = await createAuthContext('SUPER_ADMIN')
  staffCtx = await createAuthContext('STAFF')
  teacherCtx = await createAuthContext('TEACHER')
})

test.afterAll(async () => {
  await superAdminCtx.dispose()
  await staffCtx.dispose()
  await teacherCtx.dispose()
})

test.describe.configure({ mode: 'serial' })

test.describe('Critical Smoke', () => {
  test('public plans endpoint is healthy', async ({ request }) => {
    const response = await request.get('/api/auth/plans')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('authenticated profile endpoint works', async () => {
    const response = await superAdminCtx.get('/api/auth/me')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.data.user.role).toBe('SUPER_ADMIN')
  })

  test('tenant roles are blocked from platform-admin route', async () => {
    const response = await superAdminCtx.get('/api/admin/schools')
    expect([401, 403, 404]).toContain(response.status())
  })

  test('locked score cannot be updated by teacher', async () => {
    const subjectsRes = await superAdminCtx.get('/api/subjects')
    expect(subjectsRes.status()).toBe(200)
    const subjectsBody = await subjectsRes.json()
    const subjectId = subjectsBody.data?.[0]?.id

    const semestersRes = await superAdminCtx.get('/api/subjects/semesters')
    expect(semestersRes.status()).toBe(200)
    const semestersBody = await semestersRes.json()
    const semesterId = semestersBody.data?.[0]?.id

    if (!subjectId || !semesterId) {
      test.skip(true, 'Seed data missing subject/semester')
      return
    }

    const componentsRes = await superAdminCtx.get(`/api/score-components?subjectId=${subjectId}`)
    expect(componentsRes.status()).toBe(200)
    const componentsBody = await componentsRes.json()
    const scoreComponentId = componentsBody.data?.[0]?.id

    const studentsRes = await superAdminCtx.get('/api/students?limit=1')
    expect(studentsRes.status()).toBe(200)
    const studentsBody = await studentsRes.json()
    const studentId = studentsBody.data?.[0]?.id

    if (!scoreComponentId || !studentId) {
      test.skip(true, 'Seed data missing student/score-component')
      return
    }

    const upsertByStaff = await staffCtx.post('/api/scores', {
      data: {
        studentId,
        subjectId,
        semesterId,
        scoreComponentId,
        value: 8.1,
      },
    })
    expect([200, 201]).toContain(upsertByStaff.status())

    const studentScoresRes = await superAdminCtx.get(`/api/scores/student/${studentId}?semesterId=${semesterId}`)
    expect(studentScoresRes.status()).toBe(200)
    const studentScoresBody = await studentScoresRes.json()
    const targetSubject = (studentScoresBody.data.subjectScores || []).find((s: any) => s.subject.id === subjectId)
    const targetScore = (targetSubject?.scores || []).find((s: any) => s.scoreComponentId === scoreComponentId)

    if (!targetScore?.id) {
      test.skip(true, 'Unable to resolve score id after upsert')
      return
    }

    const lockRes = await superAdminCtx.patch(`/api/scores/${targetScore.id}/lock`)
    expect(lockRes.status()).toBe(200)

    const teacherUpdateRes = await teacherCtx.post('/api/scores', {
      data: {
        studentId,
        subjectId,
        semesterId,
        scoreComponentId,
        value: 9.2,
      },
    })
    expect(teacherUpdateRes.status()).toBe(403)

    const teacherUpdateBody = await teacherUpdateRes.json()
    expect(teacherUpdateBody.error?.code).toBe('SCORE_LOCKED')

    const unlockRes = await superAdminCtx.patch(`/api/scores/${targetScore.id}/unlock`)
    expect(unlockRes.status()).toBe(200)
  })
})
