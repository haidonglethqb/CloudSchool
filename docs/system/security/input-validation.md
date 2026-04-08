# Input Validation & Sanitization

> express-validator (backend), Zod (frontend), Helmet headers, CSV injection prevention.

## Backend Validation (express-validator)

Applied on all route inputs:

```js
// backend/src/routes/auth.routes.js
[
  check("email").isEmail().normalizeEmail(),
  check("password").isLength({ min: 6 }),
  check("fullName").trim().isLength({ min: 2, max: 100 }),
]
```

| Check | Rule | Example |
|-------|------|---------|
| Email | RFC format + normalize | `user@domain.com` |
| Required fields | `.notEmpty()` | `classId`, `subjectId` |
| Length limits | `max: 100` for names | Prevents buffer overflow |
| Score range | `isFloat({ min: 0, max: 10 })` | `POST /scores/*` |

## CSV Formula Injection Prevention

```js
// Escape values starting with formula triggers
function escapeCsvValue(val) {
  if (["=", "+", "-", "@"].includes(val[0])) return `'${val}`;
  return val;
}
```

## Security Headers (Helmet)

```js
// backend/src/app.js
import helmet from "helmet";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
}));

// Export responses
res.setHeader("X-Content-Type-Options", "nosniff");
```

## Frontend Validation (Zod)

```ts
// frontend/src/lib/schemas.ts
const studentSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  birthYear: z.number().int().min(1900),
  classId: z.string().min(1),
});
```

## Validation Layers

```mermaid
flowchart LR
  A[User Input] --> B[Zod (Frontend)]
  B --> C{Valid?}
  C -->|No| D[Inline error]
  C -->|Yes| E[API Request]
  E --> F[express-validator (Backend)]
  F --> G{Valid?}
  G -->|No| H[400 + error details]
  G -->|Yes| I[Prisma (Type-safe)]
  I --> J[Database]
```

## SQL Injection Prevention

Prisma's parameterized queries prevent SQL injection at the ORM level:

```ts
// SAFE: Prisma parameterizes internally
const user = await prisma.user.findUnique({ where: { email: userInput } });

// DANGEROUS pattern (never do this):
// await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${userInput}'`)
```

## Related

- [School Regulations (QD1-QD6)](../business-rules/regulations.md)
- [Input & Business Logic Validations](../business-rules/validations.md)
- [Authentication Security](./authentication-security.md)
- `backend/src/routes/*.routes.js`
- `frontend/src/lib/api.ts`
