const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize, invalidateSettingsCache } = require('../middleware/auth')
const { body, param, validationResult } = require('express-validator')
const { AppError } = require('../middleware/errorHandler')

// GET /settings - Current settings
router.get('/', authenticate, async (req, res, next) => {
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
router.put('/', authenticate, authorize('SUPER_ADMIN'), [
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
  body('maxRetentions').optional().isInt({ min: 1, max: 10 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const {
      minAge, maxAge, maxClassSize, passScore,
      minGradeLevel, maxGradeLevel, maxSubjects,
      minScore, maxScore, maxSemesters, maxRetentions
    } = req.body

    const current = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

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

    // Validate score range
    const effectiveMinScore = minScore ?? current.minScore
    const effectiveMaxScore = maxScore ?? current.maxScore
    if (effectiveMinScore > effectiveMaxScore) {
      throw new AppError('Điểm tối thiểu không được lớn hơn điểm tối đa', 400, 'INVALID_SCORE_RANGE')
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
    if (maxRetentions !== undefined) updateData.maxRetentions = maxRetentions

    const settings = await prisma.tenantSettings.update({
      where: { tenantId: req.tenantId },
      data: updateData
    })

    invalidateSettingsCache(req.tenantId)
    res.json({ data: settings })
  } catch (error) {
    next(error)
  }
})

// ==================== ROLE PERMISSIONS ====================

const DEFAULT_PERMISSIONS = {
  STAFF: ['students', 'classes', 'subjects', 'scores', 'reports', 'parents', 'promotion', 'export'],
  TEACHER: ['scores', 'classes', 'reports'],
}

// GET /settings/role-permissions — accessible by all authenticated users so sidebar can filter
router.get('/role-permissions', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })
    if (!settings) throw new AppError('Settings not found', 404, 'NOT_FOUND')

    const permissions = settings.rolePermissions && Object.keys(settings.rolePermissions).length > 0
      ? settings.rolePermissions
      : DEFAULT_PERMISSIONS

    res.json({ data: permissions })
  } catch (error) {
    next(error)
  }
})

// PUT /settings/role-permissions
router.put('/role-permissions', authenticate, authorize('SUPER_ADMIN'), [
  body('permissions').isObject().withMessage('Permissions must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { permissions } = req.body
    const allowedRoles = ['STAFF', 'TEACHER']
    const allowedModules = ['students', 'classes', 'subjects', 'scores', 'reports', 'parents', 'promotion', 'export', 'settings']

    // Validate structure
    for (const [role, modules] of Object.entries(permissions)) {
      if (!allowedRoles.includes(role)) {
        throw new AppError(`Invalid role: ${role}`, 400, 'INVALID_ROLE')
      }
      if (!Array.isArray(modules)) {
        throw new AppError(`Permissions for ${role} must be an array`, 400, 'INVALID_FORMAT')
      }
      for (const mod of modules) {
        if (!allowedModules.includes(mod)) {
          throw new AppError(`Invalid module: ${mod}`, 400, 'INVALID_MODULE')
        }
      }
    }

    const settings = await prisma.tenantSettings.update({
      where: { tenantId: req.tenantId },
      data: { rolePermissions: permissions }
    })

    invalidateSettingsCache(req.tenantId)
    res.json({ data: settings.rolePermissions })
  } catch (error) {
    next(error)
  }
})

// ==================== GRADE CRUD ====================

// GET /settings/grades
router.get('/grades', authenticate, async (req, res, next) => {
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
router.post('/grades', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
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
router.put('/grades/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
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
router.delete('/grades/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
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
