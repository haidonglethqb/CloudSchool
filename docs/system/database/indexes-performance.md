# Indexes and Performance

> **Source:** `backend/prisma/schema.prisma` | All `@@index` and `@@unique` declarations

## Complete Index List

### Unique Constraints

| Model | Fields | Purpose |
|---|---|---|
| `SubscriptionPlan` | `(name)` | Unique plan names |
| `Tenant` | `(code)` | Unique tenant slugs |
| `TenantSettings` | `(tenantId)` | One settings row per tenant |
| `User` | `(tenantId, email)` | Email unique per tenant |
| `Grade` | `(tenantId, level)` | One grade level per tenant |
| `Class` | `(tenantId, name, academicYear)` | Unique class names per year |
| `Subject` | `(tenantId, code)` | Unique subject codes per tenant |
| `Semester` | `(tenantId, year, semesterNum)` | Unique semesters per year |
| `Student` | `(tenantId, studentCode)` | Unique student codes per tenant |
| `Student` | `(userId)` | One student profile per user |
| `ParentStudent` | `(parentId, studentId)` | One relationship per pair |
| `TeacherAssignment` | `(teacherId, classId, subjectId)` | One assignment per combo |
| `ScoreComponent` | `(tenantId, subjectId, name)` | Unique components per subject |
| `Score` | `(studentId, subjectId, semesterId, scoreComponentId)` | One score per entry |
| `Promotion` | `(studentId, classId, semesterId)` | One promotion per semester |
| `ClassEnrollment` | `(studentId, semesterId)` | One enrollment per semester |
| `AcademicYear` | `(tenantId, startYear, endYear)` | Unique year ranges |
| `StudentFee` | `(feeId, studentId)` | One fee per student |

### Composite Indexes

| Model | Index Fields | Query Pattern |
|---|---|---|
| `User` | `(tenantId, role)` | List users by role in tenant |
| `Grade` | `(tenantId)` | All grades for tenant |
| `Class` | `(tenantId, gradeId)` | Classes in a grade |
| `Class` | `(tenantId, isActive)` | Active classes for tenant |
| `TeacherAssignment` | `(tenantId, teacherId)` | Teacher's assignments |
| `TeacherAssignment` | `(classId, tenantId)` | Assignments for a class |
| `Semester` | `(tenantId, isActive)` | Active semesters |
| `Student` | `(tenantId, classId)` | Students in a class |
| `Student` | `(tenantId, fullName)` | Search students by name |
| `Score` | `(tenantId, subjectId, semesterId)` | Class report by subject |
| `Score` | `(studentId, subjectId, semesterId)` | Student transcript |
| `Score` | `(tenantId, studentId)` | All scores for student |
| `Promotion` | `(tenantId, studentId, semesterId)` | Student promotions |
| `Promotion` | `(classId, semesterId)` | Class promotion summary |
| `TransferHistory` | `(tenantId, studentId)` | Student transfer history |
| `TransferHistory` | `(semesterId, tenantId)` | Transfers in semester |
| `ActivityLog` | `(tenantId, createdAt)` | Audit trail by time range |
| `AcademicYear` | `(tenantId)` | All academic years for tenant |
| `ClassEnrollment` | `(tenantId, classId, semesterId)` | Enrollment roster |
| `Fee` | `(tenantId, isActive)` | Active fees for tenant |
| `Fee` | `(tenantId, gradeId)` | Fees for a grade |
| `Fee` | `(tenantId, classId)` | Fees for a class |
| `StudentFee` | `(tenantId, studentId)` | All fees for student |
| `StudentFee` | `(tenantId, status)` | Fee status dashboard |
| `StudentFee` | `(feeId, tenantId)` | Fee collection summary |

## Index Rationale

### Multi-Tenant Isolation

Every index includes `tenantId` as the leading column, ensuring queries are scoped to a single tenant. This prevents full-table scans across all tenants.

### Score Query Optimization

```ts
// Uses index (tenantId, subjectId, semesterId)
prisma.score.findMany({
  where: { tenantId, subjectId, semesterId }
})

// Uses index (studentId, subjectId, semesterId)
prisma.score.findMany({
  where: { studentId, subjectId, semesterId }
})
```

### Activity Log Time-Range Queries

```ts
// Uses index (tenantId, createdAt)
prisma.activityLog.findMany({
  where: { tenantId, createdAt: { gte: since } },
  orderBy: { createdAt: 'desc' },
  take: 50
})
```

## LRU Caching Interaction

Database indexes work in concert with application-level caching:

| Cache | Size | TTL | Data |
|---|---|---|---|
| User cache | 500 entries | 60 seconds | User profiles, roles, permissions |
| Settings cache | 100 entries | 5 minutes | TenantSettings per tenant |

**Interaction pattern:**
1. Request arrives → check LRU cache first
2. Cache miss → query database (uses indexes)
3. Store result in cache for subsequent requests
4. Cache invalidation on `UPDATE`/`DELETE` operations

## N+1 Query Prevention

### Use `include` for relations

```ts
// ❌ N+1: Fetches students then loops for classes
const students = await prisma.student.findMany({ where: { classId } });
for (const s of students) {
  const cls = await prisma.class.findUnique({ where: { id: s.classId } });
}

// ✅ Single query with include
const students = await prisma.student.findMany({
  where: { classId },
  include: { class: true }
});
```

### Batch score queries

```ts
// ❌ N+1: One query per student
for (const student of students) {
  const scores = await prisma.score.findMany({
    where: { studentId: student.id, semesterId }
  });
}

// ✅ Single batch query
const scores = await prisma.score.findMany({
  where: {
    studentId: { in: studentIds },
    semesterId
  }
});
```

### Use `select` to limit columns

```ts
// Fetch only needed fields
const users = await prisma.user.findMany({
  where: { tenantId, role: 'TEACHER' },
  select: { id: true, fullName: true, email: true }
});
```

## Related

- [Schema Overview](./schema-overview.md)
- [Scoring Models](./scoring-models.md)
- [Tracking Models](./tracking-models.md)
