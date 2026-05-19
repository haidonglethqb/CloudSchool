const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')

router.use(authenticate, requireFeature('subjects'))

// GET /subjects
router.get('/', async (req, res, next) => {
  try {
    const { includeInactive } = req.query
    const where = { tenantId: req.tenantId }
    if (!includeInactive) where.isActive = true

    if (req.user.role === 'TEACHER') {
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: req.user.id },
        select: { subjectId: true },
        distinct: ['subjectId'],
      })
      where.id = { in: assignments.map((a) => a.subjectId) }
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: { scoreComponents: true },
      orderBy: { name: 'asc' }
    })

    res.json({ data: subjects })
  } catch (error) {
    next(error)
  }
})

// GET /subjects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const subject = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { scoreComponents: { orderBy: { weight: 'desc' } } }
    })

    if (!subject) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// POST /subjects
router.post('/', authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty().withMessage('Subject name is required'),
  body('code').notEmpty().withMessage('Subject code is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, code, description } = req.body

    const existing = await prisma.subject.findFirst({
      where: { tenantId: req.tenantId, code: code.toUpperCase() }
    })
    if (existing) throw new AppError('Subject code already exists', 409, 'DUPLICATE')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const subjectCount = await prisma.subject.count({
      where: { tenantId: req.tenantId, isActive: true }
    })
    if (subjectCount >= settings.maxSubjects) {
      throw new AppError(`Số môn học không được vượt quá ${settings.maxSubjects}`, 400, 'MAX_SUBJECTS_EXCEEDED')
    }

    const subject = await prisma.subject.create({
      data: {
        tenantId: req.tenantId,
        name,
        code: code.toUpperCase(),
        description
      }
    })

    res.status(201).json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// PUT /subjects/:id
router.put('/:id', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    const { name, code, description, isActive } = req.body

    if (code && code.toUpperCase() !== existing.code.toUpperCase()) {
      const dup = await prisma.subject.findFirst({
        where: { tenantId: req.tenantId, code: code.toUpperCase(), id: { not: req.params.id } }
      })
      if (dup) throw new AppError('Subject code already exists', 409, 'DUPLICATE_CODE')
    }

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: { name, code: code?.toUpperCase(), description, isActive }
    })

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// DELETE /subjects/:id (soft delete)
router.delete('/:id', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    await prisma.subject.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })

    await prisma.scoreComponent.updateMany({
      where: { subjectId: req.params.id },
      data: { isActive: false }
    })

    res.json({ data: { message: 'Subject deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
