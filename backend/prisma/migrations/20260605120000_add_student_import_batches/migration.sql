CREATE TYPE "StudentImportBatchStatus" AS ENUM ('DRAFT', 'COMPLETED', 'COMPLETED_WITH_ERRORS');
CREATE TYPE "StudentImportRowStatus" AS ENUM ('VALID', 'INVALID', 'IMPORTED');

CREATE TABLE "student_import_batches" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "importedBy" TEXT,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "createdRows" INTEGER NOT NULL DEFAULT 0,
  "status" "StudentImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_import_rows" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "fullName" TEXT,
  "gender" "Gender",
  "dateOfBirth" TIMESTAMP(3),
  "address" TEXT,
  "classId" TEXT,
  "studentId" TEXT,
  "status" "StudentImportRowStatus" NOT NULL DEFAULT 'INVALID',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_import_batches_tenantId_createdAt_idx" ON "student_import_batches"("tenantId", "createdAt");
CREATE INDEX "student_import_rows_tenantId_batchId_idx" ON "student_import_rows"("tenantId", "batchId");
CREATE INDEX "student_import_rows_tenantId_status_idx" ON "student_import_rows"("tenantId", "status");

ALTER TABLE "student_import_batches"
  ADD CONSTRAINT "student_import_batches_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_import_rows"
  ADD CONSTRAINT "student_import_rows_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "student_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
