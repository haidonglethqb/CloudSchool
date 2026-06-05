-- Subject versions define where a subject applies in an academic year.
CREATE TABLE "subject_versions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "versionName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subject_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subject_version_grades" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subjectVersionId" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subject_version_grades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subject_version_classes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subjectVersionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subject_version_classes_pkey" PRIMARY KEY ("id")
);

-- Component sets define the one component configuration for subject + semester.
CREATE TABLE "score_component_sets" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "semesterId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_component_sets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "score_components"
  ADD COLUMN IF NOT EXISTS "scoreComponentSetId" TEXT,
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "scores"
  ADD COLUMN IF NOT EXISTS "subjectVersionId" TEXT;

CREATE UNIQUE INDEX "subject_versions_tenantId_subjectId_academicYearId_key"
  ON "subject_versions"("tenantId", "subjectId", "academicYearId");
CREATE INDEX "subject_versions_tenantId_academicYearId_idx"
  ON "subject_versions"("tenantId", "academicYearId");
CREATE INDEX "subject_versions_tenantId_subjectId_idx"
  ON "subject_versions"("tenantId", "subjectId");

CREATE UNIQUE INDEX "subject_version_grades_subjectVersionId_gradeId_key"
  ON "subject_version_grades"("subjectVersionId", "gradeId");
CREATE INDEX "subject_version_grades_tenantId_gradeId_idx"
  ON "subject_version_grades"("tenantId", "gradeId");

CREATE UNIQUE INDEX "subject_version_classes_subjectVersionId_classId_key"
  ON "subject_version_classes"("subjectVersionId", "classId");
CREATE INDEX "subject_version_classes_tenantId_classId_idx"
  ON "subject_version_classes"("tenantId", "classId");

CREATE UNIQUE INDEX "score_component_sets_tenantId_subjectId_semesterId_key"
  ON "score_component_sets"("tenantId", "subjectId", "semesterId");
CREATE INDEX "score_component_sets_tenantId_semesterId_idx"
  ON "score_component_sets"("tenantId", "semesterId");
CREATE INDEX "score_component_sets_tenantId_subjectId_idx"
  ON "score_component_sets"("tenantId", "subjectId");

-- Backfill subject versions for every existing subject/year.
INSERT INTO "subject_versions" ("id", "tenantId", "subjectId", "academicYearId", "versionName", "isActive", "createdAt", "updatedAt")
SELECT
  'sv_' || md5(s."id" || ':' || ay."id"),
  s."tenantId",
  s."id",
  ay."id",
  s."name" || ' ' || ay."startYear" || '-' || ay."endYear",
  s."isActive",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "subjects" s
JOIN "academic_years" ay ON ay."tenantId" = s."tenantId"
ON CONFLICT ("tenantId", "subjectId", "academicYearId") DO NOTHING;

-- Default backfill applies every subject version to all existing grades.
INSERT INTO "subject_version_grades" ("id", "tenantId", "subjectVersionId", "gradeId", "createdAt")
SELECT
  'svg_' || md5(sv."id" || ':' || g."id"),
  sv."tenantId",
  sv."id",
  g."id",
  CURRENT_TIMESTAMP
FROM "subject_versions" sv
JOIN "grades" g ON g."tenantId" = sv."tenantId"
ON CONFLICT ("subjectVersionId", "gradeId") DO NOTHING;

-- Create one component set for every subject + semester.
INSERT INTO "score_component_sets" ("id", "tenantId", "subjectId", "semesterId", "isActive", "createdAt", "updatedAt")
SELECT
  'scs_' || md5(s."id" || ':' || sem."id"),
  s."tenantId",
  s."id",
  sem."id",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "subjects" s
JOIN "semesters" sem ON sem."tenantId" = s."tenantId"
ON CONFLICT ("tenantId", "subjectId", "semesterId") DO NOTHING;

-- Drop the legacy subject-level uniqueness before duplicating components per semester.
-- Otherwise the same component name for the same subject cannot be copied into
-- multiple subject+semester sets.
DROP INDEX IF EXISTS "score_components_tenantId_subjectId_name_key";

-- Duplicate legacy subject-level components into each subject+semester set.
WITH legacy_components AS (
  SELECT
    sc."id" AS "legacyComponentId",
    sc."tenantId",
    sc."subjectId",
    sc."name",
    sc."weight",
    sc."isActive",
    sc."createdAt",
    sem."id" AS "targetSemesterId",
    scs."id" AS "targetSetId",
    ROW_NUMBER() OVER (
      PARTITION BY sc."tenantId", sc."subjectId", sem."id"
      ORDER BY sc."weight" DESC, sc."name" ASC, sc."id" ASC
    ) AS "displayOrder"
  FROM "score_components" sc
  JOIN "semesters" sem ON sem."tenantId" = sc."tenantId"
  JOIN "score_component_sets" scs
    ON scs."tenantId" = sc."tenantId"
   AND scs."subjectId" = sc."subjectId"
   AND scs."semesterId" = sem."id"
  WHERE sc."scoreComponentSetId" IS NULL
)
INSERT INTO "score_components" (
  "id", "tenantId", "subjectId", "scoreComponentSetId", "name", "weight", "displayOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  'scc_' || md5("legacyComponentId" || ':' || "targetSemesterId"),
  "tenantId",
  "subjectId",
  "targetSetId",
  "name",
  "weight",
  "displayOrder",
  "isActive",
  "createdAt",
  CURRENT_TIMESTAMP
FROM legacy_components
ON CONFLICT ("id") DO NOTHING;

-- Remap existing scores to the duplicated component for their semester.
UPDATE "scores" score
SET "scoreComponentId" = 'scc_' || md5(score."scoreComponentId" || ':' || score."semesterId")
WHERE EXISTS (
  SELECT 1
  FROM "score_components" remapped
  WHERE remapped."id" = 'scc_' || md5(score."scoreComponentId" || ':' || score."semesterId")
);

-- Remove now-unreferenced legacy global components.
DELETE FROM "score_components" sc
WHERE sc."scoreComponentSetId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "scores" score WHERE score."scoreComponentId" = sc."id"
  );

-- Normalize display order for any pre-existing rows attached to a set.
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "scoreComponentSetId"
      ORDER BY "displayOrder" ASC, "weight" DESC, "name" ASC, "id" ASC
    ) AS rn
  FROM "score_components"
  WHERE "scoreComponentSetId" IS NOT NULL
)
UPDATE "score_components" sc
SET "displayOrder" = ordered.rn
FROM ordered
WHERE sc."id" = ordered."id";

CREATE UNIQUE INDEX "score_components_scoreComponentSetId_displayOrder_key"
  ON "score_components"("scoreComponentSetId", "displayOrder");
CREATE INDEX "score_components_tenantId_subjectId_idx"
  ON "score_components"("tenantId", "subjectId");
CREATE INDEX "score_components_tenantId_scoreComponentSetId_idx"
  ON "score_components"("tenantId", "scoreComponentSetId");

-- Backfill score subjectVersionId based on score subject + semester academic year.
UPDATE "scores" score
SET "subjectVersionId" = sv."id"
FROM "semesters" sem
JOIN "subject_versions" sv
  ON sv."tenantId" = sem."tenantId"
 AND sv."academicYearId" = sem."academicYearId"
WHERE score."tenantId" = sem."tenantId"
  AND score."semesterId" = sem."id"
  AND score."subjectId" = sv."subjectId"
  AND score."subjectVersionId" IS NULL;

CREATE INDEX "scores_tenantId_subjectVersionId_idx"
  ON "scores"("tenantId", "subjectVersionId");

ALTER TABLE "subject_versions"
  ADD CONSTRAINT "subject_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "subject_versions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "subject_versions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subject_version_grades"
  ADD CONSTRAINT "subject_version_grades_subjectVersionId_fkey" FOREIGN KEY ("subjectVersionId") REFERENCES "subject_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "subject_version_grades_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subject_version_classes"
  ADD CONSTRAINT "subject_version_classes_subjectVersionId_fkey" FOREIGN KEY ("subjectVersionId") REFERENCES "subject_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "subject_version_classes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "score_component_sets"
  ADD CONSTRAINT "score_component_sets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "score_component_sets_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "score_component_sets_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "score_components"
  ADD CONSTRAINT "score_components_scoreComponentSetId_fkey" FOREIGN KEY ("scoreComponentSetId") REFERENCES "score_component_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scores"
  ADD CONSTRAINT "scores_subjectVersionId_fkey" FOREIGN KEY ("subjectVersionId") REFERENCES "subject_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
