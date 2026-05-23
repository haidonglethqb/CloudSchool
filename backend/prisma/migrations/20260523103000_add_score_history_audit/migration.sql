CREATE TABLE IF NOT EXISTS "score_histories" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scoreId" TEXT,
  "studentId" TEXT NOT NULL,
  "studentCode" TEXT,
  "studentName" TEXT NOT NULL,
  "classId" TEXT,
  "className" TEXT,
  "subjectId" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "semesterId" TEXT NOT NULL,
  "semesterName" TEXT NOT NULL,
  "scoreComponentId" TEXT NOT NULL,
  "scoreComponentName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" DOUBLE PRECISION,
  "newValue" DOUBLE PRECISION,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_histories_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'score_histories_tenantId_fkey'
      AND table_name = 'score_histories'
  ) THEN
    ALTER TABLE "score_histories"
    ADD CONSTRAINT "score_histories_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "score_histories_tenantId_classId_subjectId_semesterId_idx"
ON "score_histories"("tenantId", "classId", "subjectId", "semesterId");

CREATE INDEX IF NOT EXISTS "score_histories_tenantId_studentId_semesterId_idx"
ON "score_histories"("tenantId", "studentId", "semesterId");

CREATE INDEX IF NOT EXISTS "score_histories_tenantId_scoreComponentId_createdAt_idx"
ON "score_histories"("tenantId", "scoreComponentId", "createdAt");