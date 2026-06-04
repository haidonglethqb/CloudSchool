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
   - Returns `passStudents` and `failStudents` groups with placement status/history.
   - `PASS` rows include `autoTargetClassId/autoTargetClassName` (rule: keep class suffix, increase grade by 1, e.g. `10A1 -> 11A1`).
   - Also returns `nextAcademicYear` for assignment filtering.

3. `POST /api/promotion/year-end/execute`
   - Input: manual assignments for `FAIL` group and optional `confirmCreateMissingClasses`.
   - Behavior:
     - PASS students move by auto-mapping, no manual override.
     - Missing PASS target classes return `MISSING_TARGET_CLASSES` until confirmation.
     - Confirmed missing target classes are created in next academic year.
     - FAIL students are assigned manually, but destination must belong to next academic year and grade level must be `<=` current grade.
     - Grade-12 PASS students are archived in `graduation_archives` and removed from active class.
     - Transfer history and promotion placement history records are written.

4. `PATCH /api/promotion/year-end/failed/:promotionId`
   - Input: `action=draft|assign|inactive`, optional `toClassId`, `reason`.
   - `inactive` requires a reason and stores inactive actor snapshot.
   - Used by the pending failed-student queue after year-end evaluation.

## UI Placement

- Promotion actions (evaluate, fail-class assignment, execute) are handled on `/promotion`.
- `/reports` is read-only reporting surface and no longer contains promotion execution controls.

## Key Rule Changes

- Failed students stay active in their old class until assigned or inactivated.
- Inactivation from the failed queue requires a reason.
- Placement timeline records every major step: evaluate, draft, assign, inactive, graduate, create target class.
- `RETAKE` is not used in final promotion summary rates.
- BM2/BM3/BM4 promotion reports count only `PromotionResult.PASS` as promoted.
- Seed data includes PASS/FAIL/RETAKE promotion rows for report smoke testing; học kỳ 2 in seed ends on `30/06`.

## Related

- `backend/src/routes/promotion.routes.js`
- `backend/src/routes/report.routes.js`
- `backend/prisma/schema.prisma` (`GraduationArchive`)
- `GET /api/reports/graduation-summary?academicYearId=...`
