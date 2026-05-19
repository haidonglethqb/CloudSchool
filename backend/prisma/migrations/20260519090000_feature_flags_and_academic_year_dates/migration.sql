-- Legacy-safe: ensure required columns exist for databases that were previously
-- managed by db push / partially baselined migrations.
ALTER TABLE "tenant_settings"
ADD COLUMN IF NOT EXISTS "enabledModules" JSONB;

ALTER TABLE "academic_years"
ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);

ALTER TABLE "academic_years"
ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

ALTER TABLE "academic_years"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN;

UPDATE "academic_years"
SET "isActive" = false
WHERE "isActive" IS NULL;

ALTER TABLE "academic_years"
ALTER COLUMN "isActive" SET DEFAULT false;

ALTER TABLE "academic_years"
ALTER COLUMN "isActive" SET NOT NULL;

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
