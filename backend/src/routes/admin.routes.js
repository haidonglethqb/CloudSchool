const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// All routes require PLATFORM_ADMIN
router.use(authenticate, authorize('PLATFORM_ADMIN'))

// GET /admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalSchools,
      activeSchools,
      inactiveSchools,
      suspendedSchools,
      totalUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      totalPlans
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'INACTIVE' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { role: { not: 'PLATFORM_ADMIN' } } }),
      prisma.student.count(),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.class.count(),
      prisma.subscriptionPlan.count({ where: { isActive: true } })
    ])

    // School growth over last 6 months
    const now = new Date()
    const schoolGrowth = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = await prisma.tenant.count({
        where: { createdAt: { gte: start, lt: end } }
      })
      schoolGrowth.push({
        month: start.toLocaleDateString('vi-VN', { month: 'short' }),
        count
      })
    }

    // Student growth over last 6 months
    const studentGrowth = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = await prisma.student.count({
        where: { createdAt: { gte: start, lt: end } }
      })
      studentGrowth.push({
        month: start.toLocaleDateString('vi-VN', { month: 'short' }),
        count
      })
    }

    res.json({
      data: {
        totalSchools,
        activeSchools,
        inactiveSchools,
        suspendedSchools,
        totalUsers,
        totalStudents,
        totalTeachers,
        totalClasses,
        totalPlans,
        schoolGrowth,
        studentGrowth
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /admin/schools
router.get('/schools', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status && { status })
    }

    const [schools, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          plan: true,
          _count: { select: { users: true, students: true, classes: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.tenant.count({ where })
    ])

    res.json({
      data: schools,
      meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

// POST /admin/schools
router.post('/schools', [
  body('schoolName').optional(),
  body('name').optional(),
  body('email').optional().isEmail(),
  body('adminEmail').optional().isEmail(),
  body('phone').optional(),
  body('address').optional(),
  body('planId').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const schoolName = req.body.schoolName || req.body.name
    if (!schoolName) {
      throw new AppError('School name is required', 400, 'VALIDATION_ERROR')
    }

    const { phone, address, planId } = req.body
    const email = req.body.adminEmail || req.body.email
    const adminName = req.body.adminName || `Admin - ${schoolName}`
    const adminPassword = req.body.adminPassword || 'Admin@123'

    const code = schoolName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() +
      Math.random().toString(36).substring(2, 5).toUpperCase()

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const tenant = await prisma.tenant.create({
      data: {
        name: schoolName,
        code,
        email: email || undefined,
        phone,
        address,
        planId: planId || undefined,
        settings: { create: { minAge: 15, maxAge: 20, maxClassSize: 40, passScore: 5.0 } },
        users: {
          create: {
            email: email || `admin@${code.toLowerCase()}.school`,
            password: hashedPassword,
            fullName: adminName,
            role: 'SUPER_ADMIN'
          }
        },
        grades: {
          create: [
            { name: 'Khối 10', level: 10 },
            { name: 'Khối 11', level: 11 },
            { name: 'Khối 12', level: 12 }
          ]
        }
      },
      include: { plan: true, users: { select: { id: true, email: true, role: true } } }
    })

    res.status(201).json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// GET /admin/schools/:id
router.get('/schools/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        plan: true,
        settings: true,
        _count: { select: { users: true, students: true, classes: true, subjects: true } }
      }
    })

    if (!tenant) throw new AppError('School not found', 404, 'NOT_FOUND')

    // Get user breakdown by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      where: { tenantId: tenant.id },
      _count: true
    })

    res.json({ data: { ...tenant, usersByRole } })
  } catch (error) {
    next(error)
  }
})

// PUT /admin/schools/:id
router.put('/schools/:id', async (req, res, next) => {
  try {
    const { name, email, phone, address, planId, status } = req.body

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(planId !== undefined && { planId }),
        ...(status && { status })
      },
      include: { plan: true }
    })

    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// PATCH /admin/schools/:id/suspend
router.patch('/schools/:id/suspend', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED' }
    })
    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// PATCH /admin/schools/:id/activate
router.patch('/schools/:id/activate', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' }
    })
    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// DELETE /admin/schools/:id
router.delete('/schools/:id', async (req, res, next) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'School deleted' } })
  } catch (error) {
    next(error)
  }
})

// ==================== SUBSCRIPTION PLANS ====================

// GET /admin/subscriptions
router.get('/subscriptions', async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      include: { _count: { select: { tenants: true } } },
      orderBy: { price: 'asc' }
    })
    // Map schema fields to FE-compatible field names
    const mapped = plans.map(p => ({
      ...p,
      maxStudents: p.studentLimit,
      maxTeachers: p.teacherLimit,
      maxClasses: p.classLimit
    }))
    res.json({ data: mapped })
  } catch (error) {
    next(error)
  }
})

// POST /admin/subscriptions
router.post('/subscriptions', [
  body('name').notEmpty(),
  body('price').isFloat({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, price, description } = req.body
    const studentLimit = req.body.studentLimit || req.body.maxStudents || 100
    const teacherLimit = req.body.teacherLimit || req.body.maxTeachers || 20
    const classLimit = req.body.classLimit || req.body.maxClasses || 30
    const features = req.body.features || []

    const plan = await prisma.subscriptionPlan.create({
      data: { name, price, studentLimit, teacherLimit, classLimit, description, features }
    })

    res.status(201).json({ data: plan })
  } catch (error) {
    next(error)
  }
})

// PUT /admin/subscriptions/:id
router.put('/subscriptions/:id', async (req, res, next) => {
  try {
    const { name, price, description, isActive } = req.body
    const studentLimit = req.body.studentLimit || req.body.maxStudents
    const teacherLimit = req.body.teacherLimit || req.body.maxTeachers
    const classLimit = req.body.classLimit || req.body.maxClasses
    const features = req.body.features

    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price }),
        ...(studentLimit && { studentLimit }),
        ...(teacherLimit && { teacherLimit }),
        ...(classLimit && { classLimit }),
        ...(description !== undefined && { description }),
        ...(features !== undefined && { features }),
        ...(isActive !== undefined && { isActive })
      }
    })

    res.json({ data: plan })
  } catch (error) {
    next(error)
  }
})

// DELETE /admin/subscriptions/:id
router.delete('/subscriptions/:id', async (req, res, next) => {
  try {
    await prisma.subscriptionPlan.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Plan deleted' } })
  } catch (error) {
    next(error)
  }
})

// ==================== SCHOOL DETAIL TABS ====================

// GET /admin/schools/:id/users — Users in a school
router.get('/schools/:id/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      tenantId: req.params.id,
      ...(role && { role }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ])

    res.json({
      data: users,
      meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

// GET /admin/schools/:id/stats — Statistics for a school
router.get('/schools/:id/stats', async (req, res, next) => {
  try {
    const schoolId = req.params.id

    const [studentCount, teacherCount, classCount, usersByRole, scoreStats, grades] = await Promise.all([
      prisma.student.count({ where: { tenantId: schoolId } }),
      prisma.user.count({ where: { tenantId: schoolId, role: 'TEACHER' } }),
      prisma.class.count({ where: { tenantId: schoolId } }),
      prisma.user.groupBy({ by: ['role'], where: { tenantId: schoolId }, _count: true }),
      prisma.score.aggregate({
        where: { tenantId: schoolId },
        _avg: { value: true },
        _min: { value: true },
        _max: { value: true },
        _count: true
      }),
      prisma.grade.findMany({
        where: { tenantId: schoolId },
        include: {
          classes: { include: { _count: { select: { students: true } } } }
        },
        orderBy: { level: 'asc' }
      })
    ])

    res.json({
      data: {
        studentCount,
        teacherCount,
        classCount,
        usersByRole,
        scoreStats,
        grades
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /admin/schools/:id/activity — Activity logs for a school
router.get('/schools/:id/activity', async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { tenantId: req.params.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.activityLog.count({ where: { tenantId: req.params.id } })
    ])

    res.json({
      data: logs,
      meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
