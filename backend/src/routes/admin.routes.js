const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')
const { MODULE_KEYS, DEFAULT_ENABLED_MODULES } = require('../constants/module-registry')
const { isValidVietnamPhone, normalizeVietnamPhone } = require('../utils/phone')
const {
  getTenantPlanUsage,
  assertUsageWithinLimits
} = require('../utils/subscription-limits')

// All routes require PLATFORM_ADMIN
router.use(authenticate, authorize('PLATFORM_ADMIN'))

const PHONE_VALIDATION_MESSAGE = 'Phone must be a valid Vietnam phone number (0 + 9 or 10 digits)'

const generateUniqueTenantCode = async (schoolName) => {
  const normalized = schoolName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'SCHOOL'
  const prefix = normalized.slice(0, 8)

  for (let i = 0; i < 30; i += 1) {
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const candidate = `${prefix}${suffix}`
    const existing = await prisma.tenant.findUnique({ where: { code: candidate }, select: { id: true } })
    if (!existing) return candidate
  }

  throw new AppError('Unable to generate unique tenant code', 500, 'TENANT_CODE_GENERATION_FAILED')
}

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

    // School and Student growth over last 6 months (2 queries instead of 12)
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: `T${d.getMonth() + 1}`, key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
    })

    const [schoolGrowthRaw, studentGrowthRaw] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
               count(*)::int as count
        FROM tenants
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY date_trunc('month', "createdAt")
      `,
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
               count(*)::int as count
        FROM students
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY date_trunc('month', "createdAt")
      `
    ])

    const schoolMap = new Map(schoolGrowthRaw.map(r => [r.month, r.count]))
    const studentMap = new Map(studentGrowthRaw.map(r => [r.month, r.count]))
    const schoolGrowth = months.map(m => ({ month: m.label, count: schoolMap.get(m.key) || 0 }))
    const studentGrowth = months.map(m => ({ month: m.label, count: studentMap.get(m.key) || 0 }))

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
  body('adminEmail').notEmpty().withMessage('adminEmail is required').bail().isEmail(),
  body('adminName').notEmpty().withMessage('adminName is required').bail().isString().isLength({ min: 1, max: 100 }),
  body('adminPassword').notEmpty().withMessage('adminPassword is required').bail().isString().isLength({ min: 6 }).withMessage('adminPassword must be at least 6 characters'),
  body('phone').optional({ values: 'falsy' }).custom((value) => {
    if (!isValidVietnamPhone(value)) throw new Error(PHONE_VALIDATION_MESSAGE)
    return true
  }),
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

    const normalizedPhone = normalizeVietnamPhone(req.body.phone)
    const { address, planId, adminEmail, adminName, adminPassword } = req.body
    if (!adminEmail || !adminName || !adminPassword) {
      throw new AppError('adminEmail, adminName and adminPassword are required', 400, 'VALIDATION_ERROR')
    }
    const code = await generateUniqueTenantCode(schoolName)

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const tenant = await prisma.tenant.create({
      data: {
        name: schoolName,
        code,
        email: req.body.email || adminEmail,
        phone: normalizedPhone,
        address,
        planId: planId || undefined,
        settings: {
          create: {
            minAge: 15,
            maxAge: 20,
            maxClassSize: 40,
            passScore: 5.0,
            enabledModules: DEFAULT_ENABLED_MODULES,
          }
        },
        users: {
          create: {
            email: adminEmail,
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
      include: {
        plan: true,
        users: { select: { id: true, email: true, fullName: true, role: true } }
      }
    })

    const initialAdmin = tenant.users[0] || null
    const { users, ...tenantData } = tenant
    res.status(201).json({
      data: {
        tenant: tenantData,
        initialAdmin
      }
    })
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

// GET /admin/schools/:id/features
router.get('/schools/:id/features', async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId: req.params.id },
      select: { tenantId: true, enabledModules: true, updatedAt: true }
    })

    if (!settings) throw new AppError('School settings not found', 404, 'NOT_FOUND')

    const enabledModules = Array.isArray(settings.enabledModules)
      ? settings.enabledModules.filter((moduleKey) => MODULE_KEYS.includes(moduleKey))
      : DEFAULT_ENABLED_MODULES

    res.json({
      data: {
        tenantId: settings.tenantId,
        enabledModules,
        allModules: MODULE_KEYS,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error) {
    next(error)
  }
})

// PUT /admin/schools/:id/features
router.put('/schools/:id/features', [
  body('enabledModules').isArray().withMessage('enabledModules must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const rawEnabledModules = req.body.enabledModules || []
    const invalidModule = rawEnabledModules.find((moduleKey) => !MODULE_KEYS.includes(moduleKey))
    if (invalidModule) {
      throw new AppError(`Invalid module: ${invalidModule}`, 400, 'INVALID_MODULE')
    }

    const settings = await prisma.tenantSettings.update({
      where: { tenantId: req.params.id },
      data: { enabledModules: rawEnabledModules },
      select: { tenantId: true, enabledModules: true, updatedAt: true }
    })

    res.json({
      data: {
        tenantId: settings.tenantId,
        enabledModules: settings.enabledModules,
        allModules: MODULE_KEYS,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error) {
    next(error)
  }
})

// PUT /admin/schools/:id
router.put('/schools/:id', [
  body('email').optional().isEmail(),
  body('phone').optional({ values: 'falsy' }).custom((value) => {
    if (!isValidVietnamPhone(value)) throw new Error(PHONE_VALIDATION_MESSAGE)
    return true
  }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, email, phone, address, planId, status } = req.body
    const normalizedPhone = normalizeVietnamPhone(phone)

    if (planId !== undefined && planId) {
      const targetPlan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      if (!targetPlan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND')
      const usage = await getTenantPlanUsage(prisma, req.params.id)
      assertUsageWithinLimits(usage, {
        students: targetPlan.studentLimit,
        classes: targetPlan.classLimit,
        staff: targetPlan.staffLimit,
        teachers: targetPlan.teacherLimit
      }, 'PLAN_DOWNGRADE_TOO_LOW')
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone: normalizedPhone }),
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
      maxStaff: p.staffLimit,
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
    const studentLimit = req.body.studentLimit ?? req.body.maxStudents ?? 100
    const staffLimit = req.body.staffLimit ?? req.body.maxStaff ?? 10
    const teacherLimit = req.body.teacherLimit ?? req.body.maxTeachers ?? 20
    const classLimit = req.body.classLimit ?? req.body.maxClasses ?? 30
    const features = req.body.features || []

    const plan = await prisma.subscriptionPlan.create({
      data: { name, price, studentLimit, staffLimit, teacherLimit, classLimit, description, features }
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
    const studentLimit = req.body.studentLimit ?? req.body.maxStudents
    const staffLimit = req.body.staffLimit ?? req.body.maxStaff
    const teacherLimit = req.body.teacherLimit ?? req.body.maxTeachers
    const classLimit = req.body.classLimit ?? req.body.maxClasses
    const features = req.body.features

    const currentPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id },
      include: { tenants: { select: { id: true } } }
    })
    if (!currentPlan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND')

    const nextLimits = {
      students: studentLimit ?? currentPlan.studentLimit,
      classes: classLimit ?? currentPlan.classLimit,
      staff: staffLimit ?? currentPlan.staffLimit,
      teachers: teacherLimit ?? currentPlan.teacherLimit
    }
    for (const tenant of currentPlan.tenants) {
      const usage = await getTenantPlanUsage(prisma, tenant.id)
      assertUsageWithinLimits(usage, nextLimits, 'PLAN_LIMIT_TOO_LOW')
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price }),
        ...(studentLimit !== undefined && { studentLimit }),
        ...(staffLimit !== undefined && { staffLimit }),
        ...(teacherLimit !== undefined && { teacherLimit }),
        ...(classLimit !== undefined && { classLimit }),
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
