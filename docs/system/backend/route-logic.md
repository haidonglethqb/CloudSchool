# Key Route Logic

> Source: `backend/src/routes/*.routes.js`

## Student Admission (`POST /students`) â€” student.routes.js

1. **Age validation (QÄ1):** Computes age from `dateOfBirth`; must be within `settings.minAge`â€“`settings.maxAge`.
2. **Class capacity check:** Inside `$transaction`, counts students in target class; rejects if `count >= capacity`.
3. **studentCode generation:** `HS{YY}{NNNN}` â€” e.g. `HS260001`. Generated inside transaction to prevent race conditions.
4. **ClassEnrollment:** If `classId` provided, auto-creates enrollment record for the active semester.

```js
const generateStudentCode = async (tenantId, tx) => {
  const count = await tx.student.count({ where: { tenantId } })
  const year = new Date().getFullYear().toString().slice(-2)
  return `HS${year}${String(count + 1).padStart(4, '0')}`
}
```

## Student Import (`/students/import-batches`) - student.routes.js

1. **Draft first:** Frontend sends CSV/XLSX as base64 JSON. Backend parses with ExcelJS/CSV helpers and writes `StudentImportBatch` + `StudentImportRow` records.
2. **Row validation:** Required columns are `fullName`, `gender`, `dateOfBirth`, and `address`. Gender accepts `Nam`, `Nu`, `Khac`, `MALE`, `FEMALE`, `OTHER`; invalid rows keep `errorMessage`.
3. **Duplicate checks:** Import rejects rows matching an existing student by `fullName + dateOfBirth` and rows duplicated inside the same file.
4. **Class assignment:** Valid rows can receive `classId`; the class must belong to the active semester's academic year.
5. **Commit:** Creates only `VALID` rows with class assignments, rechecks plan student limit and class capacity, creates `ClassEnrollment`, then marks rows as `IMPORTED`.

## Score Entry (`POST /scores`, `POST /scores/batch`) â€” score.routes.js

1. **Score range (QÄ6):** Validates `value` within `settings.minScore`â€“`settings.maxScore`.
2. **Lock check:** Locked scores block edits by `TEACHER` role only (403 `SCORE_LOCKED`).
3. **Teacher assignment check:** `TeacherAssignment` lookup ensures teacher is assigned to the student's class + subject.
4. **Semester activation:** Scores can be entered when `semester.isActive === true`; semester dates are informational for UI scheduling.
5. **Audit snapshot:** Every create/update writes a `ScoreHistory` row with actor, student, class, subject, semester, score-component, and old/new values.
6. **Upsert via `$transaction`:** Batch endpoint wraps score upserts and history inserts in one `prisma.$transaction()`.

## Score History (`GET /scores/history`) â€” score.routes.js

1. Requires `classId`, `subjectId`, and `semesterId`; `scoreComponentId` is optional.
2. Teachers are limited to their own assigned `classId + subjectId` pairs.
3. Returns newest-first paginated audit entries from `ScoreHistory`.
4. Powers the score-entry history panel after save, lock, unlock, or delete actions.

## Score Finalization (`PATCH /scores/:id/lock`, `PATCH /scores/:id/unlock`, class lock/unlock) â€” score.routes.js

1. Staff and super admins can lock or unlock individual scores and whole class slices.
2. Each lock/unlock action writes a `ScoreHistory` snapshot so the UI can show who finalized or reopened scores.

## Semester Deletion (`DELETE /academic-years/:id/semesters/:semesterId`) â€” academic-year.routes.js

1. Deletion is blocked when the semester still has scores, promotions, enrollments, or transfer history.
2. Successful deletion hard-removes the semester, so later `GET /academic-years/semesters` reads no longer return it.

## Academic Year Activation (`PATCH /academic-years/:id/activate`) â€” academic-year.routes.js

1. Exactly one `AcademicYear` is active per tenant.
2. Activating a year clears all old active semesters, then opens the first semester in the activated year when one exists.
3. Student score lookup defaults to semesters in the active year so stale semester flags do not show a previous year as current.

## Teacher Score Access â€” score.routes.js

Teachers are scoped to their assigned class/subject pairs:

```js
const assignment = await prisma.teacherAssignment.findFirst({
  where: { teacherId: req.user.id, classId: student.classId, subjectId, tenantId: req.tenantId }
})
if (!assignment) throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
```

## Promotion Calculation (`POST /promotion/calculate`) â€” promotion.routes.js

1. **Weighted average per subject:** `Î£(score Ã— weight) / Î£(weight)`.
2. **Overall average:** Mean of all subject averages.
3. **Result determination:** `PASS` if avg â‰¥ `passScore`; `FAIL` if avg < `passScore`; `RETAKE` if avg passes but any subject fails.
4. **Upsert Promotion:** Uses `upsert` with unique key `{studentId, classId, semesterId}`.
5. **Auto-deactivate (QÄ9):** Students exceeding `maxRetentions` FAIL counts are set `isActive: false` inside the same transaction.

```js
await prisma.$transaction(async (tx) => {
  for (const r of results) {
    await tx.promotion.upsert({
      where: { studentId_classId_semesterId: { ... } },
      create: { tenantId: req.tenantId, ...r },
      update: { average: r.average, result: r.result }
    })
  }
  // Auto-deactivate students exceeding maxRetentions...
})
```

## Monitoring â€” monitoring.routes.js

**System stats:** Previously 24 sequential counts â†’ now 9 parallel `Promise.all` counts + 2 raw SQL `GROUP BY` queries for 12-month growth arrays (zero-filled).

```js
const [schoolGrowthRaw, studentGrowthRaw] = await Promise.all([
  prisma.$queryRaw`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month, count(*)::int
    FROM tenants WHERE "createdAt" >= ${twelveMonthsAgo} GROUP BY ... ORDER BY ...`,
  prisma.$queryRaw`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month, count(*)::int
    FROM students WHERE "createdAt" >= ${twelveMonthsAgo} GROUP BY ... ORDER BY ...`
])
```

## Admin Dashboard â€” admin.routes.js

**Dashboard:** 12 parallel counts (schools, users, students, teachers, classes, plans) + 2 raw SQL `GROUP BY` queries for 6-month growth arrays.

```js
const [totalSchools, activeSchools, ..., totalPlans] = await Promise.all([
  prisma.tenant.count(),
  prisma.tenant.count({ where: { status: 'ACTIVE' } }),
  // ... 10 more parallel queries
])
```

## Export PDF Hardening (`GET /export/*?format=pdf`) â€” export.routes.js

1. **Buffer-before-send:** PDF is generated to an in-memory buffer first, then response headers/body are sent only after successful render.
2. **Header correctness:** `Content-Type`, `Content-Disposition`, and `Content-Length` are set only on success to avoid mismatched JSON body with PDF headers.
3. **Footer strategy:** Page numbers are rendered via `bufferPages` + `writePageFooters` after content generation (no `pageAdded` footer loop).
4. **Fail-safe footer:** Footer rendering failures are caught and ignored so PDF export can still succeed.
5. **Route-level wrapping:** Unexpected errors on `format=pdf` routes are wrapped to `AppError('PDF export failed', 500, 'PDF_EXPORT_FAILED')` through a shared handler.
6. **Debug gate:** Optional `EXPORT_DEBUG=1` enables stage-level export diagnostics (`route-error-raw`, `send-pdf-failed`, `footer-failed-continue`).

## Related

- [API Endpoints](./api-endpoints.md)
- [Middleware](./middleware.md)
- Sources: `backend/src/routes/{student,score,promotion,monitoring,admin,export}.routes.js`
