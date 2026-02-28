const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Get all subjects (QD4)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    res.json({ data: subjects })
  } catch (error) {
    next(error)
  }
})

// ==================== SEMESTER ROUTES (must come before /:id) ====================

// Get all semesters (both paths for compatibility)
const semesterListHandler = async (req, res, next) => {
  try {
    const semesters = await prisma.semester.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ year: 'desc' }, { semesterNum: 'asc' }]
    })

    res.json({ data: semesters })
  } catch (error) {
    next(error)
  }
}

router.get('/semesters', authenticate, semesterListHandler)
router.get('/semesters/list', authenticate, semesterListHandler)

// Create semester
router.post('/semesters', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), [
  body('name').notEmpty().withMessage('Semester name is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semesterNum').isInt({ min: 1, max: 2 }).withMessage('Semester number must be 1 or 2')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, year, semesterNum, startDate, endDate } = req.body

    const semester = await prisma.semester.create({
      data: {
        tenantId: req.tenantId,
        name,
        year,
        semesterNum,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      }
    })

    res.status(201).json({ data: semester })
  } catch (error) {
    next(error)
  }
})

// Update semester
router.patch('/semesters/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, year, semesterNum, startDate, endDate, isActive } = req.body

    const semester = await prisma.semester.update({
      where: { id: req.params.id },
      data: {
        name,
        year,
        semesterNum,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive
      }
    })

    res.json({ data: semester })
  } catch (error) {
    next(error)
  }
})

// ==================== SUBJECT CRUD ====================

// Get subject by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const subject = await prisma.subject.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    })

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND')
    }

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// Create new subject (QD6 - Thay đổi môn học)
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), [
  body('name').notEmpty().withMessage('Subject name is required'),
  body('code').notEmpty().withMessage('Subject code is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, code } = req.body

    const subject = await prisma.subject.create({
      data: {
        tenantId: req.tenantId,
        name,
        code: code.toUpperCase()
      }
    })

    res.status(201).json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// Update subject
router.patch('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, code, isActive } = req.body

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        name,
        code: code?.toUpperCase(),
        isActive
      }
    })

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// PUT alias for update (frontend compatibility)
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, code, isActive } = req.body

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        name,
        code: code?.toUpperCase(),
        isActive
      }
    })

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// Delete subject (soft delete)
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.subject.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })

    res.json({ data: { message: 'Subject deleted successfully' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
