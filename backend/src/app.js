const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
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
const reportRoutes = require('./routes/report.routes')
const settingsRoutes = require('./routes/settings.routes')
const parentRoutes = require('./routes/parent.routes')
const exportRoutes = require('./routes/export.routes')
const monitoringRoutes = require('./routes/monitoring.routes')
const feeRoutes = require('./routes/fee.routes')
const academicYearRoutes = require('./routes/academic-year.routes')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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
app.use('/api/reports', reportRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/parents', parentRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/monitoring', monitoringRoutes)
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
