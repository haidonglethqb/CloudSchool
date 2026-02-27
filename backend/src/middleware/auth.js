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

// Middleware to ensure tenant isolation
const tenantIsolation = (req, res, next) => {
  // Add tenantId to query params for all requests
  if (req.user && req.user.role !== 'SUPER_ADMIN') {
    req.tenantId = req.user.tenantId
  }
  next()
}

module.exports = { authenticate, authorize, tenantIsolation }
