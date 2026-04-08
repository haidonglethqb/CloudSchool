# Fee Management Models

> **Source:** `backend/prisma/schema.prisma` | Lines ~420-460

## Fee

Defines fee types with optional scope (grade, class, semester).

```prisma
model Fee {
  id          String      @id @default(uuid())
  tenantId    String
  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  description String?
  amount      Float
  category    FeeCategory @default(TUITION)
  isRequired  Boolean     @default(true)
  dueDate     DateTime?
  isActive    Boolean     @default(true)
  gradeId     String?
  grade       Grade?      @relation(fields: [gradeId], references: [id])
  classId     String?
  class       Class?      @relation(fields: [classId], references: [id])
  semesterId  String?
  semester    Semester?   @relation(fields: [semesterId], references: [id])

  @@index([tenantId, isActive])
  @@index([tenantId, gradeId])
  @@index([tenantId, classId])
}
```

| Field | Type | Notes |
|---|---|---|
| `category` | `FeeCategory` | Type classification |
| `isRequired` | `Boolean` | Mandatory vs optional fee |
| `dueDate` | `DateTime?` | Payment deadline |
| `gradeId` | `String?` | Nullable — applies to all grades if null |
| `classId` | `String?` | Nullable — applies to all classes if null |
| `semesterId` | `String?` | Nullable — recurring fee if null |

### FeeCategory Enum

```prisma
enum FeeCategory {
  TUITION    // Regular tuition fees
  ACTIVITY   // Extracurricular activities
  FACILITY   // Facility usage fees
  OTHER      // Miscellaneous fees
}
```

## StudentFee

Per-student fee assignment and payment tracking.

```prisma
model StudentFee {
  id         String        @id @default(uuid())
  tenantId   String
  tenant     Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  feeId      String
  fee        Fee           @relation(fields: [feeId], references: [id], onDelete: Cascade)
  studentId  String
  student    Student       @relation(fields: [studentId], references: [id], onDelete: Cascade)
  amount     Float
  paidAmount Float         @default(0)
  status     PaymentStatus @default(PENDING)
  paidAt     DateTime?
  note       String?

  @@unique([feeId, studentId])
  @@index([tenantId, studentId])
  @@index([tenantId, status])
  @@index([feeId, tenantId])
}
```

| Field | Type | Notes |
|---|---|---|
| `amount` | `Float` | Amount owed (may differ from fee.amount) |
| `paidAmount` | `Float` | Amount paid so far |
| `status` | `PaymentStatus` | Current payment state |
| `paidAt` | `DateTime?` | Timestamp when fully paid |

### PaymentStatus Enum

```prisma
enum PaymentStatus {
  PENDING  // Not yet paid
  PAID     // Fully paid
  PARTIAL  // Partially paid
  OVERDUE  // Past due date
  EXEMPT   // Waived
}
```

### Status Logic

```
status =
  EXEMPT    → explicitly exempted
  PAID      → paidAmount >= amount
  PARTIAL   → 0 < paidAmount < amount
  PENDING   → paidAmount == 0, not overdue
  OVERDUE   → paidAmount < amount, past dueDate
```

## Indexes

| Index | Fields | Purpose |
|---|---|---|
| `@@unique` | `(feeId, studentId)` | One fee assignment per student |
| `@@index` | `(tenantId, studentId)` | All fees for a student |
| `@@index` | `(tenantId, status)` | Status dashboard (overdue, unpaid) |
| `@@index` | `(feeId, tenantId)` | Fee collection summary |

## Relationships

```mermaid
erDiagram
    Tenant ||--o{ Fee : "defines"
    Fee ||--o{ StudentFee : "assigned to"
    Student ||--o{ StudentFee : "owes"
    Grade ||--o{ Fee : "applies to"
    Class ||--o{ Fee : "applies to"
    Semester ||--o{ Fee : "applies to"
```

## Related

- [Schema Overview](./schema-overview.md)
- [Tracking Models](./tracking-models.md)
- [Indexes & Performance](./indexes-performance.md)
