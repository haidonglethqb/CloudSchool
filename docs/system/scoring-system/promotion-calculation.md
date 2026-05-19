# Promotion Calculation

Year-end promotion is now **synchronous**, **school-admin only**, and executed from summary reports.

## Endpoints

1. `POST /api/promotion/year-end/evaluate`
   - Input: `academicYearId`, optional `classId`
   - Preconditions:
     - Academic year has at least 2 semesters
     - First 2 semesters have ended (`endDate < now`)
     - Required score components exist for each student/subject/semester
   - Result:
     - Upsert promotion records on final semester of year
     - `PASS` only when overall + per-subject conditions satisfy `passScore`
     - `FAIL` otherwise
     - If missing scores: return `MISSING_SCORES` with detailed list

2. `GET /api/promotion/year-end/results`
   - Returns `passStudents` and `failStudents` groups for assignment UI.

3. `POST /api/promotion/year-end/execute`
   - Input: one-shot class assignments for PASS and FAIL groups.
   - Behavior:
     - PASS students move to assigned destination class.
     - FAIL students stay in separate assignment pool and are assigned manually.
     - Grade-12 PASS students are archived in `graduation_archives` and removed from active class.
     - Transfer history records are written.

## Key Rule Changes

- No retention (`-LB`) class auto-creation.
- No `maxRetentions` deactivation flow in promotion.
- `RETAKE` is not used in final promotion summary rates.
- BM2/BM3/BM4 promotion reports count only `PromotionResult.PASS` as promoted.

## Related

- `backend/src/routes/promotion.routes.js`
- `backend/src/routes/report.routes.js`
- `backend/prisma/schema.prisma` (`GraduationArchive`)
