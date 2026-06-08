# Roles & Permissions

6-role RBAC with tenant isolation and assignment-based scope.

## Role Hierarchy

| Role | Scope | Notes |
|---|---|---|
| `PLATFORM_ADMIN` | All tenants | SaaS operator |
| `SUPER_ADMIN` | One tenant | School owner/admin |
| `STAFF` | One tenant | Admin staff |
| `TEACHER` | One tenant | Teaching staff |
| `STUDENT` | One tenant | Student self-service |
| `PARENT` | One tenant | Parent self-service |

## Endpoint Scope

| Group | SUPER_ADMIN | STAFF | TEACHER |
|---|---|---|---|
| `/classes` | Full | Full or assignment-scoped | Assignment-scoped |
| `/subjects` | Full | Full or assignment-scoped | Assignment-scoped |
| `/scores` | Full | Full or assignment-scoped | Assignment-scoped read/write |
| `/reports` | Full | Full or assignment-scoped | Assignment-scoped read |

`assignment-scoped` means the user has at least one `TeacherAssignment`.

## Assignment Rule

`TeacherAssignment` is scoped by:

```text
teacherId + classId + subjectId + semesterId
```

Effects:

1. Same class name in another academic year is not the same assignment.
2. HK1 and HK2 of the same class can have different teachers.
3. Teacher and scoped staff only see or edit data that matches the selected class, subject, and semester.

## UI Rule

Teacher-facing selectors must keep academic year and semester together:

1. assignment modal chooses academic year, semester, class, subject
2. score entry chooses academic year, class, subject, semester
3. class and report views keep semester-aware filtering when scope is enforced

## Related

- [Score Entry Flow](../data-flows/score-entry-flow.md)
- [User Models](../database/user-models.md)
- [API Endpoints](../backend/api-endpoints.md)
