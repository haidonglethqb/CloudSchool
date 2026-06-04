# API Endpoint Reference

> Base URL: `/api` (configured in backend router mount)

## System

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health endpoint outside `/api`; returns `status: ok` when DB is reachable, `503` + `status: degraded` when DB check fails |

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
| POST | `/admin/schools` | Create school + admin user + grades (validates VN phone when `phone` is provided) |
| GET | `/admin/schools/:id` | School detail + users by role breakdown |
| PUT | `/admin/schools/:id` | Update school info (validates VN phone when `phone` is provided; rejects plan changes below current usage) |
| PATCH | `/admin/schools/:id/suspend` | Suspend school |
| PATCH | `/admin/schools/:id/activate` | Activate school |
| DELETE | `/admin/schools/:id` | Delete school |
| GET | `/admin/schools/:id/users` | Users in a school |
| GET | `/admin/schools/:id/stats` | School statistics |
| GET | `/admin/schools/:id/activity` | Activity logs for a school |
| GET | `/admin/schools/:id/features` | Get tenant feature modules |
| PUT | `/admin/schools/:id/features` | Update tenant feature modules |
| GET | `/admin/subscriptions` | List subscription plans, including student/staff/teacher/class limits |
| POST | `/admin/subscriptions` | Create plan with student/staff/teacher/class limits |
| PUT | `/admin/subscriptions/:id` | Update plan; rejects limit reductions below assigned tenants' current usage |
| DELETE | `/admin/subscriptions/:id` | Delete plan |

## Users

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List users (paginated, role/status filter) |
| GET | `/users/:id` | User detail + teacher/staff assignments |
| POST | `/users` | Create user (SUPER_ADMIN, validates VN phone when `phone` is provided; enforces plan limits for STAFF/TEACHER) |
| PUT | `/users/:id` | Update user (email duplicate check, self-disable guard, validates VN phone when `phone` is provided; enforces plan limits when role/status changes) |
| PATCH | `/users/:id/disable` | Disable user |
| PUT | `/users/:id/assignments` | Set teacher/staff class/subject assignments |
| DELETE | `/users/:id` | Delete user (self-delete guard) |

## Students

| Method | Path | Description |
|---|---|---|
| GET | `/students` | List students (paginated, search, classId, status) |
| GET | `/students/:id` | Student detail + scores |
| POST | `/students` | Create student (age validation, class capacity check, plan student limit, code generation) |
| PUT | `/students/:id` | Update student info (class change blocked — use transfer) |
| DELETE | `/students/:id` | Delete student (dependency checks) |
| POST | `/students/:id/transfer` | Transfer to another class + transfer history record; `reason` is required |
| GET | `/students/:id/transfer-history` | Transfer history for one student, including actor display when available |
| GET | `/students/:id/promotion-placement-history` | Promotion placement timeline with actor snapshot |
| GET | `/students/transfers/history` | Tenant-wide transfer history with student, old class, target class, reason, timestamp, and actor |

## Classes

| Method | Path | Description |
|---|---|---|
| GET | `/classes` | List classes; teacher and assigned staff are assignment-scoped and deduped by class |
| GET | `/classes/grades` | Grades with nested classes + student counts; teacher and assigned staff scope applies |
| GET | `/classes/:id` | Class detail + students + teacher assignments |
| POST | `/classes` | Create class (capacity from settings; grade must be within current grade range; enforces plan class limit per academic year) |
| PUT | `/classes/:id` | Update class (capacity must be within settings and `>=` current students; grade must be within current grade range) |
| DELETE | `/classes/:id` | Delete class (no students/assignments) |
| POST | `/classes/:id/assign-teacher` | Assign teacher/staff to class+subject |
| DELETE | `/classes/:id/assign-teacher/:assignmentId` | Remove assignment |
| GET | `/classes/:id/students` | Students in class |
| POST | `/classes/:id/students` | Add student to class (capacity check, tx) |
| DELETE | `/classes/:id/students/:studentId` | Remove student from class |

## Subjects

| Method | Path | Description |
|---|---|---|
| GET | `/subjects` | List subjects (teacher and assigned staff scoped to assignments) |
| GET | `/subjects/:id` | Subject detail + score components |
| POST | `/subjects` | Create subject (maxSubjects validation, code uniqueness) |
| PUT | `/subjects/:id` | Update subject |
| DELETE | `/subjects/:id` | Soft delete (sets isActive: false) |

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
| GET | `/scores/history` | Score mutation history for class + subject + semester context |
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
| POST | `/promotion/year-end/evaluate` | School-admin synchronous evaluation; writes placement history |
| GET | `/promotion/year-end/results` | Read PASS/FAIL groups, placement status, and placement history |
| POST | `/promotion/year-end/execute` | Execute promotion; may require `confirmCreateMissingClasses` for missing target classes |
| PATCH | `/promotion/year-end/failed/:promotionId` | Draft, assign, or inactive one failed student; inactive requires reason |

## Reports

| Method | Path | Description |
|---|---|---|
| GET | `/reports/subject-summary` | Pass rates + averages; teacher/assigned staff scoped by assignment |
| GET | `/reports/class-promotion-summary` | BM2 pass-rate by class; teacher/assigned staff class scope applies |
| GET | `/reports/semester-promotion-summary` | BM3 pass-rate by semester; teacher/assigned staff class scope applies |
| GET | `/reports/year-promotion-summary` | BM4 pass-rate by academic year; teacher/assigned staff class scope applies |
| GET | `/reports/dashboard` | School dashboard stats; supports `allYears=true` for report filters |
| GET | `/reports/transfer-report` | Class transfer history report |

## Parents

| Method | Path | Description |
|---|---|---|
| GET | `/parents` | List parent users (SUPER_ADMIN, STAFF) |
| POST | `/parents` | Create parent + link students |
| PUT | `/parents/:id` | Update parent account fields (`fullName`, `email`, `phone`, `isActive`, optional `password`); validates email/phone/password and returns safe fields only |
| DELETE | `/parents/:id` | Delete parent |
| POST | `/parents/:id/students` | Link student to parent |
| DELETE | `/parents/:id/students/:studentId` | Unlink student from parent |
| GET | `/parents/my-children` | Parent's children list (PARENT role) |
| GET | `/parents/my-children/:studentId/scores` | Child's scores (PARENT role) |
| GET | `/parents/semesters` | List parent semesters; supports `studentId` and returns only semesters with score data for that child (includes `displayName` with academic year, e.g. `Hoc ky 1 (2026-2027)`) |

## Settings

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Get current tenant settings |
| PUT | `/settings` | Update settings (validates ranges, blocks grade range/max class size changes below existing data, syncs class capacity, invalidates cache) |
| GET | `/settings/role-permissions` | Get role-based module permissions plus active STAFF/TEACHER usage and plan limits (read-only for `SUPER_ADMIN`,`STAFF`,`TEACHER`; not gated by `settings` module permission) |
| PUT | `/settings/role-permissions` | Update role permissions |
| GET | `/settings/grades` | List grades |
| POST | `/settings/grades` | Create grade (level uniqueness, min/max validation) |
| PUT | `/settings/grades/:id` | Update grade |
| DELETE | `/settings/grades/:id` | Delete grade (no classes) |

## Export

| Method | Path | Description |
|---|---|---|
| GET | `/export/students` | Export students (CSV/XLSX/PDF), supports `sections` + `columns` |
| GET | `/export/classes` | Export classes (CSV/XLSX/PDF), supports `sections` + `columns` |
| GET | `/export/scores` | Export scores for class+subject+semester (CSV/XLSX/PDF), supports `sections` + `columns` |
| GET | `/export/reports/:type` | Dynamic report export (CSV/XLSX/PDF); supports section toggles and report-specific column toggles |
| GET | `/export/schools` | Export schools — PLATFORM_ADMIN only (CSV/XLSX/PDF), supports `sections` + `columns` |

Export note:
- PDF-path runtime failures are normalized to `500` + `error.code = PDF_EXPORT_FAILED`.

## Monitoring (PLATFORM_ADMIN only)

| Method | Path | Description |
|---|---|---|
| GET | `/monitoring/system-stats` | System health: schools, users, CPU, memory, DB |
| GET | `/monitoring/activity-logs` | Activity log feed (paginated, filters) |
| GET | `/monitoring/school-stats/:schoolId` | Detailed stats for a specific school |

## Academic Years

| Method | Path | Description |
|---|---|---|
| GET | `/academic-years` | List academic years + semesters |
| GET | `/academic-years/semesters` | Shared read endpoint for score/report views (`SUPER_ADMIN`,`STAFF`,`TEACHER`), not gated by `academic-calendar` permission |
| GET | `/academic-years/:id` | Academic year detail |
| POST | `/academic-years` | Create academic year (overlap check, startYear < endYear) |
| PUT | `/academic-years/:id` | Update academic year |
| PATCH | `/academic-years/:id/activate` | Set active academic year (single active) |
| GET | `/academic-years/:id/semesters` | List semesters in one academic year |
| POST | `/academic-years/:id/semesters` | Create semester in academic year (date window + maxSemesters) |
| PATCH | `/academic-years/:id/semesters/:semesterId` | Update semester in academic year |
| DELETE | `/academic-years/:id/semesters/:semesterId` | Delete semester (dependency checks) |
| DELETE | `/academic-years/:id` | Delete (no semesters/enrollments/archives) |

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
- Smoke verification test: `tests/api/smoke-critical.spec.ts`
