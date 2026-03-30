const jwt = require('jsonwebtoken')
const { LRUCache } = require('lru-cache')
const prisma = require('../lib/prisma')
const { AppError } = require('./errorHandler')

const userCache = new LRUCache({ max: 500, ttl: 60 * 1000 })
const settingsCache = new LRUCache({ max: 100, ttl: 5 * 60 * 1000 })

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

    if (!token) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    let user = userCache.get(decoded.sub)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { tenant: true }
      })
      if (user) userCache.set(decoded.sub, user)
    }

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE')
    }

    req.user = user
    req.tenantId = user.tenantId

    // Attach tenant settings for non-platform admins
    if (user.tenantId) {
      let settings = settingsCache.get(user.tenantId)
      if (!settings) {
        settings = await prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } })
        if (settings) settingsCache.set(user.tenantId, settings)
      }
      req.tenantSettings = settings
    }

    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'))
    }
    next(error)
  }
}

// Invalidate user cache on user update/delete
const invalidateUserCache = (userId) => userCache.delete(userId)
const invalidateSettingsCache = (tenantId) => settingsCache.delete(tenantId)

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'))
    }
    next()
  }
}

// Tenant isolation: PLATFORM_ADMIN is not constrained by tenantId
const tenantGuard = (req, res, next) => {
  if (req.user.role === 'PLATFORM_ADMIN') {
    return next()
  }
  if (!req.tenantId) {
    return next(new AppError('Tenant context required', 403, 'NO_TENANT'))
  }
  next()
}

module.exports = { authenticate, authorize, tenantGuard, invalidateUserCache, invalidateSettingsCache }
