# CloudSchool - Conversation Context

## Project Overview
**CloudSchool** — Multi-tenant School Management SaaS
- **Backend**: Node.js + Express.js 5, Prisma ORM ^5.22.0, PostgreSQL 16-alpine
- **Frontend**: Next.js App Router, React, TypeScript, Zustand, Tailwind CSS
- **Auth**: JWT httpOnly cookies, 6 roles (PLATFORM_ADMIN, SUPER_ADMIN, STAFF, TEACHER, STUDENT, PARENT)
- **Code Style**: Standard.js (no semicolons, 2-space indent, single quotes)
- **Dependencies added**: `express-rate-limit`, `lru-cache`, `exceljs`
- **Schema**: 17 models, 7 enums, ~28 indexes (11 original + 17 new)

---

## Session History (Chronological)

### Session 1 — Feature Implementation (7 Phases)
- Vietnamese requirements spec (12 BM + 12 QĐ) → gap analysis → 7-phase implementation plan
- All phases implemented → 97% coverage
- Fixes: QĐ8 maxSemesters, ERD/DBML, 4 system logic issues, 16 tenant isolation security bugs
- Year-end promotion workflow added
- Frontend fixes applied

### Session 2 — Full Code Audit & 25 Bug Fixes
- Full code audit discovered 25 bugs:
  - 14 security/cross-tenant issues
  - 5 logic bugs
  - 4 edge cases
  - 2 schema fixes
- All 25 fixes applied

### Session 3 — Performance Audit
- Deep performance audit found 48 issues across 8 categories
- Deep line-by-line audit discovered 5 NEW security bugs
- All issues cataloged for implementation

### Session 4 — 8-Phase Optimization Implementation
All 8 optimization phases implemented:

| Phase | Description | Details |
|-------|-------------|---------|
| 1 | Security fixes | 10 tenantId additions to cross-tenant queries |
| 2 | Database indexes | 17 new indexes in schema.prisma |
| 3 | N+1 query elimination | 5 fixes (fee stats, monitoring, admin, score batch, report) |
| 4 | Computation optimization | 4 fixes (ranking, semester-summary Map, findOrCreateClass cache) |
| 5 | Rate limiting | Global 200/min, login 20/15min, register 10/hr, export 20/min, monitoring 4/min |
| 6 | LRU caching | User cache 500/60s, settings cache 100/5min, graceful shutdown |
| 7 | Transaction wraps | 4 $transaction wraps (score batch, user assignments, fee create, promotion calculate) |
| 8 | Query optimization | Query merges and select optimizations |

All syntax checks passed, Prisma schema validated.

### Session 5 — Double-Check & Edge Case Review (Current)
Thorough review of ALL modified files for edge cases and logic issues.

**5 Issues Found & Fixed:**

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | **CRITICAL** | `user.routes.js` | `invalidateUserCache()` never called on PUT/PATCH/DELETE → deactivated users stay cached 60s | Added `invalidateUserCache(id)` on update/disable/delete |
| 2 | **CRITICAL** | `settings.routes.js` | `invalidateSettingsCache()` never called on PUT → stale settings cached 5min | Added `invalidateSettingsCache(tenantId)` on settings + rolePermissions update |
| 3 | **SECURITY** | `parent.routes.js` | DELETE `/parents/:id/students/:studentId` — no tenant validation → cross-tenant IDOR | Added tenant check before unlink |
| 4 | **DEFENSE** | `student.routes.js` | Teacher assignment query missing `tenantId` filter | Added `tenantId: req.tenantId` |
| 5 | **DEFENSE** | `class.routes.js` | Teacher assignment query missing `tenantId` filter | Added `tenantId: req.tenantId` |

Also added `invalidateUserCache` calls to `parent.routes.js` for parent PUT/DELETE operations.

**Verified OK (no issues):**
- Raw SQL table names in monitoring/admin match `@@map` values ✅
- Schema indexes (17 new + originals) all valid ✅
- Rate limiters properly configured ✅
- `$transaction` wraps correct ✅
- Fee groupBy optimization correct ✅
- Score batch validation logic correct ✅
- Year-end promotion cached findOrCreateClass correct ✅
- `existingScore.findUnique` uses globally unique compound key — safe ✅
- Prisma schema validates ✅
- All 17 route files + middleware + lib pass syntax checks ✅

---

## Current Codebase State

### Modified Files Summary

| File | Key Changes |
|------|-------------|
| `backend/src/app.js` | Global rate limiter (200/min), export limiter (20/min), monitoring limiter (4/min), `express.json({ limit: '1mb' })` |
| `backend/src/lib/prisma.js` | Graceful shutdown on SIGINT/SIGTERM |
| `backend/src/middleware/auth.js` | LRU user cache (500/60s), LRU settings cache (100/5min), `req.tenantSettings` auto-attached, exports `invalidateUserCache`/`invalidateSettingsCache` |
| `backend/src/routes/auth.routes.js` | Login rate limiter (20/15min), register rate limiter (10/hr) |
| `backend/src/routes/score.routes.js` | tenantId on teacher assignment queries, ranking optimization (select + Map), batch teacher validation, $transaction for batch upserts |
| `backend/src/routes/export.routes.js` | tenantId on student/scoreComponent/class/subject/semester queries, findUnique→findFirst |
| `backend/src/routes/parent.routes.js` | tenantId on score query, tenant validation on student linking/unlinking, invalidateUserCache on update/delete |
| `backend/src/routes/fee.routes.js` | tenantId on parent my-fees, N+1 aggregate→groupBy, fee create+studentFee.createMany in $transaction |
| `backend/src/routes/user.routes.js` | tenantId on deleteMany assignments, delete+create assignments in $transaction, invalidateUserCache on update/disable/delete |
| `backend/src/routes/promotion.routes.js` | Full $transaction for upsert+deactivation, batch groupBy for fail counts |
| `backend/src/routes/monitoring.routes.js` | 24 sequential counts→2 raw SQL GROUP BY queries |
| `backend/src/routes/admin.routes.js` | 12 parallel counts→2 raw SQL GROUP BY queries |
| `backend/src/routes/report.routes.js` | groupBy for fail counts, semester-summary pre-built Map optimization |
| `backend/src/routes/year-end-promotion.routes.js` | Merged 2 findMany→1+filter, findOrCreateClassCached with Map cache, select instead of full include |
| `backend/src/routes/student.routes.js` | Teacher assignment query + tenantId filter |
| `backend/src/routes/class.routes.js` | Teacher assignment query + tenantId filter |
| `backend/src/routes/settings.routes.js` | invalidateSettingsCache on settings/rolePermissions update |
| `backend/prisma/schema.prisma` | 17 new indexes across Score, Promotion, Fee, StudentFee, Class, Grade, Semester, TeacherAssignment, TransferHistory, ActivityLog, AcademicYear, ClassEnrollment |

### Total Fixes Applied Across All Sessions
- **Security/Cross-tenant**: ~40 fixes
- **Logic bugs**: ~10 fixes
- **Performance optimizations**: 48 issues addressed
- **Edge cases**: ~10 fixes
- **Schema improvements**: 17 new indexes + 2 schema fixes