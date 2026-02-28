const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { AppError } = require('../middleware/errorHandler')
const { authenticate } = require('../middleware/auth')

// Validation middleware
const validateLogin = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').notEmpty().withMessage('Password is required'),
  body('tenantCode').notEmpty().withMessage('School code is required')
]

const validateRegister = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('tenantCode').notEmpty().withMessage('School code is required')
]

// Register new school (tenant) with admin user
router.post('/register-school', [
  body('schoolName').notEmpty().withMessage('School name is required'),
  body('schoolCode').notEmpty().withMessage('School code is required'),
  body('adminEmail').isEmail().withMessage('Invalid admin email'),
  body('adminPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('adminName').notEmpty().withMessage('Admin name is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { schoolName, schoolCode, adminEmail, adminPassword, adminName, address, phone, email } = req.body

    // Check if school code already exists
    const existingTenant = await prisma.tenant.findUnique({ where: { code: schoolCode } })
    if (existingTenant) {
      throw new AppError('School code already exists', 409, 'DUPLICATE_SCHOOL')
    }

    // Create tenant with admin user and default settings
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    
    const tenant = await prisma.tenant.create({
      data: {
        name: schoolName,
        code: schoolCode.toUpperCase(),
        address,
        phone,
        email,
        settings: {
          create: {
            minAge: 15,
            maxAge: 20,
            maxClassSize: 40,
            passScore: 5.0,
            quiz15Weight: 1.0,
            quiz45Weight: 2.0,
            finalWeight: 3.0
          }
        },
        users: {
          create: {
            email: adminEmail,
            password: hashedPassword,
            fullName: adminName,
            role: 'ADMIN'
          }
        },
        // Create default grades
        grades: {
          create: [
            { name: 'Khối 10', level: 10 },
            { name: 'Khối 11', level: 11 },
            { name: 'Khối 12', level: 12 }
          ]
        },
        // Create default subjects
        subjects: {
          create: [
            { name: 'Toán', code: 'MATH' },
            { name: 'Vật Lý', code: 'PHY' },
            { name: 'Hóa Học', code: 'CHEM' },
            { name: 'Sinh Học', code: 'BIO' },
            { name: 'Lịch Sử', code: 'HIST' },
            { name: 'Địa Lý', code: 'GEO' },
            { name: 'Ngữ Văn', code: 'LIT' },
            { name: 'Đạo Đức', code: 'ETHICS' },
            { name: 'Thể Dục', code: 'PE' }
          ]
        },
        // Create default semesters
        semesters: {
          create: [
            { name: 'Học kỳ I', year: '2024-2025', semesterNum: 1, isActive: true },
            { name: 'Học kỳ II', year: '2024-2025', semesterNum: 2, isActive: false }
          ]
        }
      },
      include: {
        users: true,
        settings: true
      }
    })

    // Generate token
    const user = tenant.users[0]
    const token = jwt.sign(
      { sub: user.id, tenantId: tenant.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    )

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000 // 1 hour
    })

    res.status(201).json({
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          code: tenant.code
        },
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        },
        token
      }
    })
  } catch (error) {
    next(error)
  }
})

// Login
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { email, password, tenantCode } = req.body

    // Find tenant
    const tenant = await prisma.tenant.findUnique({ 
      where: { code: tenantCode.toUpperCase() }
    })
    
    if (!tenant || !tenant.isActive) {
      throw new AppError('School not found or inactive', 404, 'TENANT_NOT_FOUND')
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { 
        tenantId_email: { tenantId: tenant.id, email }
      },
      include: { tenant: true }
    })

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    // Generate token
    const token = jwt.sign(
      { sub: user.id, tenantId: tenant.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    )

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000 // 1 hour
    })

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          code: tenant.code
        },
        token
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get current user
router.get('/me', authenticate, async (req, res) => {
  const includeOptions = { 
    tenant: {
      include: { settings: true }
    }
  }
  
  // Include children info for parents
  if (req.user.role === 'PARENT') {
    includeOptions.children = {
      include: {
        student: {
          include: { class: true }
        }
      }
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: includeOptions
  })

  const responseData = {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      code: user.tenant.code,
      settings: user.tenant.settings
    }
  }

  // Add children to response for parents
  if (user.role === 'PARENT' && user.children) {
    responseData.children = user.children.map(c => ({
      id: c.student.id,
      fullName: c.student.fullName,
      studentCode: c.student.studentCode,
      className: c.student.class?.name,
      relationship: c.relationship
    }))
  }

  res.json({ data: responseData })
})

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ data: { message: 'Logged out successfully' } })
})

// Register new user (admin only)
router.post('/register', authenticate, validateRegister, async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Only admins can register new users', 403, 'FORBIDDEN')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { email, password, fullName, role } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        tenantId: req.tenantId,
        email,
        password: hashedPassword,
        fullName,
        role: role || 'TEACHER'
      }
    })

    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
