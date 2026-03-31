const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const rateLimit = require('express-rate-limit')
const prisma = require('../lib/prisma')
const { AppError } = require('../middleware/errorHandler')
const { authenticate } = require('../middleware/auth')

// Rate limit bypass for automated testing (Playwright)
const skipIfBypassToken = (req) => {
  const bypassSecret = process.env.RATE_LIMIT_BYPASS_SECRET
  return bypassSecret && req.headers['x-ratelimit-bypass'] === bypassSecret
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skip: skipIfBypassToken,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, try again later' } }
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  skip: skipIfBypassToken,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many registrations, try again later' } }
})

const generateToken = (user) => {
  return jwt.sign(
    { sub: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  )
}

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  })
}

// POST /auth/login
router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { email, password, tenantCode } = req.body

    // Platform admin login (no tenantCode needed)
    if (!tenantCode) {
      const user = await prisma.user.findFirst({
        where: { email, role: 'PLATFORM_ADMIN', tenantId: null }
      })
      if (!user || !user.isActive) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }
      const token = generateToken(user)
      setTokenCookie(res, token)
      return res.json({
        data: {
          user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
          token
        }
      })
    }

    // Tenant-scoped login
    const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode.toUpperCase() } })
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new AppError('School not found or inactive', 404, 'TENANT_NOT_FOUND')
    }

    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: { tenant: true }
    })
    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    const token = generateToken(user)
    setTokenCookie(res, token)

    const responseData = {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, code: tenant.code },
      token
    }

    if (user.role === 'PARENT') {
      const parentLinks = await prisma.parentStudent.findMany({
        where: { parentId: user.id },
        include: { student: { include: { class: true } } }
      })
      responseData.children = parentLinks.map(l => ({
        id: l.student.id,
        fullName: l.student.fullName,
        studentCode: l.student.studentCode,
        className: l.student.class?.name,
        relationship: l.relationship
      }))
    }

    res.json({ data: responseData })
  } catch (error) {
    next(error)
  }
})

// GET /auth/plans — Public (no auth required)
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: {
        id: true, name: true, price: true, description: true,
        studentLimit: true, teacherLimit: true, classLimit: true,
        features: true
      }
    })
    res.json({ data: plans })
  } catch (error) {
    next(error)
  }
})

// POST /auth/register-school
router.post('/register-school', registerLimiter, [
  body('schoolName').notEmpty().withMessage('School name is required'),
  body('adminEmail').optional().isEmail(),
  body('email').optional().isEmail(),
  body('phone').optional(),
  body('address').optional(),
  body('adminPassword').optional().isLength({ min: 6 }),
  body('password').optional().isLength({ min: 6 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { schoolName, phone, address } = req.body
    const email = req.body.adminEmail || req.body.email
    const password = req.body.adminPassword || req.body.password
    const adminName = req.body.adminName || `Admin - ${schoolName}`
    const planId = req.body.planId || null

    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR')
    }

    // Validate planId if provided
    if (planId) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      if (!plan || !plan.isActive) {
        throw new AppError('Invalid or inactive plan', 400, 'INVALID_PLAN')
      }
    }

    const code = schoolName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() +
      Math.random().toString(36).substring(2, 5).toUpperCase()

    const hashedPassword = await bcrypt.hash(password, 10)

    const tenant = await prisma.tenant.create({
      data: {
        name: schoolName,
        code,
        email,
        phone,
        address,
        planId,
        settings: { create: { minAge: 15, maxAge: 20, maxClassSize: 40, passScore: 5.0 } },
        users: {
          create: { email, password: hashedPassword, fullName: adminName, role: 'SUPER_ADMIN' }
        },
        grades: {
          create: [
            { name: 'Khối 10', level: 10 },
            { name: 'Khối 11', level: 11 },
            { name: 'Khối 12', level: 12 }
          ]
        }
      },
      include: { users: true, settings: true }
    })

    const user = tenant.users[0]
    const token = generateToken(user)
    setTokenCookie(res, token)

    res.status(201).json({
      data: {
        tenant: { id: tenant.id, name: tenant.name, code: tenant.code },
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        token
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const includes = {}
    if (req.user.tenantId) {
      includes.tenant = { include: { settings: true } }
    }
    if (req.user.role === 'PARENT') {
      includes.children = { include: { student: { include: { class: true } } } }
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: includes
    })

    const data = {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      tenant: user.tenant ? {
        id: user.tenant.id, name: user.tenant.name, code: user.tenant.code,
        settings: user.tenant.settings
      } : null
    }

    if (user.role === 'PARENT' && user.children) {
      data.children = user.children.map(c => ({
        id: c.student.id,
        fullName: c.student.fullName,
        studentCode: c.student.studentCode,
        className: c.student.class?.name,
        relationship: c.relationship
      }))
    }

    res.json({ data })
  } catch (error) {
    next(error)
  }
})

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ data: { message: 'Logged out successfully' } })
})

module.exports = router
