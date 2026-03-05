const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')
const { AppError } = require('./errorHandler')

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

    if (!token) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { tenant: true }
    })

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE')
    }

    req.user = user
    req.tenantId = user.tenantId
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'))
    }
    next(error)
  }
}

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

module.exports = { authenticate, authorize, tenantGuard }
