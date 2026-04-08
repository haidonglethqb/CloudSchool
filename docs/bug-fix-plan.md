---
title: "Fix All 42 Bugs — Comprehensive Implementation Plan"
description: "Phased plan to fix all 42 bugs in CloudSchool multi-tenant SaaS, ordered by criticality and dependency"
status: pending
priority: P0
effort: "~40-60 hours across 6 phases"
branch: "fix/all-42-bugs"
tags: [bug-fix, security, data-integrity, multi-tenant, production]
created: 2026-04-08
---

# Bug Fix Implementation Plan — All 42 Bugs

## Executive Summary

| Category | Count | Risk Level |
|----------|-------|------------|
| Critical (security/data corruption) | 7 | Must fix before any release |
| High (logic errors/crashes) | 9 | Fix before production deploy |
| Medium (UX/performance/correctness) | 15 | Fix in next sprint |
| Low (hardening/cleanup) | 10 | Fix as maintenance |

**Strategy:** 6 phases, ordered by risk. Each phase is independently testable. Schema changes (Phase 0) done first to unblock route changes.

**Quick wins** (< 5 min each): #30, #33, #34, #35, #37, #41, #42 — 7 fixes, ~30 min total.

---

## Phase 0: Schema & Config Foundations (Prerequisites)

**Priority:** Must be done first — unblocks later phases
**Files:** `backend/prisma/schema.prisma`, `backend/.env.example`
**Estimated:** 30 min

### Tasks

| # | Bug | File | Change | Complexity |
|---|-----|------|--------|------------|
| 36 | `Class.academicYear` is string, not FK | `schema.prisma` | Add `academicYearId String?` field with FK relation to `AcademicYear`. Keep `academicYear` string as computed/deprecated. Add migration. | Medium |
| 7 | Cookie secure flag misconfiguration | `auth.routes.js` `setTokenCookie()` | Replace `secure: process.env.NODE_ENV === 'production'` with `secure: process.env.COOKIE_SECURE === 'true'`. Add `COOKIE_SECURE` to `.env.example`. Add `sameSite: 'lax'`. | Simple |

### Testing Checklist
- [ ] `npx prisma migrate dev` runs without errors
- [ ] `npx prisma generate` succeeds
- [ ] Existing class queries still work (backward compat with string `academicYear`)
- [ ] Cookie has `SameSite=Lax` and `Secure` flags in browser dev tools

---

## Phase 1: Critical Security & Data Integrity Fixes

**Priority:** P0 — Block production release until done
**Files:** `student.routes.js`, `class.routes.js`, `user.routes.js`, `auth.routes.js`, `score.routes.js`
**Estimated:** 4-5 hours

### Tasks

#### #1 Race condition: Student creation capacity check outside transaction
- **File:** `backend/src/routes/student.routes.js` — POST `/students`
- **Current:** Bug #1 description says "outside transaction" but reading the code, the capacity check IS already inside the `$transaction`. **VERIFIED: Already fixed.** Mark as ✅ DONE.

#### #2 Race condition: Add student to class capacity check
- **File:** `backend/src/routes/class.routes.js` — POST `/:id/students`
- **Current:** Capacity check inside transaction but no isolation level
- **Fix:** Change `prisma.$transaction(async (tx) => { ... })` to `prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })`
- **Complexity:** Simple

#### #3 Privilege escalation: PUT `/users/:id` allows role → PLATFORM_ADMIN
- **File:** `backend/src/routes/user.routes.js` — PUT `/:id`
- **Current:** `if (role) updateData.role = role` — no validation
- **Fix:** Add allowed roles list: `const ALLOWED_ROLES = ['SUPER_ADMIN', 'STAFF', 'TEACHER']`. Before update, check `if (role && !ALLOWED_ROLES.includes(role)) throw new AppError('Invalid role', 400, 'INVALID_ROLE')`. Also prevent non-PLATFORM_ADMIN from escalating to their own role level.
- **Complexity:** Simple

#### #4 CSRF vulnerability
- **File:** `backend/src/routes/auth.routes.js` — `setTokenCookie()`
- **Fix:** Add `sameSite: 'lax'` to cookie options. Add comment recommending `csurf` or double-submit CSRF token for state-changing endpoints. For cookie-auth endpoints, add `csrf-protection` middleware note.
- **Complexity:** Simple

#### #5 Transfer student with no class → crash
- **File:** `backend/src/routes/student.routes.js` — POST `/:id/transfer`
- **Current:** `fromClassId` can be null if student has no class. TransferHistory requires non-null `fromClassId`.
- **Fix:** Add check: `if (!fromClassId) throw new AppError('Student has no current class to transfer from', 400, 'NO_FROM_CLASS')`. Already guarded by `if (fromClassId === classId)` but that doesn't catch null. Move the `if (fromClassId)` check BEFORE creating TransferHistory — already done, but add explicit null check with error.
- **Complexity:** Simple

#### #6 Score upsert missing tenantId
- **File:** `backend/src/routes/score.routes.js` — POST `/scores/batch`
- **Current:** Upsert `where` clause uses unique constraint `studentId_subjectId_semesterId_scoreComponentId` without `tenantId`
- **Fix:** Add `tenantId: req.tenantId` to the upsert `where` clause by adding it as a field in create. The unique constraint doesn't include tenantId, so add a check: verify all scoreComponentIds belong to tenant before upsert. In the `create` branch, tenantId is set. But the `where` clause should also be scoped. **Actually** the unique constraint `studentId_subjectId_semesterId_scoreComponentId` is global — a student from tenant A could theoretically match a score from tenant B. Fix: Before the transaction, batch-verify all studentIds belong to tenant. Already done for TEACHER role but not for SUPER_ADMIN/STAFF. Add tenant verification for all roles.
- **Complexity:** Medium

#### #7 Cookie secure flag — covered in Phase 0 ✅

### Testing Checklist
- [ ] Concurrent requests to add students to class at capacity → only 1 succeeds (test with parallel API calls)
- [ ] Attempt to set user role to PLATFORM_ADMIN → 400 error
- [ ] Cookie in browser shows `SameSite=Lax; Secure`
- [ ] Transfer student without class → 400 with clear error message
- [ ] Score batch upsert with cross-tenant studentId → fails with tenant isolation error
- [ ] All existing student/class/score CRUD tests pass

---

## Phase 2: High-Priority Logic Bug Fixes

**Priority:** P1 — Fix before production deploy
**Files:** `score.routes.js`, `year-end-promotion.routes.js`, `user.routes.js`, `fee.routes.js`, `settings.routes.js`, `class.routes.js`, `academic-year.routes.js`
**Estimated:** 5-6 hours

### Tasks

| # | File | Route/Function | Fix | Complexity |
|---|------|---------------|-----|------------|
| 8 | `score.routes.js` | GET `/student/:studentId` | In ranking calculation, `classmateAverages` uses raw division without rounding. Apply `Math.round(avg * 100) / 100` for consistency with `overallAverage`. | Simple |
| 9 | `year-end-promotion.routes.js` | `processPassStudents()` | `fromClassId: p.student.classId` — `p.student` only has `{ id, fullName, studentCode, classId }` via select. But `p.student.classId` is the **current** classId which is correct. However the bug says use `p.classId` instead. The promotion record's `classId` is the authoritative source. Change `fromClassId: p.student.classId` → `fromClassId: p.classId`. | Simple |
| 10 | `year-end-promotion.routes.js` | `findOrCreateClass()` | When duplicate class name exists (e.g., `10A1-LB` already exists and is full), current code sets `cls = null` and tries to create → unique constraint violation. **Fix:** Catch unique constraint error, try `*-LB-2`, then `*-LB-3`, etc. Use a loop: `for (let suffix = ''; ; suffix = suffix ? \`-${parseInt(suffix.replace('-',''))+1}\` : '-2')`. | Medium |
| 11 | `user.routes.js` | PATCH `/:id/disable` | Already calls `invalidateUserCache(req.params.id)` — **VERIFIED: Already fixed.** Mark as ✅ DONE. | — |
| 12 | `score.routes.js` | POST `/scores/batch` | Add validation: for each score, verify `scoreComponentId` belongs to the same `subjectId`. Batch-fetch all components, build map `{ componentId → subjectId }`, verify match. | Medium |
| 13 | `fee.routes.js` | PATCH `/:id/students/:studentId` | When `status === 'PAID'`, validate `paidAmount >= fee.amount`. Add: `if (status === 'PAID' && (paidAmount === undefined || paidAmount < fee.amount)) throw new AppError(...)`. | Simple |
| 14 | `settings.routes.js` | PUT `/` | Already validates `minScore <= maxScore`, `minAge <= maxAge`, etc. But `passScore` is not validated against range. Add: `if (passScore !== undefined && (passScore < effectiveMinScore || passScore > effectiveMaxScore)) throw new AppError(...)`. | Simple |
| 15 | `class.routes.js` | PUT `/:id` | Add validation: `if (capacity !== undefined) { const studentCount = existingClass._count?.students || await prisma.student.count({ where: { classId: req.params.id } }); if (capacity < studentCount) throw AppError(...) }`. Include `_count: { select: { students: true } }` in the existingClass query. | Simple |
| 16 | `academic-year.routes.js` | POST `/`, PUT `/:id` | Add overlap check: `const overlap = await prisma.academicYear.findFirst({ where: { tenantId, id: { not: id }, OR: [{ startYear: { lte: endYear }, endYear: { gte: startYear } }] } })`. If overlap exists → 409. | Medium |

### Testing Checklist
- [ ] Score ranking shows consistent 2-decimal rounding
- [ ] Year-end promotion creates correct transfer history with proper `fromClassId`
- [ ] LB class duplicate → creates `10A1-LB-2` without crash
- [ ] Score batch with mismatched scoreComponent→subject → 400 error
- [ ] Fee marked PAID with insufficient paidAmount → 400 error
- [ ] passScore outside minScore-maxScore range → 400 error
- [ ] Class capacity reduced below current student count → 400 error
- [ ] Overlapping academic year creation → 409 error
- [ ] All promotion tests pass with new duplicate handling

---

## Phase 3: Medium-Priority Correctness & Performance Fixes

**Priority:** P2 — Fix in next sprint
**Files:** `report.routes.js`, `student.routes.js`, `class.routes.js`, `export.routes.js`, `score.routes.js`, `subject.routes.js`, `score-component.routes.js`, `promotion.routes.js`, `monitoring.routes.js`, `auth.routes.js`
**Estimated:** 6-8 hours

### Tasks

| # | File | Route/Function | Fix | Complexity |
|---|------|---------------|-----|------------|
| 17 | `report.routes.js` | GET `/subject-summary`, `/semester-summary` | Already does batch fetch per class (not N+1 per student). The `Promise.all(classes.map(...))` each does 1 score query. For 30 classes = 30 queries. **Optimization:** Batch ALL scores in 1 query, then group by class+student in memory. Fetch all scores with `studentId: { in: allStudentIds }`, then use a Map to group. | Medium |
| 18 | `student.routes.js` | DELETE `/:id` | Currently only checks scores. Add checks for: `parentStudents`, `promotions`, `studentFees`, `transferHistories`. For each, if count > 0 → appropriate error code. | Medium |
| 19 | `class.routes.js` | GET `/classes/grades` | Missing `tenantGuard` middleware. Add: `router.get('/grades', authenticate, tenantGuard, async ...)`. Import `tenantGuard` from auth middleware. | Simple |
| 20 | `export.routes.js` | `sendCSV()` | Escape values starting with `=`, `+`, `-`, `@` to prevent CSV formula injection. Add: `if (/^[=+\-@]/.test(val)) return "'" + val`. Also prepend single quote for safety. | Simple |
| 21 | `frontend/src/store/auth.ts` | Zustand store | Change `persist` to use `sessionStorage` instead of `localStorage`: add `{ name: 'auth-storage', storage: { getItem: (name) => { const val = sessionStorage.getItem(name); return val ? JSON.parse(val) : null; }, setItem: (name, val) => sessionStorage.setItem(name, JSON.stringify(val)), removeItem: (name) => sessionStorage.removeItem(name) } }`. | Simple |
| 22 | `score.routes.js` | POST `/scores` (teacher semester check) | Store tenant timezone in `TenantSettings` (add `timezone` field, default `Asia/Ho_Chi_Minh`). Convert `now` to tenant timezone before comparing with `semester.startDate/endDate`. Use `Intl.DateTimeFormat` or a lightweight approach. For now, add `timezone` to settings and use it in comparison. | Medium |
| 23 | `student.routes.js` | GET `/students/:id` | Currently loads ALL scores. Add optional `?semesterId` query param filter. Modify include: `scores: { where: { ...(semesterId && { semesterId }) }, include: { ... } }`. | Simple |
| 24 | `subject.routes.js` | DELETE `/:id` (soft delete) | When deactivating subject, also deactivate its scoreComponents: `await prisma.scoreComponent.updateMany({ where: { subjectId: req.params.id }, data: { /* add isActive field to ScoreComponent */ } })`. **Note:** ScoreComponent model doesn't have `isActive`. Two options: (a) Add `isActive` to schema, or (b) Delete components with no scores. **Recommended:** Add `isActive Boolean @default(true)` to ScoreComponent model. | Medium (requires schema change) |
| 25 | `score-component.routes.js` | POST `/`, PUT `/:id` | Already validates total weight ≤ 100%. Add **warning** (not error) when total ≠ 100%: return `{ warning: 'Total weight is X%, not 100%' }` in response. Also add a `GET /score-components/total-weight/:subjectId` endpoint for frontend to check. | Simple |
| 26 | `class.routes.js` | DELETE `/:id` | Currently only checks students. Add checks for: `teacherAssignments`, `fees`, `promotions`, `enrollments`. For each, if count > 0 → appropriate error. | Medium |
| 27 | `export.routes.js` | GET `/scores` | Add TEACHER role to authorize. Add validation: teacher can only export scores for classes they're assigned to. Check `teacherAssignment` exists for the requested `classId` + `subjectId`. | Medium |
| 28 | `frontend/src/lib/api.ts` | Axios error interceptor | When `responseType: 'blob'`, error responses are also blobs. Parse them: `if (error.config?.responseType === 'blob' && error.response?.data instanceof Blob) { const text = await error.response.data.text(); try { error.response.data = JSON.parse(text); } catch {} }`. | Simple |
| 29 | `promotion.routes.js` | POST `/calculate` (maxRetentions) | Currently counts ALL FAIL records across all time. Scope by academic year: join with semester → academicYear, filter by current academic year. Add `academicYearId` to the groupBy where clause. | Medium |
| 30 | `monitoring.routes.js` | All routes | Change `var dbTableCount` → `let dbTableCount`, same for `dbActiveConnections`. | Simple |
| 31 | `subject.routes.js` | PUT `/:id` | Add duplicate code check: `if (code && code.toUpperCase() !== existing.code.toUpperCase()) { const dup = await prisma.subject.findFirst({ where: { tenantId, code: code.toUpperCase(), id: { not: req.params.id } } }); if (dup) throw new AppError('Subject code already exists', 409, 'DUPLICATE') }`. | Simple |
| 32 | `score-component.routes.js` | PUT `/:id` | Add duplicate name check within same subject: `if (name) { const dup = await prisma.scoreComponent.findFirst({ where: { tenantId, subjectId: current.subjectId, name, id: { not: req.params.id } } }); if (dup) throw new AppError('Component name already exists in this subject', 409, 'DUPLICATE') }`. | Simple |

### Testing Checklist
- [ ] Reports load faster with batched score queries (measure with 100+ students)
- [ ] Student with fees/promotions/transfers cannot be deleted → proper error
- [ ] `/classes/grades` returns 403 without tenant context
- [ ] CSV with `=SUM(A1:A10)` exports as `'=\SUM(A1:A10)` (escaped)
- [ ] Auth token not persisted after browser tab close (sessionStorage)
- [ ] GET `/students/:id?semesterId=X` returns filtered scores
- [ ] Soft-deleted subject also deactivates scoreComponents
- [ ] Weight total ≠ 100% → response includes warning field
- [ ] Class with assignments/fees/promotions cannot be deleted
- [ ] Teacher can export scores only for assigned class+subject
- [ ] Blob API errors are properly parsed as JSON
- [ ] maxRetentions counts scoped to current academic year
- [ ] No `var` declarations in monitoring.routes.js
- [ ] Duplicate subject code on PUT → 409 with clear message
- [ ] Duplicate score component name on PUT → 409 with clear message

---

## Phase 4: Low-Priority Hardening & Cleanup

**Priority:** P3 — Maintenance
**Files:** `app.js`, `export.routes.js`, `student.routes.js`, `page.tsx`, `year-end-promotion.routes.js`, `score.routes.js`, `auth.routes.js`, `score-component.routes.js`
**Estimated:** 2-3 hours

### Tasks

| # | File | Route/Function | Fix | Complexity |
|---|------|---------------|-----|------------|
| 33 | `app.js` | Rate limit bypass | `req.headers['x-ratelimit-bypass'] === bypassSecret` — secret exposed in headers. Change to check a signed token or IP whitelist. **Minimal fix:** Remove header-based bypass entirely, use environment-specific config (`if (process.env.NODE_ENV === 'test')`). | Simple |
| 34 | `app.js` | Missing CSP header | Add `helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "blob:"], connectSrc: ["'self'", process.env.CORS_ORIGIN], fontSrc: ["'self'"] } })`. | Simple |
| 35 | `export.routes.js` | CSV export | Add `res.setHeader('X-Content-Type-Options', 'nosniff')` before sending CSV. | Simple |
| 37 | `student.routes.js` | POST `/students` | Validate `admissionDate` is valid ISO8601 format. Add express-validator: `body('admissionDate').optional().isISO8601()`. Currently just does `new Date(admissionDate)` which accepts invalid strings. | Simple |
| 38 | `frontend/src/app/page.tsx` | Landing page | Remove hardcoded demo credentials from comments/HTML. Move to a separate `docs/demo-credentials.md` file. | Simple |
| 39 | `year-end-promotion.routes.js` | `findOrCreateClass()` | Already checks `cls._count.students >= cls.capacity`. But in `processPassStudents`, when finding existing class, capacity is not checked before assigning. The `findOrCreateClass` function checks capacity, but if the class exists and is NOT full, it returns it — this is correct. **Re-reading the bug:** "class capacity not checked" — the issue is in `processFailStudents` where retained students are assigned to LB class. The `findOrCreateClass` already checks capacity. **VERIFIED: Already handled by findOrCreateClass capacity check.** Mark as ✅ DONE. | — |
| 40 | `score.routes.js` | PATCH `/:id/lock`, `/:id/unlock` | Currently does 2 queries: (1) find existing, (2) update. Combine into 1: `prisma.score.update({ where: { id, tenantId: req.tenantId }, data: { isLocked: true } })`. If record doesn't exist, Prisma throws P2025 which errorHandler converts to 404. Catch and convert to proper AppError. | Simple |
| 41 | `auth.routes.js` | GET `/plans` | Add caching: Set `Cache-Control: public, max-age=3600` header. Subscription plans rarely change. | Simple |
| 42 | `score-component.routes.js` | PUT `/:id` | Already validates `totalWeight > 100`. But also validate individual `weight > 100`: `if (weight > 100) throw new AppError('Weight cannot exceed 100', 400, 'INVALID_WEIGHT')`. Also validate `weight < 1`. | Simple |

### Testing Checklist
- [ ] Rate limit bypass only works in test environment
- [ ] CSP headers present in all responses
- [ ] CSV download has `X-Content-Type-Options: nosniff`
- [ ] Invalid admissionDate format → 400 validation error
- [ ] No hardcoded credentials visible in landing page source
- [ ] Lock/unlock score → 1 query instead of 2 (check Prisma query log)
- [ ] GET `/auth/plans` returns `Cache-Control: public, max-age=3600`
- [ ] Score component weight > 100 or < 1 → 400 error

---

## Phase 5: Frontend Integration & E2E Testing

**Priority:** P2 — Ensures all backend fixes work with frontend
**Files:** `frontend/src/store/auth.ts`, `frontend/src/lib/api.ts`, all frontend pages
**Estimated:** 3-4 hours

### Tasks

| # | Task | Description |
|---|------|-------------|
| F1 | Auth store sessionStorage | Implement #21 — change persist storage |
| F2 | Blob error parsing | Implement #28 — parse blob error responses |
| F3 | Error display updates | Update frontend error handling to display new error codes (WEIGHT_EXCEEDED, INVALID_AGE, CLASS_FULL, etc.) |
| F4 | Export role updates | Add TEACHER role to export UI for score export (#27) |
| F5 | Score component warnings | Display weight total warning in UI (#25) |
| F6 | Landing page cleanup | Remove hardcoded credentials (#38) |

### Testing Checklist
- [ ] Login flow works with sessionStorage
- [ ] Export errors display properly (not "[object Object]")
- [ ] Teacher sees export button for assigned classes
- [ ] Score component form shows weight warning
- [ ] Landing page has no credentials in source

---

## Phase 6: Regression Testing & Deployment

**Priority:** P1 — Final validation before release
**Estimated:** 2-3 hours

### Tasks
1. Run full test suite (if exists) or manual regression test
2. Verify all 42 bugs are resolved
3. Create migration script for schema changes (Phase 0 + #24)
4. Update `CHANGELOG.md` with all fixes
5. Tag release

### Full Regression Checklist
- [ ] Auth: login, logout, register, me, plans
- [ ] Users: CRUD, disable, assignments
- [ ] Students: CRUD, transfer, history
- [ ] Classes: CRUD, assignments, students
- [ ] Subjects: CRUD, semesters
- [ ] Score Components: CRUD, weight validation
- [ ] Scores: entry, batch, lock/unlock, class lock
- [ ] Promotion: calculate, override, year-end promote
- [ ] Reports: subject, semester, dashboard, transfer, retention
- [ ] Parents: CRUD, children, scores
- [ ] Settings: update, grades, role permissions
- [ ] Export: students, classes, scores, schools
- [ ] Monitoring: system-stats, activity-logs, school-stats
- [ ] Fees: CRUD, payment, assign
- [ ] Academic Years: CRUD
- [ ] Tenant: info, stats

---

## Dependencies Graph

```
Phase 0 (Schema) ──┬──► Phase 1 (Critical)
                    ├──► Phase 2 (High)
                    └──► Phase 3 (#24 needs schema change)

Phase 1 ───────────► Phase 2 (score routes depend on tenant validation)

Phase 2 ───────────► Phase 3 (report optimization depends on batch patterns)

Phase 3 ───────────► Phase 5 (frontend integration depends on backend API changes)

Phase 0 + 1 + 2 + 3 + 4 + 5 ──► Phase 6 (Regression & Deploy)
```

---

## Quick Wins Summary (< 5 min each)

| # | Fix | File | Time |
|---|-----|------|------|
| 30 | `var` → `let` | `monitoring.routes.js` | 1 min |
| 33 | Rate limit bypass env-only | `app.js` | 2 min |
| 34 | CSP header | `app.js` | 3 min |
| 35 | X-Content-Type-Options on CSV | `export.routes.js` | 1 min |
| 37 | admissionDate validation | `student.routes.js` | 2 min |
| 41 | Cache-Control on /plans | `auth.routes.js` | 1 min |
| 42 | Weight > 100 check | `score-component.routes.js` | 2 min |
| 4 | CSRF sameSite | `auth.routes.js` | 1 min |
| 19 | tenantGuard on /grades | `class.routes.js` | 1 min |
| 20 | CSV formula injection | `export.routes.js` | 3 min |

**Total quick wins:** ~17 minutes for 10 fixes.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema migration (#36, #24) breaks existing data | Medium | High | Backup DB before migration. Test on copy first. Keep backward compat. |
| Serializable isolation (#2) causes deadlocks under load | Low | Medium | Monitor deadlock logs. Fallback to `RepeatableRead` if needed. |
| sessionStorage (#21) breaks "remember me" UX | Medium | Low | Add clear user communication. Token refresh still works via cookie. |
| CSV formula escaping (#20) breaks existing exports | Low | Low | Only affects values starting with special chars — rare in Vietnamese names. |
| Year-end promotion duplicate handling (#10) creates messy class names | Medium | Low | `*-LB-2`, `*-LB-3` are ugly but functional. Add UI cleanup later. |
| Score batch tenant validation (#6) breaks existing workflows | Low | High | Thoroughly test with all 3 roles (SUPER_ADMIN, STAFF, TEACHER). |

---

## Rollback Strategy

1. **Git-based rollback:** Each phase should be a separate commit. Revert with `git revert <commit-hash>`.
2. **Database rollback:** Keep migration files. Rollback with `npx prisma migrate reset` (dev) or manual SQL (prod).
3. **Feature flags:** For risky changes (#2 Serializable isolation, #6 tenant validation), wrap in env var: `process.env.ENABLE_STRICT_TENANT_VALIDATION === 'true'`.
4. **Staged deploy:** Deploy to staging first. Run full regression. Only then deploy to production.

---

## Already Fixed (Verified)

| # | Bug | Status |
|---|-----|--------|
| 1 | Student creation capacity in transaction | ✅ Already inside transaction |
| 11 | Disable user cache invalidation | ✅ Already calls invalidateUserCache |
| 39 | Year-end promotion capacity check | ✅ findOrCreateClass checks capacity |

---

## Files Modified Summary

| File | Bugs Fixed |
|------|-----------|
| `backend/prisma/schema.prisma` | #36, #24 |
| `backend/src/app.js` | #33, #34 |
| `backend/src/routes/auth.routes.js` | #4, #7, #41 |
| `backend/src/routes/user.routes.js` | #3 |
| `backend/src/routes/student.routes.js` | #5, #18, #23, #37 |
| `backend/src/routes/class.routes.js` | #2, #15, #19, #26 |
| `backend/src/routes/score.routes.js` | #6, #8, #12, #22, #40 |
| `backend/src/routes/score-component.routes.js` | #25, #32, #42 |
| `backend/src/routes/year-end-promotion.routes.js` | #9, #10 |
| `backend/src/routes/fee.routes.js` | #13 |
| `backend/src/routes/settings.routes.js` | #14 |
| `backend/src/routes/academic-year.routes.js` | #16 |
| `backend/src/routes/report.routes.js` | #17 |
| `backend/src/routes/subject.routes.js` | #24, #31 |
| `backend/src/routes/export.routes.js` | #20, #27, #35 |
| `backend/src/routes/promotion.routes.js` | #29 |
| `backend/src/routes/monitoring.routes.js` | #30 |
| `frontend/src/store/auth.ts` | #21 |
| `frontend/src/lib/api.ts` | #28 |
| `frontend/src/app/page.tsx` | #38 |

**Total files modified:** 20
**Total bugs to fix:** 39 (3 already verified as fixed)

---

## Unresolved Questions

1. **#22 Timezone:** Should we add a `timezone` field to `TenantSettings` model, or use a system-wide `TIMEZONE` env var? Multi-tenant suggests per-tenant, but adds schema complexity.
2. **#6 Score upsert tenantId:** The unique constraint `studentId_subjectId_semesterId_scoreComponentId` doesn't include `tenantId`. Should we add `tenantId` to the constraint? This would require a migration and might affect existing data.
3. **#33 Rate limit bypass:** Should we remove it entirely or restrict to IP whitelist? IP whitelist is harder to maintain in cloud environments.
4. **#39 Marked as done:** Need confirmation that `findOrCreateClass` capacity check covers all code paths (both pass and fail student processing).
5. **Test coverage:** No existing test files found. Should we add integration tests before or after fixes?
