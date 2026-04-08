# Database Schema Overview

> **Source:** `backend/prisma/schema.prisma` | **Database:** PostgreSQL | **ORM:** Prisma

## ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    SubscriptionPlan ||--o{ Tenant : "has"
    Tenant ||--o{ User : "has"
    Tenant ||--o| TenantSettings : "has"
    Tenant ||--o{ Student : "has"
    Tenant ||--o{ Class : "has"
    Tenant ||--o{ Grade : "has"
    Tenant ||--o{ Subject : "has"
    Tenant ||--o{ Semester : "has"
    Tenant ||--o{ Score : "has"
    Tenant ||--o{ ScoreComponent : "has"
    Tenant ||--o{ Promotion : "has"
    Tenant ||--o{ TeacherAssignment : "has"
    Tenant ||--o{ ActivityLog : "has"
    Tenant ||--o{ TransferHistory : "has"
    Tenant ||--o{ Fee : "has"
    Tenant ||--o{ StudentFee : "has"
    Tenant ||--o{ AcademicYear : "has"
    Tenant ||--o{ ClassEnrollment : "has"
    User ||--o{ ParentStudent : "is parent of"
    User ||--o{ TeacherAssignment : "teaches"
    User ||--o| Student : "linked profile"
    Student ||--o{ Score : "receives"
    Student ||--o{ ParentStudent : "has parents"
    Student ||--o{ Promotion : "receives"
    Student ||--o{ TransferHistory : "has history"
    Student ||--o{ StudentFee : "owes"
    Student ||--o{ ClassEnrollment : "enrolls in"
    Grade ||--o{ Class : "contains"
    Grade ||--o{ Fee : "applies to"
    Class ||--o{ Student : "enrolls"
    Class ||--o{ TeacherAssignment : "has assignments"
    Class ||--o{ Promotion : "promotes from"
    Class ||--o{ TransferHistory : "transfer from/to"
    Class ||--o{ Fee : "applies to"
    Class ||--o{ ClassEnrollment : "has enrollments"
    AcademicYear ||--o{ Semester : "contains"
    AcademicYear ||--o{ ClassEnrollment : "spans"
    AcademicYear ||--o{ Class : "organizes"
    Semester ||--o{ Score : "recorded in"
    Semester ||--o{ Promotion : "evaluated in"
    Semester ||--o{ Fee : "applies to"
    Semester ||--o{ ClassEnrollment : "spans"
    Subject ||--o{ Score : "scored in"
    Subject ||--o{ ScoreComponent : "defines"
    Subject ||--o{ TeacherAssignment : "assigned to"
    ScoreComponent ||--o{ Score : "contributes to"
    Fee ||--o{ StudentFee : "assigned to"
    ParentStudent }o--|| Student : "links"
```

## Models Summary (21 Models)

| Category | Model | Description |
|---|---|---|
| **Platform** | `SubscriptionPlan` | SaaS plan tiers with limits |
| **Platform** | `Tenant` | School organization instance |
| **Platform** | `TenantSettings` | Per-school configurable settings |
| **Users** | `User` | Authentication & role management |
| **Users** | `Student` | Student profiles & demographics |
| **Users** | `ParentStudent` | Parent-student relationships |
| **Academic** | `Grade` | Grade levels (10, 11, 12) |
| **Academic** | `Class` | Class groups within grades |
| **Academic** | `Subject` | Academic subjects |
| **Academic** | `Semester` | Academic terms |
| **Academic** | `AcademicYear` | Year ranges (e.g., 2024-2025) |
| **Academic** | `ClassEnrollment` | Student-class-semester linkage |
| **Academic** | `TeacherAssignment` | Teacher-class-subject mapping |
| **Scoring** | `ScoreComponent` | Scoring categories (exam, quiz) |
| **Scoring** | `Score` | Individual score records |
| **Scoring** | `Promotion` | Pass/fail results per semester |
| **Fees** | `Fee` | Fee definitions by category |
| **Fees** | `StudentFee` | Per-student fee tracking |
| **Tracking** | `ActivityLog` | Audit trail for all actions |
| **Tracking** | `TransferHistory` | Student class change records |

## Enums (7)

| Enum | Values |
|---|---|
| `UserRole` | `PLATFORM_ADMIN`, `SUPER_ADMIN`, `STAFF`, `TEACHER`, `STUDENT`, `PARENT` |
| `Gender` | `MALE`, `FEMALE`, `OTHER` |
| `TenantStatus` | `ACTIVE`, `SUSPENDED`, `INACTIVE` |
| `PromotionResult` | `PASS`, `FAIL`, `RETAKE` |
| `FeeCategory` | `TUITION`, `ACTIVITY`, `FACILITY`, `OTHER` |
| `PaymentStatus` | `PENDING`, `PAID`, `PARTIAL`, `OVERDUE`, `EXEMPT` |

## Key Constraints

- All models use `onDelete: Cascade` for parent-child cleanup
- Multi-tenant isolation via `tenantId` foreign keys on every model
- Table names mapped via `@@map` (snake_case convention)

## Related

- [Platform Models](./platform-models.md)
- [User Models](./user-models.md)
- [Academic Structure](./academic-structure.md)
- [Scoring Models](./scoring-models.md)
- [Fee Models](./fee-models.md)
- [Tracking Models](./tracking-models.md)
- [Indexes & Performance](./indexes-performance.md)
