ALTER TABLE "teacher_assignments"
  ADD COLUMN IF NOT EXISTS "semesterId" TEXT;

DROP INDEX IF EXISTS "teacher_assignments_teacherId_classId_subjectId_key";
DROP INDEX IF EXISTS "teacher_assignments_tenantId_teacherId_idx";

WITH matched_semesters AS (
  SELECT
    ta."id" AS "assignmentId",
    sem."id" AS "semesterId",
    ROW_NUMBER() OVER (
      PARTITION BY ta."id"
      ORDER BY sem."semesterNum" ASC, sem."startDate" ASC, sem."createdAt" ASC
    ) AS rn
  FROM "teacher_assignments" ta
  JOIN "classes" cls ON cls."id" = ta."classId"
  JOIN "semesters" sem
    ON sem."tenantId" = ta."tenantId"
   AND (
     (cls."academicYearId" IS NOT NULL AND sem."academicYearId" = cls."academicYearId")
     OR
     (cls."academicYearId" IS NULL AND sem."year" = cls."academicYear")
   )
)
UPDATE "teacher_assignments" ta
SET "semesterId" = ms."semesterId"
FROM matched_semesters ms
WHERE ta."id" = ms."assignmentId"
  AND ms.rn = 1
  AND ta."semesterId" IS NULL;

WITH matched_semesters AS (
  SELECT
    ta."id" AS "assignmentId",
    sem."id" AS "semesterId",
    ROW_NUMBER() OVER (
      PARTITION BY ta."id"
      ORDER BY sem."semesterNum" ASC, sem."startDate" ASC, sem."createdAt" ASC
    ) AS rn
  FROM "teacher_assignments" ta
  JOIN "classes" cls ON cls."id" = ta."classId"
  JOIN "semesters" sem
    ON sem."tenantId" = ta."tenantId"
   AND (
     (cls."academicYearId" IS NOT NULL AND sem."academicYearId" = cls."academicYearId")
     OR
     (cls."academicYearId" IS NULL AND sem."year" = cls."academicYear")
   )
)
INSERT INTO "teacher_assignments" (
  "id",
  "tenantId",
  "teacherId",
  "classId",
  "semesterId",
  "subjectId",
  "isHomeroom",
  "createdAt",
  "updatedAt"
)
SELECT
  'ta_' || md5(ta."id" || ':' || ms."semesterId"),
  ta."tenantId",
  ta."teacherId",
  ta."classId",
  ms."semesterId",
  ta."subjectId",
  ta."isHomeroom",
  ta."createdAt",
  ta."updatedAt"
FROM "teacher_assignments" ta
JOIN matched_semesters ms ON ms."assignmentId" = ta."id"
WHERE ms.rn > 1
ON CONFLICT ("id") DO NOTHING;

UPDATE "teacher_assignments" ta
SET "semesterId" = fallback."semesterId"
FROM (
  SELECT DISTINCT ON (tenant."tenantId")
    tenant."tenantId",
    sem."id" AS "semesterId"
  FROM "teacher_assignments" tenant
  JOIN "semesters" sem ON sem."tenantId" = tenant."tenantId"
  ORDER BY tenant."tenantId", sem."isActive" DESC, sem."year" DESC, sem."semesterNum" ASC
) fallback
WHERE ta."tenantId" = fallback."tenantId"
  AND ta."semesterId" IS NULL;

ALTER TABLE "teacher_assignments"
  ALTER COLUMN "semesterId" SET NOT NULL;

CREATE UNIQUE INDEX "teacher_assignments_teacherId_classId_subjectId_semesterId_key"
  ON "teacher_assignments"("teacherId", "classId", "subjectId", "semesterId");

CREATE INDEX "teacher_assignments_tenantId_teacherId_semesterId_idx"
  ON "teacher_assignments"("tenantId", "teacherId", "semesterId");

CREATE INDEX "teacher_assignments_semesterId_tenantId_idx"
  ON "teacher_assignments"("semesterId", "tenantId");

ALTER TABLE "teacher_assignments"
  ADD CONSTRAINT "teacher_assignments_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
