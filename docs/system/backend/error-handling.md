# Global Error Handler

> Source: `backend/src/middleware/errorHandler.js`

## Error Response Format

All errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": []  // optional, e.g. validation field errors
  }
}
```

## Error Type Mapping

| Error | Code | HTTP | Description |
|---|---|---|---|
| Prisma `P2002` | `DUPLICATE_ENTRY` | 409 | Unique constraint violated |
| Prisma `P2025` | `NOT_FOUND` | 404 | Record not found (e.g. update/delete missing row) |
| `ValidationError` | `VALIDATION_ERROR` | 400 | express-validator failure, includes `details` array |
| `JsonWebTokenError` | `INVALID_TOKEN` | 401 | Malformed or unverifiable JWT |
| `TokenExpiredError` | `TOKEN_EXPIRED` | 401 | JWT past its `expiresIn` |
| `AppError` (custom) | `err.code` | `err.statusCode` | Application-level errors |
| Unknown | `INTERNAL_ERROR` | 500 | Message hidden in production |

## Prisma Error Handling

```js
// P2002 — Unique constraint (duplicate email, code, etc.)
if (err.code === 'P2002') {
  return res.status(409).json({
    error: {
      code: 'DUPLICATE_ENTRY',
      message: 'A record with this information already exists',
      details: err.meta?.target || []  // e.g. ["email", "tenantId"]
    }
  })
}

// P2025 — Record not found (updateMany/deleteMany with no match)
if (err.code === 'P2025') {
  return res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Record not found' }
  })
}
```

## ValidationError

Triggered by `express-validator` when `validationResult(req).isEmpty()` fails:

```js
const errors = validationResult(req)
if (!errors.isEmpty()) {
  return res.status(400).json({
    error: { code: 'VALIDATION_ERROR', details: errors.array() }
  })
}
```

## AppError Class

Custom error for application-level failures. Carries `statusCode` and `code`.

```js
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    Error.captureStackTrace(this, this.constructor)
  }
}

// Usage examples:
throw new AppError('Student not found', 404, 'NOT_FOUND')
throw new AppError('Class is full', 400, 'CLASS_FULL')
throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
throw new AppError('Score is locked', 403, 'SCORE_LOCKED')
```

## Production Safety

Unknown errors mask the message in production to prevent information leakage:

```js
const statusCode = err.statusCode || 500
res.status(statusCode).json({
  error: {
    code: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  }
})
```

## Related

- [Middleware](./middleware.md)
- Source: `backend/src/middleware/errorHandler.js`
