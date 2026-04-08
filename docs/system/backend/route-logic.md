# Key Route Logic

> Source: `backend/src/routes/*.routes.js`

## Student Admission (`POST /students`) — student.routes.js

1. **Age validation (QĐ1):** Computes age from `dateOfBirth`; must be within `settings.minAge`–`settings.maxAge`.
2. **Class capacity check:** Inside `$transaction`, counts students in target class; rejects if `count >= capacity`.
3. **studentCode generation:** `HS{YY}{NNNN}` — e.g. `HS260001`. Generated inside transaction to prevent race conditions.
4. **ClassEnrollment:** If `classId` provided, auto-creates enrollment record for the active semester.

```js
const generateStudentCode = async (tenantId, tx) => {
  const count = await tx.student.count({ where: { tenantId } })
  const year = new Date().getFullYear().toString().slice(-2)
  return `HS${year}${String(count + 1).padStart(4, '0')}`
}
```

## Score Entry (`POST /scores`, `POST /scores/batch`) — score.routes.js

1. **Score range (QĐ6):** Validates `value` within `settings.minScore`–`settings.maxScore`.
2. **Lock check:** Locked scores block edits by `TEACHER` role only (403 `SCORE_LOCKED`).
3. **Teacher assignment check:** `TeacherAssignment` lookup ensures teacher is assigned to the student's class + subject.
4. **Semester date window:** Teachers can only enter scores within `semester.startDate`–`semester.endDate` (configurable TZ offset).
5. **Upsert via `$transaction`:** Batch endpoint wraps all `score.upsert()` calls in a single `prisma.$transaction()`.

## Teacher Score Access — score.routes.js

Teachers are scoped to their assigned class/subject pairs:

```js
const assignment = await prisma.teacherAssignment.findFirst({
  where: { teacherId: req.user.id, classId: student.classId, subjectId, tenantId: req.tenantId }
})
if (!assignment) throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
```

## Promotion Calculation (`POST /promotion/calculate`) — promotion.routes.js

1. **Weighted average per subject:** `Σ(score × weight) / Σ(weight)`.
2. **Overall average:** Mean of all subject averages.
3. **Result determination:** `PASS` if avg ≥ `passScore`; `FAIL` if avg < `passScore`; `RETAKE` if avg passes but any subject fails.
4. **Upsert Promotion:** Uses `upsert` with unique key `{studentId, classId, semesterId}`.
5. **Auto-deactivate (QĐ9):** Students exceeding `maxRetentions` FAIL counts are set `isActive: false` inside the same transaction.

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

## Fee Creation + Student Assignment (`POST /fees`) — fee.routes.js

Fee creation and student assignment run in a single `$transaction`:

```js
const { fee, assignedCount } = await prisma.$transaction(async (tx) => {
  const fee = await tx.fee.create({ data: { tenantId, name, amount, category, ... } })
  const students = await tx.student.findMany({ where: { tenantId, isActive: true, classId/grade filter } })
  if (students.length > 0) {
    await tx.studentFee.createMany({
      data: students.map(s => ({ tenantId, feeId: fee.id, studentId: s.id, amount: fee.amount })),
      skipDuplicates: true
    })
  }
  return { fee, assignedCount: students.length }
})
```

## Monitoring — monitoring.routes.js

**System stats:** Previously 24 sequential counts → now 9 parallel `Promise.all` counts + 2 raw SQL `GROUP BY` queries for 12-month growth arrays (zero-filled).

```js
const [schoolGrowthRaw, studentGrowthRaw] = await Promise.all([
  prisma.$queryRaw`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month, count(*)::int
    FROM tenants WHERE "createdAt" >= ${twelveMonthsAgo} GROUP BY ... ORDER BY ...`,
  prisma.$queryRaw`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month, count(*)::int
    FROM students WHERE "createdAt" >= ${twelveMonthsAgo} GROUP BY ... ORDER BY ...`
])
```

## Admin Dashboard — admin.routes.js

**Dashboard:** 12 parallel counts (schools, users, students, teachers, classes, plans) + 2 raw SQL `GROUP BY` queries for 6-month growth arrays.

```js
const [totalSchools, activeSchools, ..., totalPlans] = await Promise.all([
  prisma.tenant.count(),
  prisma.tenant.count({ where: { status: 'ACTIVE' } }),
  // ... 10 more parallel queries
])
```

## Related

- [API Endpoints](./api-endpoints.md)
- [Middleware](./middleware.md)
- Sources: `backend/src/routes/{student,score,promotion,fee,monitoring,admin}.routes.js`
