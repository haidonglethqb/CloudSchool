# Roles & Permissions

6-role RBAC system with endpoint-level authorization.

## Role Hierarchy

```mermaid
graph TD
    PA[PLATFORM_ADMIN] -.isolated.-> SA[SUPER_ADMIN]
    SA --> ST[STAFF]
    ST --> TC[TEACHER]
    TC --> STU[STUDENT]
    STU --> P[PARENT]

    style PA fill:#ff6b6b
    style SA fill:#ffa94d
    style ST fill:#ffd43b
    style TC fill:#69db7c
    style STU fill:#74c0fc
    style P fill:#b197fc
```

| Role            | Scope        | Description                        |
|-----------------|--------------|------------------------------------|
| `PLATFORM_ADMIN`| All tenants  | SaaS platform operator             |
| `SUPER_ADMIN`   | Single tenant| School owner/principal             |
| `STAFF`         | Single tenant| Administrative staff               |
| `TEACHER`       | Single tenant| Teaching staff                     |
| `STUDENT`       | Single tenant| Enrolled student                   |
| `PARENT`        | Single tenant| Parent/guardian of student(s)      |

## Endpoint Access Matrix

| Endpoint Group         | PLATFORM_ADMIN | SUPER_ADMIN | STAFF | TEACHER | STUDENT | PARENT |
|------------------------|:--------------:|:-----------:|:-----:|:-------:|:-------:|:------:|
| `/auth/*`              | âœ…             | âœ…          | âœ…    | âœ…      | âœ…      | âœ…     |
| `/users` (CRUD)        | âœ…             | âœ…          | âœ… R  | âŒ      | âŒ      | âŒ     |
| `/classes` (internal)  | âœ…             | âœ…          | âœ…    | âœ… R*   | âŒ      | âŒ     |
| `/subjects` (internal) | âœ…             | âœ…          | âœ…    | âœ… R*   | âŒ      | âŒ     |
| `/exams` (CRUD)        | âœ…             | âœ…          | âœ…    | âœ… R/W  | âœ… R    | âœ… R   |
| `/scores` (internal)   | âœ…             | âœ…          | âœ…    | âœ… R/W* | âŒ      | âŒ     |
| `/reports` (internal)  | âŒ             | âœ…          | âœ…    | âœ… R*   | âŒ      | âŒ     |
| `/settings` (internal) | âŒ             | âœ…          | âœ… R* | âœ… R*   | âŒ      | âŒ     |
| `/timetables` (CRUD)   | âœ…             | âœ…          | âœ…    | âœ… R    | âœ… R    | âŒ     |
| `/assignments` (CRUD)  | âœ…             | âœ…          | âœ…    | âœ… R/W  | âœ… R/W  | âŒ     |
| `/study-units` (CRUD)  | âœ…             | âœ…          | âœ…    | âœ…      | âŒ      | âŒ     |
| `/tenants` (CRUD)      | âœ…             | âŒ          | âŒ    | âŒ      | âŒ      | âŒ     |
| `/subscription-plans`  | âœ…             | âŒ          | âŒ    | âŒ      | âŒ      | âŒ     |
| `/tenants/:id/scores`  | âŒ             | âœ…          | âœ…    | âŒ      | âŒ      | âŒ     |

âœ… = Full CRUD | âœ… R = Read only | âœ… R/W = Read + Write | âŒ = No access
`*` = giá»›i háº¡n theo module permission vÃ , náº¿u cÃ³ phÃ¢n cÃ´ng, theo pháº¡m vi lá»›p/mÃ´n.

## UI Menu Visibility

| Menu Item        | PLATFORM_ADMIN | SUPER_ADMIN | STAFF | TEACHER | STUDENT | PARENT |
|------------------|:--------------:|:-----------:|:-----:|:-------:|:-------:|:------:|
| Dashboard        | âœ…             | âœ…          | âœ…    | âœ…      | âœ…      | âœ…     |
| Users            | âœ…             | âœ…          | âœ…    | âŒ      | âŒ      | âŒ     |
| Classes          | âœ…             | âœ…          | âœ…    | âœ…      | âœ…      | âŒ     |
| Exams & Scores   | âœ…             | âœ…          | âœ…    | âœ…      | âœ…      | âœ…     |
| Timetables       | âœ…             | âœ…          | âœ…    | âœ…      | âœ…      | âŒ     |
| Assignments      | âœ…             | âœ…          | âœ…    | âœ…      | âœ…      | âŒ     |
| Study Units      | âœ…             | âœ…          | âœ…    | âœ…      | âŒ      | âŒ     |
| Tenants          | âœ…             | âŒ          | âŒ    | âŒ      | âŒ      | âŒ     |
| Subscription     | âœ…             | âŒ          | âŒ    | âŒ      | âŒ      | âŒ     |

## Role Escalation Prevention

The `PUT /users/:id` endpoint enforces strict role assignment:

- Only `SUPER_ADMIN`, `STAFF`, and `TEACHER` roles can be assigned via user update
- `PLATFORM_ADMIN` and `STUDENT` roles cannot be assigned through the user PUT endpoint
- Role changes are validated server-side regardless of client-supplied payload

Implementation: [`backend/src/middleware/auth.js`](../../../backend/src/middleware/auth.js) â€” `authorize(...roles)` function checks `req.user.role` against a whitelist before proceeding.

## Feature + Module Permission

Tenant modules dÃ¹ng 2 lá»›p:
1. `requireFeature(moduleKey)` kiá»ƒm tra `tenant_settings.enabledModules`.
2. `requireRolePermission(moduleKey)` kiá»ƒm tra `tenant_settings.rolePermissions` cho `STAFF`/`TEACHER`.

`SUPER_ADMIN` vÃ  `PLATFORM_ADMIN` bypass `requireRolePermission`, nhÆ°ng váº«n Ä‘i qua feature flag.

Teacher chá»‰ cÃ³ thá»ƒ Ä‘Æ°á»£c cáº¥p cÃ¡c module backend há»— trá»£ tháº­t:
`student-lookup`, `classes`, `subjects`, `scores`, `reports`.

STAFF cÃ³ thá»ƒ Ä‘Æ°á»£c phÃ¢n cÃ´ng theo cáº·p lá»›p+mÃ´n. Náº¿u STAFF cÃ³ Ã­t nháº¥t má»™t phÃ¢n cÃ´ng,
dá»¯ liá»‡u lá»›p, há»c sinh, mÃ´n, Ä‘iá»ƒm, bÃ¡o cÃ¡o, xuáº¥t dá»¯ liá»‡u sáº½ bá»‹ giá»›i háº¡n theo phÃ¢n cÃ´ng.
STAFF chÆ°a cÃ³ phÃ¢n cÃ´ng giá»¯ pháº¡m vi theo module nhÆ° trÆ°á»›c.

Parent/Student chá»‰ dÃ¹ng self-service endpoints:
- `GET /api/parents/my-children`
- `GET /api/parents/my-children/:studentId/scores`
- `GET /api/parents/semesters`

## Related

- [Authentication Overview](overview.md) â€” JWT token mechanics
- [Middleware Chain](middleware-chain.md) â€” authorize middleware implementation
- [Login Flows](login-flows.md) â€” role-specific login responses
- [`backend/src/middleware/auth.js`](../../../backend/src/middleware/auth.js) â€” authorize function
