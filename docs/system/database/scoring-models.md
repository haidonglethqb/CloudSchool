# Scoring Models

> **Source:** `backend/prisma/schema.prisma` | Lines ~310-380

## ScoreComponentSet

Defines the single component configuration for a subject in a semester.

```prisma
model ScoreComponentSet {
  id         String
  tenantId   String
  subjectId  String
  semesterId String
  isActive   Boolean

  @@unique([tenantId, subjectId, semesterId])
}
```

Every class learning the subject in that semester uses this set.

## ScoreComponent

Defines scoring categories inside a `ScoreComponentSet`.

```prisma
model ScoreComponent {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subjectId String   // compatibility/report denormalization
  subject   Subject  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  scoreComponentSetId String?
  name      String
  weight    Int
  displayOrder Int
  isActive  Boolean  @default(true)

  @@unique([scoreComponentSetId, displayOrder])
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | `String` | Display label (e.g., "15 phút lần 1") |
| `weight` | `Int` | Percentage weight toward final grade |
| `displayOrder` | `Int` | Stable order inside the set |

**Unique:** `(scoreComponentSetId, displayOrder)` — labels may repeat across semesters.

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
  subjectVersionId String?
  semesterId       String
  semester         Semester       @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  scoreComponentId String
  scoreComponent   ScoreComponent @relation(fields: [scoreComponentId], references: [id], onDelete: Cascade)
  value            Float
  isLocked         Boolean        @default(false)

  @@unique([studentId, subjectId, semesterId, scoreComponentId])
  @@index([tenantId, subjectId, semesterId])
  @@index([tenantId, subjectVersionId])
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

## ScoreHistory

Immutable audit snapshots for score entry, edits, locks, unlocks, and deletions.

```prisma
model ScoreHistory {
  id                 String   @id @default(uuid())
  tenantId           String
  scoreId            String?
  studentId          String
  studentCode        String?
  studentName        String
  classId            String?
  className          String?
  subjectId          String
  subjectName        String
  semesterId         String
  semesterName       String
  scoreComponentId   String
  scoreComponentName String
  action             String
  oldValue           Float?
  newValue           Float?
  actorId            String?
  actorName          String
  actorRole          String
  createdAt          DateTime @default(now())
}
```

### Purpose

- Keeps an immutable timeline for `CREATE`, `UPDATE`, `LOCK`, `UNLOCK`, and `DELETE` score actions.
- Stores denormalized snapshots so the audit feed still renders after later renames or deletions.
- Supports the score-entry history panel filtered by class, subject, semester, and score component.

### Indexes

| Index | Fields | Purpose |
|---|---|---|
| `@@index` | `(tenantId, classId, subjectId, semesterId, createdAt)` | Main score-entry history feed |
| `@@index` | `(tenantId, studentId, semesterId, createdAt)` | Student-specific audit lookup |
| `@@index` | `(tenantId, scoreComponentId, createdAt)` | Component-level investigation |

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
  RETAKE // Legacy/report compatibility
}
```

**Unique:** `(studentId, classId, semesterId)` — one promotion record per student per class per semester.

## Relationships

```mermaid
erDiagram
    Subject ||--o{ ScoreComponentSet : "has"
    ScoreComponentSet ||--o{ ScoreComponent : "defines"
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
