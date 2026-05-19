-- Schema columns are created in the initial migration.
-- This migration keeps only data backfill steps for existing databases.

-- Backfill module defaults for existing tenants (all modules except fees)
UPDATE "tenant_settings"
SET "enabledModules" = to_jsonb(ARRAY[
  'users',
  'student-admission',
  'student-lookup',
  'classes',
  'class-transfer',
  'subjects',
  'scores',
  'reports',
  'parents',
  'academic-calendar',
  'settings',
  'export'
]::TEXT[])
WHERE "enabledModules" IS NULL;

-- Backfill academic year date range from semesters linked by academicYearId
UPDATE "academic_years" ay
SET
  "startDate" = s."minStartDate",
  "endDate" = s."maxEndDate"
FROM (
  SELECT
    "academicYearId",
    MIN("startDate") AS "minStartDate",
    MAX("endDate") AS "maxEndDate"
  FROM "semesters"
  WHERE "academicYearId" IS NOT NULL
  GROUP BY "academicYearId"
) s
WHERE ay."id" = s."academicYearId";

-- Fallback for years without semester links
UPDATE "academic_years"
SET
  "startDate" = COALESCE("startDate", make_date("startYear", 9, 1)),
  "endDate" = COALESCE("endDate", make_date("endYear", 8, 31))
WHERE "startDate" IS NULL OR "endDate" IS NULL;

-- Initial active state inferred from active semesters
UPDATE "academic_years" ay
SET "isActive" = true
WHERE EXISTS (
  SELECT 1
  FROM "semesters" s
  WHERE s."academicYearId" = ay."id"
    AND s."isActive" = true
);

-- Ensure exactly one active academic year per tenant (keep latest by startDate)
WITH ranked AS (
  SELECT
    "id",
    "tenantId",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId"
      ORDER BY "isActive" DESC, "startDate" DESC, "createdAt" DESC
    ) AS rn
  FROM "academic_years"
)
UPDATE "academic_years" ay
SET "isActive" = CASE WHEN ranked.rn = 1 THEN true ELSE false END
FROM ranked
WHERE ay."id" = ranked."id";
