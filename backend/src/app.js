const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const adminRoutes = require('./routes/admin.routes')
const tenantRoutes = require('./routes/tenant.routes')
const userRoutes = require('./routes/user.routes')
const studentRoutes = require('./routes/student.routes')
const classRoutes = require('./routes/class.routes')
const subjectRoutes = require('./routes/subject.routes')
const scoreRoutes = require('./routes/score.routes')
const scoreComponentRoutes = require('./routes/score-component.routes')
const promotionRoutes = require('./routes/promotion.routes')
const yearEndPromotionRoutes = require('./routes/year-end-promotion.routes')
const reportRoutes = require('./routes/report.routes')
const settingsRoutes = require('./routes/settings.routes')
const parentRoutes = require('./routes/parent.routes')
const exportRoutes = require('./routes/export.routes')
const monitoringRoutes = require('./routes/monitoring.routes')
const feeRoutes = require('./routes/fee.routes')
const academicYearRoutes = require('./routes/academic-year.routes')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()

// Rate limit bypass for automated testing (Playwright)
const skipIfBypassToken = (req) => {
  if (process.env.NODE_ENV === 'test') return true
  const bypassSecret = process.env.RATE_LIMIT_BYPASS_SECRET
  return bypassSecret && req.headers['x-ratelimit-bypass'] === bypassSecret
}

// Global rate limiter: 500 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfBypassToken,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' } }
})

// Middleware
app.use(globalLimiter)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.CORS_ORIGIN || 'http://localhost:3000'],
      fontSrc: ["'self'"]
    }
  }
}))
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}))
app.use(morgan('dev'))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Route-specific rate limiters
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Export rate limit exceeded' } }
})

const monitoringLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Monitoring rate limit exceeded' } }
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/tenants', tenantRoutes)
app.use('/api/users', userRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/subjects', subjectRoutes)
app.use('/api/scores', scoreRoutes)
app.use('/api/score-components', scoreComponentRoutes)
app.use('/api/promotion', promotionRoutes)
app.use('/api/promotion', yearEndPromotionRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/parents', parentRoutes)
app.use('/api/export', exportLimiter, exportRoutes)
app.use('/api/monitoring', monitoringLimiter, monitoringRoutes)
app.use('/api/fees', feeRoutes)
app.use('/api/academic-years', academicYearRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

const PORT = process.env.PORT || 5001

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

module.exports = app
