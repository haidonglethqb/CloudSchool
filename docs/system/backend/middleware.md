# Backend Middleware

> Source: `backend/src/middleware/auth.js`

## authenticate

JWT verification + user lookup with LRU caching. Sets `req.user` and `req.tenantId`.

```js
const userCache = new LRUCache({ max: 500, ttl: 60 * 1000 })        // 500 entries, 60s
const settingsCache = new LRUCache({ max: 100, ttl: 5 * 60 * 1000 }) // 100 entries, 5min

const authenticate = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1]
  if (!token) throw new AppError('Authentication required', 401, 'AUTH_REQUIRED')

  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  let user = userCache.get(decoded.sub)
  if (!user) {
    user = await prisma.user.findUnique({ where: { id: decoded.sub }, include: { tenant: true } })
    if (user) userCache.set(decoded.sub, user)
  }
  if (!user || !user.isActive) throw new AppError('User not found or inactive', 401, 'USER_INACTIVE')

  req.user = user
  req.tenantId = user.tenantId

  // Attach tenant settings (non-platform admins)
  if (user.tenantId) {
    let settings = settingsCache.get(user.tenantId)
    if (!settings) {
      settings = await prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } })
      if (settings) settingsCache.set(user.tenantId, settings)
    }
    req.tenantSettings = settings
  }
  next()
}
```

**Token sources:** `req.cookies.token` (cookie auth) or `Authorization: Bearer <token>` header.

## authorize(...roles)

Role whitelist middleware. Returns 403 if `req.user.role` not in the allowed list.

```js
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'))
    }
    next()
  }
}
// Usage: router.get('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), handler)
```

## tenantGuard

Enforces tenant isolation. `PLATFORM_ADMIN` bypasses the check; all other roles require `req.tenantId`.

```js
const tenantGuard = (req, res, next) => {
  if (req.user.role === 'PLATFORM_ADMIN') return next()
  if (!req.tenantId) return next(new AppError('Tenant context required', 403, 'NO_TENANT'))
  next()
}
```

## Cache Invalidation

Call these after mutations to keep caches fresh:

| Function | When to Call |
|---|---|
| `invalidateUserCache(userId)` | User update, delete, disable, password change |
| `invalidateSettingsCache(tenantId)` | Tenant settings update, role-permissions update |

```js
const invalidateUserCache = (userId) => userCache.delete(userId)
const invalidateSettingsCache = (tenantId) => settingsCache.delete(tenantId)
```

## Role Summary

| Role | Scope | Key Permissions |
|---|---|---|
| `PLATFORM_ADMIN` | All tenants | Manage schools, subscriptions, system stats |
| `SUPER_ADMIN` | Single tenant | Full school admin: users, students, scores, settings |
| `STAFF` | Single tenant | Students, classes, scores, reports (limited by rolePermissions) |
| `TEACHER` | Single tenant | Scores for assigned classes, class view, reports |
| `PARENT` | Single tenant | View own children's scores and fees |

## Related

- [Error Handler](./error-handling.md)
- [API Endpoints](./api-endpoints.md)
- Source: `backend/src/middleware/auth.js`
