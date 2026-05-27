# Promotion Calculation

Year-end promotion is now **synchronous**, **school-admin only**, and executed from the dedicated `/promotion` workflow (sidebar).

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
   - Returns `passStudents` and `failStudents` groups.
   - `PASS` rows include `autoTargetClassId/autoTargetClassName` (rule: keep class suffix, increase grade by 1, e.g. `10A1 -> 11A1`).
   - Also returns `nextAcademicYear` for assignment filtering.

3. `POST /api/promotion/year-end/execute`
   - Input: manual assignments for `FAIL` group only.
   - Behavior:
     - PASS students move by auto-mapping, no manual override.
     - FAIL students are assigned manually, but destination must belong to next academic year and grade level must be `<=` current grade.
     - Grade-12 PASS students are archived in `graduation_archives` and removed from active class.
     - Transfer history records are written.

## UI Placement

- Promotion actions (evaluate, fail-class assignment, execute) are handled on `/promotion`.
- `/reports` is read-only reporting surface and no longer contains promotion execution controls.

## Key Rule Changes

- No retention (`-LB`) class auto-creation.
- No `maxRetentions` deactivation flow in promotion.
- `RETAKE` is not used in final promotion summary rates.
- BM2/BM3/BM4 promotion reports count only `PromotionResult.PASS` as promoted.

## Related

- `backend/src/routes/promotion.routes.js`
- `backend/src/routes/report.routes.js`
- `backend/prisma/schema.prisma` (`GraduationArchive`)
- `GET /api/reports/graduation-summary?academicYearId=...`
