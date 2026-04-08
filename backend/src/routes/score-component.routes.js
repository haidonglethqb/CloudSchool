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

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } })
    if (!subject) throw new AppError('Subject not found', 404, 'NOT_FOUND')

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

    // Calculate total weight for subject and warn if not 100
    const totalWeightPostCreate = (await prisma.scoreComponent.aggregate({
      where: { subjectId },
      _sum: { weight: true }
    }))._sum.weight || 0
    const response = { data: component }
    if (totalWeightPostCreate !== 100) {
      response.warning = `Total weight for this subject is ${totalWeightPostCreate}%, not 100%`
    }
    res.status(201).json(response)
  } catch (error) {
    next(error)
  }
})

// PUT /score-components/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { name, weight } = req.body

    const current = await prisma.scoreComponent.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!current) throw new AppError('Not found', 404, 'NOT_FOUND')

    // Check for duplicate name within same subject
    if (name && name !== current.name) {
      const dup = await prisma.scoreComponent.findFirst({
        where: { tenantId: req.tenantId, subjectId: current.subjectId, name, id: { not: req.params.id } }
      })
      if (dup) throw new AppError('Score component name already exists for this subject', 409, 'DUPLICATE_NAME')
    }

    // Validate total weight
    if (weight !== undefined) {
      // Validate individual weight range
      if (weight < 1 || weight > 100) {
        throw new AppError('Weight must be between 1 and 100', 400, 'INVALID_WEIGHT')
      }
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
      data: { ...(name && { name }), ...(weight !== undefined && { weight }) },
      include: { subject: { select: { id: true, name: true } } }
    })

    // Calculate total weight for subject and warn if not 100
    const effectiveSubjectId = name !== undefined ? current.subjectId : current.subjectId
    const totalWeightPut = (await prisma.scoreComponent.aggregate({
      where: { subjectId: effectiveSubjectId },
      _sum: { weight: true }
    }))._sum.weight || 0
    const response = { data: component }
    if (totalWeightPut !== 100) {
      response.warning = `Total weight for this subject is ${totalWeightPut}%, not 100%`
    }
    res.json(response)
  } catch (error) {
    next(error)
  }
})

// DELETE /score-components/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.scoreComponent.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Not found', 404, 'NOT_FOUND')

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
