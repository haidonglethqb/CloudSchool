# Scoring Models

> **Source:** `backend/prisma/schema.prisma` | Lines ~310-380

## ScoreComponent

Defines scoring categories within a subject (e.g., "Midterm Exam", "Final Exam", "Homework").

```prisma
model ScoreComponent {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subjectId String
  subject   Subject  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  name      String
  weight    Int
  isActive  Boolean  @default(true)

  @@unique([tenantId, subjectId, name])
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | `String` | Component name (e.g., "15-min test", "Midterm") |
| `weight` | `Int` | Percentage weight toward final grade |

**Unique:** `(tenantId, subjectId, name)` — each subject has uniquely named components.

## Score

Individual score records linking students to components.

```prisma
model Score {
  id               String         @id @default(uuid())
  tenantId         String
  tenant           Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subjectId        String
  subject          Subject        @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  semesterId       String
  semester         Semester       @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  scoreComponentId String
  scoreComponent   ScoreComponent @relation(fields: [scoreComponentId], references: [id], onDelete: Cascade)
  value            Float
  isLocked         Boolean        @default(false)

  @@unique([studentId, subjectId, semesterId, scoreComponentId])
  @@index([tenantId, subjectId, semesterId])
  @@index([studentId, subjectId, semesterId])
  @@index([tenantId, studentId])
}
```

### Indexes

| Index | Fields | Purpose |
|---|---|---|
| `@@unique` | `(studentId, subjectId, semesterId, scoreComponentId)` | One score per student per component |
| `@@index` | `(tenantId, subjectId, semesterId)` | Class/subject report queries |
| `@@index` | `(studentId, subjectId, semesterId)` | Student transcript queries |
| `@@index` | `(tenantId, studentId)` | All scores for a student |

### `isLocked` Flag

When `true`, the score is finalized and cannot be modified. Used after report card generation.

## Promotion

Student pass/fail results per class and semester.

```prisma
model Promotion {
  id         String          @id @default(uuid())
  tenantId   String
  tenant     Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId  String
  student    Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  classId    String
  class      Class           @relation(fields: [classId], references: [id], onDelete: Cascade)
  semesterId String
  semester   Semester        @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  average    Float
  result     PromotionResult
  note       String?

  @@unique([studentId, classId, semesterId])
  @@index([tenantId, studentId, semesterId])
  @@index([classId, semesterId])
}
```

### PromotionResult Enum

```prisma
enum PromotionResult {
  PASS   // Student advances
  FAIL   // Student does not advance
  RETAKE // Student may retake exams
}
```

**Unique:** `(studentId, classId, semesterId)` — one promotion record per student per class per semester.

## Relationships

```mermaid
erDiagram
    Subject ||--o{ ScoreComponent : "defines"
    ScoreComponent ||--o{ Score : "contributes to"
    Student ||--o{ Score : "receives"
    Student ||--o{ Promotion : "receives"
    Semester ||--o{ Score : "recorded in"
    Semester ||--o{ Promotion : "evaluated in"
    Class ||--o{ Promotion : "promotes from"
```

## Related

- [Schema Overview](./schema-overview.md)
- [Academic Structure](./academic-structure.md)
- [Indexes & Performance](./indexes-performance.md)
