# Tracking and History Models

> **Source:** `backend/prisma/schema.prisma` | Lines ~380-420

## ActivityLog

Audit trail for all system actions.

```prisma
model ActivityLog {
  id        String   @id @default(uuid())
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId    String?
  action    String
  entity    String
  entityId  String?
  details   String?
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

| Field | Type | Notes |
|---|---|---|
| `userId` | `String?` | Actor (nullable for system events) |
| `action` | `String` | Action verb (e.g., "CREATE", "UPDATE", "DELETE") |
| `entity` | `String` | Entity type (e.g., "Student", "Score") |
| `entityId` | `String?` | Affected record ID |
| `details` | `String?` | JSON payload of changes |
| `ipAddress` | `String?` | Request source IP |

### Index: `(tenantId, createdAt)`

Optimizes time-range queries: "show all actions in tenant X between date A and B". Supports descending chronological order (most recent first).

**Usage pattern:**
```ts
// Recent activity for tenant
prisma.activityLog.findMany({
  where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
  orderBy: { createdAt: 'desc' },
  take: 50
})
```

## TransferHistory

Records student class changes with full audit trail.

```prisma
model TransferHistory {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId     String
  student       Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  fromClassId   String
  fromClass     Class    @relation("TransferFrom", fields: [fromClassId], references: [id], onDelete: Cascade)
  toClassId     String
  toClass       Class    @relation("TransferTo", fields: [toClassId], references: [id], onDelete: Cascade)
  semesterId    String?
  semester      Semester? @relation(fields: [semesterId], references: [id])
  reason        String?
  transferredBy String?
  createdAt     DateTime @default(now())

  @@index([tenantId, studentId])
  @@index([semesterId, tenantId])
}
```

| Field | Type | Notes |
|---|---|---|
| `fromClassId` | `String` | Source class |
| `toClassId` | `String` | Destination class |
| `semesterId` | `String?` | When transfer occurred |
| `reason` | `String?` | Justification for transfer |
| `transferredBy` | `String?` | User ID who authorized transfer |

### Self-Referential Class Relations

`TransferHistory` references `Class` twice via named relations:

```prisma
fromClass  Class @relation("TransferFrom", fields: [fromClassId], references: [id])
toClass    Class @relation("TransferTo",   fields: [toClassId],   references: [id])
```

Corresponding inverse relations in `Class`:

```prisma
transfersFrom  TransferHistory[] @relation("TransferFrom")
transfersTo    TransferHistory[] @relation("TransferTo")
```

### Indexes

| Index | Fields | Purpose |
|---|---|---|
| `@@index` | `(tenantId, studentId)` | All transfers for a student |
| `@@index` | `(semesterId, tenantId)` | Transfers within a semester |

## Relationships

```mermaid
erDiagram
    Tenant ||--o{ ActivityLog : "logs"
    Tenant ||--o{ TransferHistory : "records"
    Student ||--o{ TransferHistory : "has history"
    Class ||--o{ TransferHistory : "transfer from" : "TransferFrom"
    Class ||--o{ TransferHistory : "transfer to" : "TransferTo"
    Semester ||--o{ TransferHistory : "occurs in"
```

## Related

- [Schema Overview](./schema-overview.md)
- [Academic Structure](./academic-structure.md)
- [Indexes & Performance](./indexes-performance.md)
