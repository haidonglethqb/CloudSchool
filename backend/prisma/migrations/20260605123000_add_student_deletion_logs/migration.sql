CREATE TABLE "student_deletion_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studentCode" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "gender" "Gender" NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "email" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "parentName" TEXT,
  "parentPhone" TEXT,
  "classId" TEXT,
  "className" TEXT,
  "gradeName" TEXT,
  "deletedBy" TEXT,
  "deletedByName" TEXT,
  "deletedByRole" TEXT,
  "reason" TEXT,
  "restoredAt" TIMESTAMP(3),
  "restoredBy" TEXT,
  "restoredByName" TEXT,
  "terminatedAt" TIMESTAMP(3),
  "terminatedBy" TEXT,
  "terminatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "student_deletion_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_deletion_logs_tenantId_classId_createdAt_idx"
  ON "student_deletion_logs"("tenantId", "classId", "createdAt");

CREATE INDEX "student_deletion_logs_tenantId_studentId_idx"
  ON "student_deletion_logs"("tenantId", "studentId");

ALTER TABLE "student_deletion_logs"
  ADD CONSTRAINT "student_deletion_logs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
