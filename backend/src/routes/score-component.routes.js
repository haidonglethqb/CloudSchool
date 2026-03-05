const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /score-components
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { subjectId } = req.query

    const where = {
      tenantId: req.tenantId,
      ...(subjectId && { subjectId })
    }

    const components = await prisma.scoreComponent.findMany({
      where,
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: [{ subjectId: 'asc' }, { weight: 'desc' }]
    })

    res.json({ data: components })
  } catch (error) {
    next(error)
  }
})

// POST /score-components
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty().withMessage('Component name is required'),
  body('weight').isInt({ min: 1, max: 100 }).withMessage('Weight must be 1-100'),
  body('subjectId').notEmpty().withMessage('Subject ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, weight, subjectId } = req.body

    // Validate total weight for subject <= 100
    const existing = await prisma.scoreComponent.findMany({
      where: { tenantId: req.tenantId, subjectId }
    })

    const totalWeight = existing.reduce((sum, c) => sum + c.weight, 0) + weight
    if (totalWeight > 100) {
      throw new AppError(
        `Total weight would be ${totalWeight}%. Must not exceed 100%.`,
        400,
        'WEIGHT_EXCEEDED'
      )
    }

    const component = await prisma.scoreComponent.create({
      data: { tenantId: req.tenantId, name, weight, subjectId },
      include: { subject: { select: { id: true, name: true } } }
    })

    res.status(201).json({ data: component })
  } catch (error) {
    next(error)
  }
})

// PUT /score-components/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { name, weight } = req.body

    const current = await prisma.scoreComponent.findUnique({ where: { id: req.params.id } })
    if (!current) throw new AppError('Not found', 404, 'NOT_FOUND')

    // Validate total weight
    if (weight) {
      const others = await prisma.scoreComponent.findMany({
        where: { tenantId: req.tenantId, subjectId: current.subjectId, id: { not: current.id } }
      })
      const totalWeight = others.reduce((sum, c) => sum + c.weight, 0) + weight
      if (totalWeight > 100) {
        throw new AppError(`Total weight would be ${totalWeight}%. Must not exceed 100%.`, 400, 'WEIGHT_EXCEEDED')
      }
    }

    const component = await prisma.scoreComponent.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(weight && { weight }) },
      include: { subject: { select: { id: true, name: true } } }
    })

    res.json({ data: component })
  } catch (error) {
    next(error)
  }
})

// DELETE /score-components/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    // Check if scores exist for this component
    const scoreCount = await prisma.score.count({ where: { scoreComponentId: req.params.id } })
    if (scoreCount > 0) {
      throw new AppError('Cannot delete component with existing scores', 400, 'HAS_SCORES')
    }

    await prisma.scoreComponent.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Score component deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
