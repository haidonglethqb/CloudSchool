-- Migration: Add AcademicYear relation to Class and isActive to ScoreComponent
-- This migration is SAFE - it only ADDs columns, never drops or modifies existing data.
-- Safe to run on production with existing data.

-- 1. Add academicYearId column to Class table (nullable, safe for existing rows)
ALTER TABLE "classes" ADD COLUMN     "academicYearId" TEXT;

-- 2. Add foreign key constraint (will not affect existing rows since column is nullable)
ALTER TABLE "classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Add isActive column to ScoreComponent table (non-nullable with default=true, safe - PostgreSQL fills existing rows with true)
ALTER TABLE "score_components" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
