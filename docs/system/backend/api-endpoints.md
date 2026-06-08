# API Endpoint Reference

Base URL: `/api`

## Assignment-Aware Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/users/:id` | returns teacher assignments with `class`, `subject`, `semester` |
| `PUT` | `/users/:id/assignments` | each row requires `classId`, `subjectId`, `semesterId`, optional `isHomeroom` |
| `POST` | `/classes/:id/assign-teacher` | requires `teacherId`, `subjectId`, `semesterId` |
| `DELETE` | `/classes/:id/assign-teacher/:assignmentId` | removes one semester-scoped assignment |

Validation:

1. class, subject, semester must belong to tenant
2. class academic year must match semester academic year
3. duplicate assignment is blocked by unique constraint

## Scope-Aware Read Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/classes` | accepts `academicYearId`, optional `semesterId` |
| `GET` | `/classes/grades` | accepts `academicYearId`, optional `semesterId` |
| `GET` | `/classes/:id` | accepts `academicYearId`, optional `semesterId` |
| `GET` | `/subjects` | accepts `academicYearId`, `classId`, optional `semesterId` |
| `GET` | `/reports/*` | semester-sensitive when teacher/staff scope applies |

## Score Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/scores/class/:classId` | requires `subjectId`, `semesterId` |
| `GET` | `/scores/history` | requires `classId`, `subjectId`, `semesterId` |
| `GET` | `/scores/student/:studentId` | accepts optional `semesterId` |
| `POST` | `/scores` | single upsert, assignment checked by class+subject+semester |
| `POST` | `/scores/batch` | batch upsert, assignment checked per row semester |
| `POST` | `/scores/class/:classId/lock` | requires `subjectId`, `semesterId` |
| `POST` | `/scores/class/:classId/unlock` | requires `subjectId`, `semesterId` |

## Related

- [Roles & Permissions](../authentication/roles-permissions.md)
- [Score Entry Flow](../data-flows/score-entry-flow.md)
