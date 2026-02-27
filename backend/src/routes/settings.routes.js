const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { body, param, validationResult } = require('express-validator')
const { AppError } = require('../middleware/errorHandler')

// QD6 - Get current settings
router.get('/', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    if (!settings) {
      throw new AppError('Settings not found', 404, 'SETTINGS_NOT_FOUND')
    }

    res.json({ data: settings })
  } catch (error) {
    next(error)
  }
})

// QD6 - Update settings (Admin only)
router.put(
  '/',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    body('minAge').optional().isInt({ min: 1, max: 100 }).withMessage('Min age must be between 1 and 100'),
    body('maxAge').optional().isInt({ min: 1, max: 100 }).withMessage('Max age must be between 1 and 100'),
    body('maxClassSize').optional().isInt({ min: 1, max: 100 }).withMessage('Max class size must be between 1 and 100'),
    body('passScore').optional().isFloat({ min: 0, max: 10 }).withMessage('Pass score must be between 0 and 10'),
    body('quiz15Weight').optional().isFloat({ min: 0, max: 10 }).withMessage('Quiz 15 weight must be positive'),
    body('quiz45Weight').optional().isFloat({ min: 0, max: 10 }).withMessage('Quiz 45 weight must be positive'),
    body('finalWeight').optional().isFloat({ min: 0, max: 10 }).withMessage('Final weight must be positive')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { minAge, maxAge, maxClassSize, passScore, quiz15Weight, quiz45Weight, finalWeight } = req.body

      // Validate age range
      if (minAge && maxAge && minAge > maxAge) {
        throw new AppError('Min age cannot be greater than max age', 400, 'INVALID_AGE_RANGE')
      }

      // Check current settings for validation
      const currentSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: req.tenantId }
      })

      if (minAge && !maxAge && minAge > currentSettings.maxAge) {
        throw new AppError('Min age cannot be greater than current max age', 400, 'INVALID_AGE_RANGE')
      }
      if (maxAge && !minAge && maxAge < currentSettings.minAge) {
        throw new AppError('Max age cannot be less than current min age', 400, 'INVALID_AGE_RANGE')
      }

      const updateData = {}
      if (minAge !== undefined) updateData.minAge = minAge
      if (maxAge !== undefined) updateData.maxAge = maxAge
      if (maxClassSize !== undefined) updateData.maxClassSize = maxClassSize
      if (passScore !== undefined) updateData.passScore = passScore
      if (quiz15Weight !== undefined) updateData.quiz15Weight = quiz15Weight
      if (quiz45Weight !== undefined) updateData.quiz45Weight = quiz45Weight
      if (finalWeight !== undefined) updateData.finalWeight = finalWeight

      const settings = await prisma.tenantSettings.update({
        where: { tenantId: req.tenantId },
        data: updateData
      })

      res.json({
        message: 'Settings updated successfully',
        data: settings
      })
    } catch (error) {
      next(error)
    }
  }
)

// QD1 - Update age rules
router.patch(
  '/age-rules',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    body('minAge').isInt({ min: 1, max: 100 }).withMessage('Min age must be between 1 and 100'),
    body('maxAge').isInt({ min: 1, max: 100 }).withMessage('Max age must be between 1 and 100')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { minAge, maxAge } = req.body

      if (minAge > maxAge) {
        throw new AppError('Min age cannot be greater than max age', 400, 'INVALID_AGE_RANGE')
      }

      const settings = await prisma.tenantSettings.update({
        where: { tenantId: req.tenantId },
        data: { minAge, maxAge }
      })

      res.json({
        message: 'Age rules updated successfully',
        data: { minAge: settings.minAge, maxAge: settings.maxAge }
      })
    } catch (error) {
      next(error)
    }
  }
)

// QD2 - Update max class size
router.patch(
  '/class-size',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    body('maxClassSize').isInt({ min: 1, max: 100 }).withMessage('Max class size must be between 1 and 100')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { maxClassSize } = req.body

      const settings = await prisma.tenantSettings.update({
        where: { tenantId: req.tenantId },
        data: { maxClassSize }
      })

      res.json({
        message: 'Max class size updated successfully',
        data: { maxClassSize: settings.maxClassSize }
      })
    } catch (error) {
      next(error)
    }
  }
)

// QD5 - Update pass score
router.patch(
  '/pass-score',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    body('passScore').isFloat({ min: 0, max: 10 }).withMessage('Pass score must be between 0 and 10')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { passScore } = req.body

      const settings = await prisma.tenantSettings.update({
        where: { tenantId: req.tenantId },
        data: { passScore }
      })

      res.json({
        message: 'Pass score updated successfully',
        data: { passScore: settings.passScore }
      })
    } catch (error) {
      next(error)
    }
  }
)

// Update score weights
router.patch(
  '/score-weights',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    body('quiz15Weight').isFloat({ min: 0 }).withMessage('Quiz 15 weight must be positive'),
    body('quiz45Weight').isFloat({ min: 0 }).withMessage('Quiz 45 weight must be positive'),
    body('finalWeight').isFloat({ min: 0 }).withMessage('Final weight must be positive')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { quiz15Weight, quiz45Weight, finalWeight } = req.body

      // Weights should sum to something meaningful
      const totalWeight = quiz15Weight + quiz45Weight + finalWeight
      if (totalWeight === 0) {
        throw new AppError('Total weights cannot be zero', 400, 'INVALID_WEIGHTS')
      }

      const settings = await prisma.tenantSettings.update({
        where: { tenantId: req.tenantId },
        data: { quiz15Weight, quiz45Weight, finalWeight }
      })

      res.json({
        message: 'Score weights updated successfully',
        data: {
          quiz15Weight: settings.quiz15Weight,
          quiz45Weight: settings.quiz45Weight,
          finalWeight: settings.finalWeight
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

// Get all grades
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

// Create new grade
router.post(
  '/grades',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    body('name').notEmpty().withMessage('Grade name is required'),
    body('level').isInt({ min: 1 }).withMessage('Level must be a positive integer')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { name, level } = req.body

      // Check if grade level exists
      const existing = await prisma.grade.findFirst({
        where: { tenantId: req.tenantId, level }
      })

      if (existing) {
        throw new AppError('Grade level already exists', 409, 'GRADE_EXISTS')
      }

      const grade = await prisma.grade.create({
        data: {
          tenantId: req.tenantId,
          name,
          level
        }
      })

      res.status(201).json({
        message: 'Grade created successfully',
        data: grade
      })
    } catch (error) {
      next(error)
    }
  }
)

// Update grade
router.put(
  '/grades/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Invalid grade ID'),
    body('name').optional().notEmpty().withMessage('Grade name cannot be empty'),
    body('level').optional().isInt({ min: 1 }).withMessage('Level must be a positive integer')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { id } = req.params
      const { name, level } = req.body

      // Check grade exists
      const existing = await prisma.grade.findFirst({
        where: { id, tenantId: req.tenantId }
      })

      if (!existing) {
        throw new AppError('Grade not found', 404, 'GRADE_NOT_FOUND')
      }

      // Check level conflict
      if (level && level !== existing.level) {
        const levelConflict = await prisma.grade.findFirst({
          where: { tenantId: req.tenantId, level, NOT: { id } }
        })
        if (levelConflict) {
          throw new AppError('Grade level already exists', 409, 'GRADE_EXISTS')
        }
      }

      const updateData = {}
      if (name) updateData.name = name
      if (level) updateData.level = level

      const grade = await prisma.grade.update({
        where: { id },
        data: updateData
      })

      res.json({
        message: 'Grade updated successfully',
        data: grade
      })
    } catch (error) {
      next(error)
    }
  }
)

// Delete grade
router.delete(
  '/grades/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params

      // Check grade exists and has no classes
      const grade = await prisma.grade.findFirst({
        where: { id, tenantId: req.tenantId },
        include: { _count: { select: { classes: true } } }
      })

      if (!grade) {
        throw new AppError('Grade not found', 404, 'GRADE_NOT_FOUND')
      }

      if (grade._count.classes > 0) {
        throw new AppError('Cannot delete grade with existing classes', 400, 'GRADE_HAS_CLASSES')
      }

      await prisma.grade.delete({ where: { id } })

      res.json({ message: 'Grade deleted successfully' })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = router
