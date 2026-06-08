# User Models

Core identity and assignment relations from `backend/prisma/schema.prisma`.

## User

| Field | Type | Notes |
|---|---|---|
| `tenantId` | `String?` | null only for `PLATFORM_ADMIN` |
| `email` | `String` | unique per tenant |
| `password` | `String` | hashed |
| `fullName` | `String` | display name |
| `role` | `UserRole` | `PLATFORM_ADMIN`, `SUPER_ADMIN`, `STAFF`, `TEACHER`, `STUDENT`, `PARENT` |
| `isActive` | `Boolean` | soft disable |

Relations:

1. `children -> ParentStudent[]`
2. `teacherAssignments -> TeacherAssignment[]`
3. `studentProfile -> Student?`

## ParentStudent

Join table between parent users and students.

| Constraint | Purpose |
|---|---|
| `@@unique([parentId, studentId])` | one link per pair |

## TeacherAssignment

Teacher and scoped staff teaching permission lives here.

| Field | Notes |
|---|---|
| `teacherId` | assigned user |
| `classId` | exact class record |
| `subjectId` | exact subject |
| `semesterId` | exact semester |
| `isHomeroom` | homeroom flag for that semester |

Key constraint:

```text
@@unique([teacherId, classId, subjectId, semesterId])
```

Meaning:

1. one teacher-subject assignment per class per semester
2. same class name in another year uses another `classId`
3. homeroom can change between semesters

## Related

- [Academic Structure](./academic-structure.md)
- [Schema Overview](./schema-overview.md)
- [Indexes & Performance](./indexes-performance.md)
