const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
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
  body('passScore').optional().isFloat({ min: 0, max: 10 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { minAge, maxAge, maxClassSize, passScore } = req.body

    if (minAge && maxAge && minAge > maxAge) {
      throw new AppError('Min age cannot exceed max age', 400, 'INVALID_AGE_RANGE')
    }

    const current = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (minAge && !maxAge && minAge > current.maxAge) {
      throw new AppError('Min age cannot exceed current max age', 400, 'INVALID_AGE_RANGE')
    }
    if (maxAge && !minAge && maxAge < current.minAge) {
      throw new AppError('Max age cannot be less than current min age', 400, 'INVALID_AGE_RANGE')
    }

    const updateData = {}
    if (minAge !== undefined) updateData.minAge = minAge
    if (maxAge !== undefined) updateData.maxAge = maxAge
    if (maxClassSize !== undefined) updateData.maxClassSize = maxClassSize
    if (passScore !== undefined) updateData.passScore = passScore

    const settings = await prisma.tenantSettings.update({
      where: { tenantId: req.tenantId },
      data: updateData
    })

    res.json({ data: settings })
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
