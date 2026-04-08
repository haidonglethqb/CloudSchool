# API Endpoint Reference

> Base URL: `/api` (configured in backend router mount)

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Login (email + password, optional tenantCode) |
| POST | `/auth/register-school` | Self-register a new school tenant |
| GET | `/auth/plans` | List active subscription plans (public) |
| GET | `/auth/me` | Current user profile + tenant + children (if PARENT) |
| POST | `/auth/logout` | Clear auth cookie |

## Admin (PLATFORM_ADMIN only)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | System-wide dashboard stats + growth charts |
| GET | `/admin/schools` | List schools (paginated, search, status filter) |
| POST | `/admin/schools` | Create school + admin user + grades |
| GET | `/admin/schools/:id` | School detail + users by role breakdown |
| PUT | `/admin/schools/:id` | Update school info |
| PATCH | `/admin/schools/:id/suspend` | Suspend school |
| PATCH | `/admin/schools/:id/activate` | Activate school |
| DELETE | `/admin/schools/:id` | Delete school |
| GET | `/admin/schools/:id/users` | Users in a school |
| GET | `/admin/schools/:id/stats` | School statistics |
| GET | `/admin/schools/:id/activity` | Activity logs for a school |
| GET | `/admin/subscriptions` | List subscription plans |
| POST | `/admin/subscriptions` | Create plan |
| PUT | `/admin/subscriptions/:id` | Update plan |
| DELETE | `/admin/subscriptions/:id` | Delete plan |

## Users

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List users (paginated, role/status filter) |
| GET | `/users/:id` | User detail + teacher assignments |
| POST | `/users` | Create user (SUPER_ADMIN) |
| PUT | `/users/:id` | Update user (email duplicate check, self-disable guard) |
| PATCH | `/users/:id/disable` | Disable user |
| PUT | `/users/:id/assignments` | Set teacher class/subject assignments |
| DELETE | `/users/:id` | Delete user (self-delete guard) |

## Students

| Method | Path | Description |
|---|---|---|
| GET | `/students` | List students (paginated, search, classId, status) |
| GET | `/students/:id` | Student detail + scores |
| POST | `/students` | Create student (age validation, capacity check, code generation) |
| PUT | `/students/:id` | Update student info (class change blocked — use transfer) |
| DELETE | `/students/:id` | Delete student (dependency checks) |
| POST | `/students/:id/transfer` | Transfer to another class + transfer history record |
| GET | `/students/:id/transfer-history` | Transfer history |

## Classes

| Method | Path | Description |
|---|---|---|
| GET | `/classes` | List classes (gradeId, academicYear filter; teacher-scoped) |
| GET | `/classes/grades` | Grades with nested classes + student counts |
| GET | `/classes/:id` | Class detail + students + teacher assignments |
| POST | `/classes` | Create class (capacity from settings) |
| PUT | `/classes/:id` | Update class (capacity ≥ current students) |
| DELETE | `/classes/:id` | Delete class (no students/assignments/fees) |
| POST | `/classes/:id/assign-teacher` | Assign teacher to class+subject |
| DELETE | `/classes/:id/assign-teacher/:assignmentId` | Remove teacher assignment |
| GET | `/classes/:id/students` | Students in class |
| POST | `/classes/:id/students` | Add student to class (capacity check, tx) |
| DELETE | `/classes/:id/students/:studentId` | Remove student from class |

## Subjects

| Method | Path | Description |
|---|---|---|
| GET | `/subjects` | List subjects (teacher-scoped to assignments) |
| GET | `/subjects/:id` | Subject detail + score components |
| POST | `/subjects` | Create subject (maxSubjects validation, code uniqueness) |
| PUT | `/subjects/:id` | Update subject |
| DELETE | `/subjects/:id` | Soft delete (sets isActive: false) |

## Semesters (nested under /subjects)

| Method | Path | Description |
|---|---|---|
| GET | `/subjects/semesters` | List all semesters |
| POST | `/subjects/semesters` | Create semester (maxSemesters from settings QĐ8) |
| PATCH | `/subjects/semesters/:id` | Update semester |
| DELETE | `/subjects/semesters/:id` | Delete semester (dependency checks) |

## Score Components

| Method | Path | Description |
|---|---|---|
| GET | `/score-components` | List components (optional subjectId filter) |
| POST | `/score-components` | Create component (weight 1-100, total ≤ 100% per subject) |
| PUT | `/score-components/:id` | Update component (weight re-validation, duplicate name check) |
| DELETE | `/score-components/:id` | Delete component (no existing scores) |

## Scores

| Method | Path | Description |
|---|---|---|
| GET | `/scores/class/:classId` | Score sheet for a class (subject + semester) |
| GET | `/scores/student/:studentId` | All scores for a student + ranking |
| GET | `/scores/student/:studentId/yearly` | Yearly score summary (all semesters) |
| POST | `/scores` | Create/update single score (upsert, lock check, assignment check) |
| POST | `/scores/batch` | Batch save scores ($transaction) |
| PATCH | `/scores/:id/lock` | Lock a score |
| PATCH | `/scores/:id/unlock` | Unlock a score |
| POST | `/scores/class/:classId/lock` | Lock all scores for class+subject+semester |
| POST | `/scores/class/:classId/unlock` | Unlock all scores for class+subject+semester |
| DELETE | `/scores/:id` | Delete score (SUPER_ADMIN) |

## Promotion

| Method | Path | Description |
|---|---|---|
| GET | `/promotion` | List promotions (semesterId, classId filter) |
| POST | `/promotion/calculate` | Calculate promotions (weighted avg, passScore, auto-retention) |
| PUT | `/promotion/:id` | Override promotion result manually |

## Reports

| Method | Path | Description |
|---|---|---|
| GET | `/reports/subject-summary` | Pass rates + averages per class for a subject |
| GET | `/reports/semester-summary` | Pass rates + averages per class for a semester |
| GET | `/reports/dashboard` | School dashboard stats |
| GET | `/reports/transfer-report` | Class transfer history report |
| GET | `/reports/retention-report` | Retention/fail report with maxRetentions handling |

## Parents

| Method | Path | Description |
|---|---|---|
| GET | `/parents` | List parent users (SUPER_ADMIN, STAFF) |
| POST | `/parents` | Create parent + link students |
| PUT | `/parents/:id` | Update parent |
| DELETE | `/parents/:id` | Delete parent |
| POST | `/parents/:id/students` | Link student to parent |
| DELETE | `/parents/:id/students/:studentId` | Unlink student from parent |
| GET | `/parents/my-children` | Parent's children list (PARENT role) |
| GET | `/parents/my-children/:studentId/scores` | Child's scores (PARENT role) |
| GET | `/parents/semesters` | List semesters (PARENT role) |

## Settings

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Get current tenant settings |
| PUT | `/settings` | Update settings (validates ranges, invalidates cache) |
| GET | `/settings/role-permissions` | Get role-based module permissions |
| PUT | `/settings/role-permissions` | Update role permissions |
| GET | `/settings/grades` | List grades |
| POST | `/settings/grades` | Create grade (level uniqueness, min/max validation) |
| PUT | `/settings/grades/:id` | Update grade |
| DELETE | `/settings/grades/:id` | Delete grade (no classes) |

## Export

| Method | Path | Description |
|---|---|---|
| GET | `/export/students` | Export students (CSV/Excel) |
| GET | `/export/classes` | Export classes (CSV/Excel) |
| GET | `/export/scores` | Export scores for class+subject+semester (CSV/Excel) |
| GET | `/export/schools` | Export schools — PLATFORM_ADMIN only (CSV/Excel) |

## Monitoring (PLATFORM_ADMIN only)

| Method | Path | Description |
|---|---|---|
| GET | `/monitoring/system-stats` | System health: schools, users, CPU, memory, DB |
| GET | `/monitoring/activity-logs` | Activity log feed (paginated, filters) |
| GET | `/monitoring/school-stats/:schoolId` | Detailed stats for a specific school |

## Fees

| Method | Path | Description |
|---|---|---|
| GET | `/fees` | List fees with payment stats |
| GET | `/fees/:id` | Fee detail + student payments |
| POST | `/fees` | Create fee + auto-assign students ($transaction) |
| PUT | `/fees/:id` | Update fee |
| DELETE | `/fees/:id` | Delete fee (no student fee records) |
| PATCH | `/fees/:id/students/:studentId` | Update student payment status/amount |
| POST | `/fees/:id/assign` | Manually assign fee to specific students |
| GET | `/fees/parent/my-fees` | Parent's children fee list (PARENT role) |

## Academic Years

| Method | Path | Description |
|---|---|---|
| GET | `/academic-years` | List academic years + semesters |
| GET | `/academic-years/:id` | Academic year detail |
| POST | `/academic-years` | Create academic year (overlap check, startYear < endYear) |
| PUT | `/academic-years/:id` | Update academic year |
| DELETE | `/academic-years/:id` | Delete (no semesters or enrollments) |

## Tenant

| Method | Path | Description |
|---|---|---|
| GET | `/tenants/current` | Current tenant info + settings + plan |
| PUT | `/tenants/current` | Update current tenant (SUPER_ADMIN) |
| GET | `/tenants/stats` | Dashboard statistics for current tenant |

## Related

- [Middleware](./middleware.md)
- [Error Handling](./error-handling.md)
- [Route Logic](./route-logic.md)
