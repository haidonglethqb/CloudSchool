# Academic Structure Models

> **Source:** `backend/prisma/schema.prisma` | Lines ~180-310

## Grade

Represents grade levels (e.g., Grade 10, 11, 12).

```prisma
model Grade {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String
  level     Int
  classes   Class[]
  fees      Fee[]

  @@unique([tenantId, level])
  @@index([tenantId])
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | `String` | Display name (e.g., "Grade 10") |
| `level` | `Int` | Numeric level (10, 11, 12) |

**Unique:** `(tenantId, level)` — one grade level per tenant.

## Class

Class groups within grades, organized by academic year.

```prisma
model Class {
  id             String   @id @default(uuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gradeId        String
  grade          Grade    @relation(fields: [gradeId], references: [id], onDelete: Cascade)
  name           String
  academicYear   String   @default("2024-2025")
  academicYearId String?
  academicYearRef AcademicYear? @relation(fields: [academicYearId], references: [id])
  capacity       Int      @default(40)
  isActive       Boolean  @default(true)

  @@unique([tenantId, name, academicYear])
  @@index([tenantId, gradeId])
  @@index([tenantId, isActive])
}
```

**Unique:** `(tenantId, name, academicYear)` — prevents duplicate class names per year.

## Subject

Academic subjects with soft delete support.

```prisma
model Subject {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  code        String
  description String?
  isActive    Boolean  @default(true)

  @@unique([tenantId, code])
}
```

**Soft delete:** Set `isActive = false` instead of deleting (preserves score history).

## Semester

Academic terms within a year.

```prisma
model Semester {
  id             String    @id @default(uuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name           String
  year           String
  semesterNum    Int
  startDate      DateTime?
  endDate        DateTime?
  isActive       Boolean   @default(true)
  academicYearId String?
  academicYear   AcademicYear? @relation(fields: [academicYearId], references: [id])

  @@unique([tenantId, year, semesterNum])
}
```

## AcademicYear

Defines academic year ranges.

```prisma
model AcademicYear {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  startYear Int
  endYear   Int

  @@unique([tenantId, startYear, endYear])
}
```

## ClassEnrollment

Links students to classes for specific semesters and academic years.

```prisma
model ClassEnrollment {
  id             String       @id @default(uuid())
  tenantId       String
  studentId      String
  student        Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  classId        String
  class          Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  semesterId     String
  semester       Semester     @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)

  @@unique([studentId, semesterId])
  @@index([tenantId, classId, semesterId])
}
```

## TeacherAssignment

Maps teachers to class-subject combinations.

```prisma
model TeacherAssignment {
  id         String   @id @default(uuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  teacherId  String
  teacher    User     @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  classId    String
  class      Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
  subjectId  String
  subject    Subject  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  isHomeroom Boolean  @default(false)

  @@unique([teacherId, classId, subjectId])
  @@index([tenantId, teacherId])
  @@index([classId, tenantId])
}
```

**Unique:** `(teacherId, classId, subjectId)` — a teacher teaches one subject to one class only.

## Relationships

```mermaid
erDiagram
    AcademicYear ||--o{ Semester : "contains"
    AcademicYear ||--o{ Class : "organizes"
    AcademicYear ||--o{ ClassEnrollment : "spans"
    Grade ||--o{ Class : "contains"
    Class ||--o{ ClassEnrollment : "has"
    Class ||--o{ TeacherAssignment : "has"
    Semester ||--o{ ClassEnrollment : "spans"
    Subject ||--o{ TeacherAssignment : "assigned to"
    Student ||--o{ ClassEnrollment : "enrolls in"
    User ||--o{ TeacherAssignment : "teaches"
```

## Related

- [Schema Overview](./schema-overview.md)
- [User Models](./user-models.md)
- [Scoring Models](./scoring-models.md)
- [Indexes & Performance](./indexes-performance.md)
