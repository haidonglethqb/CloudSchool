ALTER TABLE "students"
ADD COLUMN IF NOT EXISTS "inactiveReason" TEXT,
ADD COLUMN IF NOT EXISTS "inactiveAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "inactivatedBy" TEXT,
ADD COLUMN IF NOT EXISTS "inactivatedByName" TEXT;

CREATE TABLE IF NOT EXISTS "promotion_placement_histories" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "promotionId" TEXT,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "action" TEXT NOT NULL,
  "fromClassId" TEXT,
  "toClassId" TEXT,
  "reason" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_placement_histories_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'promotion_placement_histories_tenantId_fkey'
      AND table_name = 'promotion_placement_histories'
  ) THEN
    ALTER TABLE "promotion_placement_histories"
    ADD CONSTRAINT "promotion_placement_histories_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'promotion_placement_histories_promotionId_fkey'
      AND table_name = 'promotion_placement_histories'
  ) THEN
    ALTER TABLE "promotion_placement_histories"
    ADD CONSTRAINT "promotion_placement_histories_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'promotion_placement_histories_studentId_fkey'
      AND table_name = 'promotion_placement_histories'
  ) THEN
    ALTER TABLE "promotion_placement_histories"
    ADD CONSTRAINT "promotion_placement_histories_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'promotion_placement_histories_fromClassId_fkey'
      AND table_name = 'promotion_placement_histories'
  ) THEN
    ALTER TABLE "promotion_placement_histories"
    ADD CONSTRAINT "promotion_placement_histories_fromClassId_fkey"
    FOREIGN KEY ("fromClassId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'promotion_placement_histories_toClassId_fkey'
      AND table_name = 'promotion_placement_histories'
  ) THEN
    ALTER TABLE "promotion_placement_histories"
    ADD CONSTRAINT "promotion_placement_histories_toClassId_fkey"
    FOREIGN KEY ("toClassId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "promotion_placement_histories_tenantId_studentId_createdAt_idx"
ON "promotion_placement_histories"("tenantId", "studentId", "createdAt");

CREATE INDEX IF NOT EXISTS "promotion_placement_histories_tenantId_academicYearId_action_idx"
ON "promotion_placement_histories"("tenantId", "academicYearId", "action");

CREATE INDEX IF NOT EXISTS "promotion_placement_histories_tenantId_promotionId_idx"
ON "promotion_placement_histories"("tenantId", "promotionId");
