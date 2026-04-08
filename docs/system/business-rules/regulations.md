# School Regulations (QD1-QD6)

> Configurable business rules stored in `TenantSettings`, cached via LRU (max 100 entries, 5-min TTL).

## Regulation Definitions

| ID | Name | Config | Default | Mutability |
|----|------|--------|---------|------------|
| QD1 | Student Age Range | `minAge` / `maxAge` | 15–20 | Configurable |
| QD2 | Max Class Size | `maxClassSize` | 40 | Configurable |
| QD3 | Grade Levels | `minGradeLevel` / `maxGradeLevel` | 10–12 | Via Grades CRUD |
| QD4 | Score Scale | `minScore` / `maxScore` | 0–10 | **Fixed** |
| QD5 | Passing Score | `passScore` | 5.0 | Configurable, must be ∈ [minScore, maxScore] |
| QD6 | Score Components | `scoreComponents` (JSON, weights sum ≤ 100%) | — | Validated on create/update |

### Additional Settings

| Key | Default | Description |
|-----|---------|-------------|
| `maxSubjects` | 9 | Max subjects per class |
| `maxSemesters` | 2 | Max semesters per academic year |
| `maxRetentions` | 3 | Max times a student can be retained |

## TenantSettings Schema

```prisma
// backend/prisma/schema.prisma
model TenantSettings {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  minAge           Int      @default(15)
  maxAge           Int      @default(20)
  maxClassSize     Int      @default(40)
  minGradeLevel    Int      @default(10)
  maxGradeLevel    Int      @default(12)
  minScore         Float    @default(0)
  maxScore         Float    @default(10)
  passScore        Float    @default(5)
  scoreComponents  Json?    // [{subjectId, components: [{name, weight}]}]
  maxSubjects      Int      @default(9)
  maxSemesters     Int      @default(2)
  maxRetentions    Int      @default(3)
}
```

## Regulation Flow

```mermaid
flowchart LR
  A[Request] --> B{Settings in LRU cache?}
  B -->|Yes| C[Return cached]
  B -->|No| D[Query TenantSettings by tenantId]
  D --> E[Cache result (5 min TTL)]
  E --> C
  C --> F[Apply regulation check]
  F --> G{Pass?}
  G -->|Yes| H[Proceed]
  G -->|No| I[Reject 400]
```

## Enforcement Points

- **QD1**: `POST /students` — validate `birthYear` → `currentYear - birthYear ∈ [minAge, maxAge]`
- **QD2**: `POST /students/:id/enroll` — count existing students, reject if `≥ maxClassSize`
- **QD3**: Grade CRUD — enforce `minGradeLevel ≤ level ≤ maxGradeLevel`
- **QD5**: Promotion calculation — compare `averageScore ≥ passScore`
- **QD6**: `POST /scores/batch` — validate `Σ weights ≤ 100` per subject on create/update

## Related

- [Input & Business Logic Validations](../business-rules/validations.md)
- [Input Validation & Sanitization](../security/input-validation.md)
- [Business Logic Protections](../security/business-logic-protections.md)
- `backend/src/routes/settings.routes.js`
- `backend/prisma/schema.prisma` (TenantSettings)
