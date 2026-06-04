const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize, invalidateSettingsCache } = require('../middleware/auth')
const { body, param, validationResult } = require('express-validator')
const { AppError } = require('../middleware/errorHandler')
const { MODULE_KEYS, ROLE_MODULE_KEYS } = require('../constants/module-registry')
const { requireFeature, requireRolePermission, DEFAULT_ROLE_PERMISSIONS, normalizeRolePermissions } = require('../middleware/feature-flags')
const { getTenantPlanUsage, getTenantPlanLimits } = require('../utils/subscription-limits')

// GET /settings/role-permissions
// Read-only endpoint for sidebar/menu filtering.
// Must stay outside the /settings module permission gate.
router.get('/role-permissions', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })
    if (!settings) throw new AppError('Settings not found', 404, 'NOT_FOUND')

    const [usage, limits] = await Promise.all([
      getTenantPlanUsage(prisma, req.tenantId),
      getTenantPlanLimits(prisma, req.tenantId)
    ])
    const permissions = normalizeRolePermissions(settings.rolePermissions)

    res.json({ data: permissions, meta: { roleUsage: usage, planLimits: limits } })
  } catch (error) {
    next(error)
  }
})

router.use(authenticate, requireFeature('settings'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('settings'))

// GET /settings - Current settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })
    if (!settings) throw new AppError('Settings not found', 404, 'NOT_FOUND')
    res.json({ data: settings })
  } catch (error) {
    next(error)
  }
})

// PUT /settings - Update settings
router.put('/', authorize('SUPER_ADMIN'), [
  body('minAge').optional().isInt({ min: 1, max: 100 }),
  body('maxAge').optional().isInt({ min: 1, max: 100 }),
  body('maxClassSize').optional().isInt({ min: 1, max: 200 }),
  body('passScore').optional().isFloat({ min: 0, max: 10 }),
  body('minGradeLevel').optional().isInt({ min: 1, max: 20 }),
  body('maxGradeLevel').optional().isInt({ min: 1, max: 20 }),
  body('maxSubjects').optional().isInt({ min: 1, max: 50 }),
  body('minScore').optional().isFloat({ min: 0, max: 100 }),
  body('maxScore').optional().isFloat({ min: 0, max: 100 }),
  body('maxSemesters').optional().isInt({ min: 1, max: 4 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const {
      minAge, maxAge, maxClassSize, passScore,
      minGradeLevel, maxGradeLevel, maxSubjects,
      minScore, maxScore, maxSemesters
    } = req.body

    const current = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (!current) throw new AppError('Tenant settings not configured', 404, 'SETTINGS_NOT_FOUND')

    // Validate age range
    const effectiveMinAge = minAge ?? current.minAge
    const effectiveMaxAge = maxAge ?? current.maxAge
    if (effectiveMinAge > effectiveMaxAge) {
      throw new AppError('Tuổi tối thiểu không được lớn hơn tuổi tối đa', 400, 'INVALID_AGE_RANGE')
    }

    // Validate grade level range
    const effectiveMinGrade = minGradeLevel ?? current.minGradeLevel
    const effectiveMaxGrade = maxGradeLevel ?? current.maxGradeLevel
    if (effectiveMinGrade > effectiveMaxGrade) {
      throw new AppError('Khối tối thiểu không được lớn hơn khối tối đa', 400, 'INVALID_GRADE_RANGE')
    }
    const invalidGrades = await prisma.grade.findMany({
      where: {
        tenantId: req.tenantId,
        OR: [
          { level: { lt: effectiveMinGrade } },
          { level: { gt: effectiveMaxGrade } }
        ]
      },
      select: { name: true, level: true },
      orderBy: { level: 'asc' }
    })
    if (invalidGrades.length > 0) {
      throw new AppError(
        `Cannot apply grade range ${effectiveMinGrade}-${effectiveMaxGrade}. Existing grades outside range: ${invalidGrades.map((g) => `${g.name} (${g.level})`).join(', ')}`,
        400,
        'GRADE_RANGE_HAS_EXISTING_DATA'
      )
    }

    if (maxClassSize !== undefined) {
      const activeClasses = await prisma.class.findMany({
        where: { tenantId: req.tenantId, isActive: true },
        include: { _count: { select: { students: true } } },
        orderBy: { name: 'asc' }
      })
      const overCapacity = activeClasses.filter((cls) => cls._count.students > maxClassSize)
      if (overCapacity.length > 0) {
        throw new AppError(
          `Cannot set max class size to ${maxClassSize}. Classes over limit: ${overCapacity.map((cls) => `${cls.name} (${cls._count.students})`).join(', ')}`,
          400,
          'MAX_CLASS_SIZE_BELOW_CURRENT_USAGE'
        )
      }
    }


    // Validate score range
    const effectiveMinScore = minScore ?? current.minScore
    const effectiveMaxScore = maxScore ?? current.maxScore
    if (effectiveMinScore > effectiveMaxScore) {
      throw new AppError('Điểm tối thiểu không được lớn hơn điểm tối đa', 400, 'INVALID_SCORE_RANGE')
    }

    // Validate passScore range
    const effectivePassScore = passScore ?? current.passScore ?? 5
    if (effectivePassScore < effectiveMinScore || effectivePassScore > effectiveMaxScore) {
      throw new AppError(`Pass score must be between ${effectiveMinScore} and ${effectiveMaxScore}`, 400, 'INVALID_PASS_SCORE')
    }

    const updateData = {}
    if (minAge !== undefined) updateData.minAge = minAge
    if (maxAge !== undefined) updateData.maxAge = maxAge
    if (maxClassSize !== undefined) updateData.maxClassSize = maxClassSize
    if (passScore !== undefined) updateData.passScore = passScore
    if (minGradeLevel !== undefined) updateData.minGradeLevel = minGradeLevel
    if (maxGradeLevel !== undefined) updateData.maxGradeLevel = maxGradeLevel
    if (maxSubjects !== undefined) updateData.maxSubjects = maxSubjects
    if (minScore !== undefined) updateData.minScore = minScore
    if (maxScore !== undefined) updateData.maxScore = maxScore
    if (maxSemesters !== undefined) updateData.maxSemesters = maxSemesters

    const settings = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenantSettings.update({
        where: { tenantId: req.tenantId },
        data: updateData
      })
      if (maxClassSize !== undefined) {
        await tx.class.updateMany({
          where: { tenantId: req.tenantId, isActive: true },
          data: { capacity: maxClassSize }
        })
      }
      return updated
    })

    invalidateSettingsCache(req.tenantId)
    res.json({ data: settings })
  } catch (error) {
    next(error)
  }
})

// ==================== ROLE PERMISSIONS ====================

// PUT /settings/role-permissions
router.put('/role-permissions', authorize('SUPER_ADMIN'), [
  body('permissions').isObject().withMessage('Permissions must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { permissions } = req.body
    const allowedRoles = ['STAFF', 'TEACHER']

    // Validate structure
    for (const [role, modules] of Object.entries(permissions)) {
      if (!allowedRoles.includes(role)) {
        throw new AppError(`Invalid role: ${role}`, 400, 'INVALID_ROLE')
      }
      if (!Array.isArray(modules)) {
        throw new AppError(`Permissions for ${role} must be an array`, 400, 'INVALID_FORMAT')
      }
      const allowedModules = ROLE_MODULE_KEYS[role] || MODULE_KEYS
      for (const mod of modules) {
        if (!allowedModules.includes(mod)) {
          throw new AppError(`Invalid module: ${mod}`, 400, 'INVALID_MODULE')
        }
      }
    }

    const settings = await prisma.tenantSettings.update({
      where: { tenantId: req.tenantId },
      data: {
        rolePermissions: {
          STAFF: (permissions.STAFF || DEFAULT_ROLE_PERMISSIONS.STAFF).filter((mod) => ROLE_MODULE_KEYS.STAFF.includes(mod)),
          TEACHER: (permissions.TEACHER || DEFAULT_ROLE_PERMISSIONS.TEACHER).filter((mod) => ROLE_MODULE_KEYS.TEACHER.includes(mod)),
        }
      }
    })

    invalidateSettingsCache(req.tenantId)
    res.json({ data: settings.rolePermissions })
  } catch (error) {
    next(error)
  }
})

// ==================== GRADE CRUD ====================

// GET /settings/grades
router.get('/grades', async (req, res, next) => {
  try {
    const grades = await prisma.grade.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { level: 'asc' }
    })
    res.json({ data: grades })
  } catch (error) {
    next(error)
  }
})

// POST /settings/grades
router.post('/grades', authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty(),
  body('level').isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, level } = req.body

    const existing = await prisma.grade.findFirst({
      where: { tenantId: req.tenantId, level }
    })
    if (existing) throw new AppError('Grade level already exists', 409, 'DUPLICATE')

    // QĐ3: Validate grade level within settings range
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (level < settings.minGradeLevel || level > settings.maxGradeLevel) {
      throw new AppError(
        `Khối phải nằm trong khoảng ${settings.minGradeLevel}-${settings.maxGradeLevel}`,
        400, 'INVALID_GRADE_LEVEL'
      )
    }

    const grade = await prisma.grade.create({
      data: { tenantId: req.tenantId, name, level }
    })

    res.status(201).json({ data: grade })
  } catch (error) {
    next(error)
  }
})

// PUT /settings/grades/:id
router.put('/grades/:id', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { name, level } = req.body

    const existing = await prisma.grade.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Grade not found', 404, 'NOT_FOUND')

    if (level && level !== existing.level) {
      const conflict = await prisma.grade.findFirst({
        where: { tenantId: req.tenantId, level, NOT: { id: req.params.id } }
      })
      if (conflict) throw new AppError('Grade level exists', 409, 'DUPLICATE')

      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
      if (level < settings.minGradeLevel || level > settings.maxGradeLevel) {
        throw new AppError(
          `Grade must be between ${settings.minGradeLevel}-${settings.maxGradeLevel}`,
          400,
          'INVALID_GRADE_LEVEL'
        )
      }
    }

    const grade = await prisma.grade.update({
      where: { id: req.params.id },
      data: { name, level }
    })

    res.json({ data: grade })
  } catch (error) {
    next(error)
  }
})

// DELETE /settings/grades/:id
router.delete('/grades/:id', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const grade = await prisma.grade.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { classes: true } } }
    })
    if (!grade) throw new AppError('Grade not found', 404, 'NOT_FOUND')
    if (grade._count.classes > 0) throw new AppError('Cannot delete grade with classes', 400, 'HAS_CLASSES')

    await prisma.grade.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Grade deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
