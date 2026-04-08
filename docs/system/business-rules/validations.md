# Input & Business Logic Validations

> Defense-in-depth: express-validator (backend), Zod (frontend), Prisma (compile-time).

## Validation Layers

```mermaid
flowchart LR
  A[Client Request] --> B[express-validator]
  B --> C{Valid?}
  C -->|No| D[400 + error details]
  C -->|Yes| E[Business Logic Checks]
  E --> F{Pass?}
  F -->|No| D
  F -->|Yes| G[Prisma Query (type-safe)]
  G --> H[Response]

  I[Frontend Form] --> J[Zod Schema]
  J --> K{Valid?}
  K -->|No| L[Inline error]
  K -->|Yes| M[Submit API]
```

## express-validator Chains (Backend)

All routes use `express-validator` chains:

```js
// backend/src/routes/student.routes.js
[
  check("fullName").trim().isLength({ min: 2, max: 100 }),
  check("email").isEmail().normalizeEmail(),
  check("birthYear").isInt({ min: 1900, max: new Date().getFullYear() }),
  check("classId").isString().notEmpty(),
]
```

## Business Validations

| Check | Rule | Where |
|-------|------|-------|
| **Age** | `currentYear - birthYear ∈ [minAge, maxAge]` | `POST /students` |
| **Class capacity** | `count(students) < maxClassSize` or `< class.capacity` | Enroll, capacity update |
| **Score range** | `0 ≤ value ≤ 10` | `POST /scores/*` |
| **Score lock** | `isLocked === true` → block modify/delete | `PUT/DELETE /scores/*` |
| **Weight sum** | `Σ component weights ≤ 100` per subject | Score component CRUD |
| **Student delete guard** | Block if has promotions, fees, transfers, parent links, enrollments, or scores | `DELETE /students/:id` |
| **Fee delete guard** | Block if fee has student payment records | `DELETE /fees/:id` |
| **Capacity guard** | Cannot reduce `capacity < current student count` | `PUT /classes/:id` |
| **Academic year overlap** | No overlapping `[startDate, endDate]` ranges | `POST/PUT /academic-years` |
| **Role escalation** | Only `SUPER_ADMIN`, `STAFF`, `TEACHER` via `PUT /users` | `PUT /users/:id` |
| **PassScore range** | `passScore ∈ [minScore, maxScore]` | `PUT /settings` |

## Student Delete Guard

```js
// Block deletion if student has dependent records
const checks = await prisma.$transaction([
  prisma.promotion.count({ where: { studentId } }),
  prisma.studentFee.count({ where: { studentId } }),
  prisma.studentTransfer.count({ where: { studentId } }),
  prisma.student.count({ where: { parentId: student.id } }),
  prisma.enrollment.count({ where: { studentId } }),
  prisma.score.count({ where: { studentId } }),
]);
if (checks.some(c => c > 0)) throw new ConflictError("Student has dependent records");
```

## Frontend Validation (Zod + React Hook Form)

```ts
// frontend/src/lib/schemas.ts
const scoreSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  value: z.number().min(0).max(10),
  componentId: z.string().min(1),
});
```

## Related

- [School Regulations (QD1-QD6)](./regulations.md)
- [Input Validation & Sanitization](../security/input-validation.md)
- [Business Logic Protections](../security/business-logic-protections.md)
- `backend/src/routes/*.routes.js` (validation chains)
- `frontend/src/lib/api.ts`
