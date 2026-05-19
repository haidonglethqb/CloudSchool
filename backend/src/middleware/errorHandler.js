const errorHandler = (err, req, res, next) => {
  console.error(err.stack)

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this information already exists',
        details: err.meta?.target || []
      }
    })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Record not found'
      }
    })
  }

  if (err.code === 'P2003') {
    return res.status(409).json({
      error: {
        code: 'FOREIGN_KEY_CONFLICT',
        message: 'Operation conflicts with existing related data',
        details: err.meta?.field_name ? [err.meta.field_name] : []
      }
    })
  }

  if (err.code === 'P2034') {
    return res.status(409).json({
      error: {
        code: 'TRANSACTION_CONFLICT',
        message: 'Transaction conflict, please retry'
      }
    })
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details || []
      }
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired'
      }
    })
  }

  // Default error
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      ...(err.details ? { details: err.details } : {})
    }
  })
}

class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    if (details) this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = { errorHandler, AppError }
