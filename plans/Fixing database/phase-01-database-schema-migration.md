# Phase 1: Database Schema Migration

## Priority: P1 - Critical (tất cả phase khác phụ thuộc)
## Status: pending

## Overview

Bổ sung/sửa Prisma schema để hỗ trợ đầy đủ requirement. Thay đổi ít nhất có thể, tận dụng tối đa cấu trúc hiện tại.

## Key Insights

- Hệ thống đã có multi-tenant, Score/ScoreComponent linh hoạt — chỉ cần bổ sung chứ không refactor lại
- `Class.academicYear` hiện là string → cần FK tới AcademicYear
- `Student.classId` trỏ trực tiếp → cần thêm `ClassEnrollment` cho lịch sử theo HK
- `TransferHistory` thiếu context HK/năm → thêm FK
- `TenantSettings` cần thêm nhiều field cấu hình

## Related Code Files

### Files to modify
- `backend/prisma/schema.prisma` — Thêm model + sửa model

## Implementation Steps

### Step 1: Thêm model `AcademicYear`

```prisma
model AcademicYear {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  startYear   Int
  endYear     Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  semesters   Semester[]
  enrollments ClassEnrollment[]

  @@unique([tenantId, startYear, endYear])
  @@map("academic_years")
}
```

### Step 2: Thêm model `ClassEnrollment`

Lưu mối quan hệ HS-Lớp theo HK & Năm học (BM4).

```prisma
model ClassEnrollment {
  id              String       @id @default(uuid())
  tenantId        String
  tenant          Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId       String
  student         Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  classId         String
  class           Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  semesterId      String
  semester        Semester     @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  academicYearId  String
  academicYear    AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  createdAt       DateTime     @default(now())

  @@unique([studentId, semesterId])
  @@index([tenantId, classId, semesterId])
  @@map("class_enrollments")
}
```

### Step 3: Sửa model `Student` — thêm `email`, `admissionDate`

```prisma
// Thêm fields:
email         String?
admissionDate DateTime  @default(now())
```

### Step 4: Sửa model `TenantSettings` — thêm fields cấu hình

```prisma
// Thêm fields:
minGradeLevel  Int     @default(10)
maxGradeLevel  Int     @default(12)
maxSubjects    Int     @default(9)
minScore       Float   @default(0)
maxScore       Float   @default(10)
maxSemesters   Int     @default(2)
maxRetentions  Int     @default(3)
```

### Step 5: Sửa model `Semester` — thêm FK `academicYearId`

```prisma
// Thêm field:
academicYearId String?
academicYear   AcademicYear? @relation(fields: [academicYearId], references: [id])
```

### Step 6: Sửa model `TransferHistory` — thêm FK `semesterId`, `academicYearId`

```prisma
// Thêm fields:
semesterId     String?
academicYearId String?
```

### Step 7: Cập nhật relations trên `Tenant`

Thêm `academicYears` và `classEnrollments` vào Tenant.

### Step 8: Chạy migration

```bash
npx prisma migrate dev --name add-academic-year-enrollment-settings
```

## Todo List

- [ ] Thêm model AcademicYear
- [ ] Thêm model ClassEnrollment
- [ ] Sửa Student: thêm email, admissionDate
- [ ] Sửa TenantSettings: thêm 7 fields cấu hình
- [ ] Sửa Semester: thêm academicYearId FK
- [ ] Sửa TransferHistory: thêm semesterId
- [ ] Cập nhật Tenant relations
- [ ] Cập nhật Class relations (enrollments)
- [ ] Chạy migration thành công
- [ ] Cập nhật seed.js nếu cần

## Success Criteria

- Migration chạy thành công không lỗi
- Prisma generate ra client mới
- Các model cũ không bị break
- Seed data hoạt động

## Risk Assessment

- **Migration trên DB có data**: Tất cả field mới đều nullable hoặc có default → an toàn
- **FK mới nullable**: `academicYearId` trên Semester và TransferHistory là optional → backward compatible
