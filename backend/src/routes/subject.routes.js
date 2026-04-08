const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// ==================== SUBJECT ROUTES ====================

// ==================== SEMESTER ROUTES (must be before /:id) ====================

// GET /subjects/semesters
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

// POST /subjects/semesters
router.post('/semesters', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty(),
  body('year').notEmpty(),
  body('semesterNum').isInt({ min: 1 }),
  body('academicYearId').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, year, semesterNum, startDate, endDate, academicYearId } = req.body

    // Validate academicYearId belongs to this tenant
    if (academicYearId) {
      const ay = await prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId: req.tenantId } })
      if (!ay) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
    }

    // QĐ8: Enforce maxSemesters from settings
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const maxSemesters = settings?.maxSemesters ?? 2

    if (semesterNum > maxSemesters) {
      throw new AppError(`Số học kỳ không được vượt quá ${maxSemesters} (QĐ8)`, 400, 'EXCEEDS_MAX_SEMESTERS')
    }

    const existingCount = await prisma.semester.count({
      where: { tenantId: req.tenantId, year }
    })
    if (existingCount >= maxSemesters) {
      throw new AppError(`Năm ${year} đã đạt tối đa ${maxSemesters} học kỳ (QĐ8)`, 400, 'MAX_SEMESTERS_REACHED')
    }

    const semester = await prisma.semester.create({
      data: {
        tenantId: req.tenantId,
        name, year, semesterNum,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        academicYearId: academicYearId || null
      }
    })

    res.status(201).json({ data: semester })
  } catch (error) {
    next(error)
  }
})

// PATCH /subjects/semesters/:id
router.patch('/semesters/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.semester.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    const { name, year, semesterNum, startDate, endDate, isActive } = req.body

    const semester = await prisma.semester.update({
      where: { id: req.params.id },
      data: {
        name, year, semesterNum,
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

// DELETE /subjects/semesters/:id
router.delete('/semesters/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.semester.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    const scores = await prisma.score.count({ where: { semesterId: req.params.id } })
    if (scores > 0) throw new AppError('Cannot delete semester with existing scores', 400, 'HAS_SCORES')

    await prisma.semester.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Semester deleted' } })
  } catch (error) {
    next(error)
  }
})

// ==================== SUBJECT CRUD ====================

// GET /subjects
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { includeInactive } = req.query
    const where = { tenantId: req.tenantId }
    if (!includeInactive) where.isActive = true

    // Teachers only see subjects they are assigned to teach
    if (req.user.role === 'TEACHER') {
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: req.user.id },
        select: { subjectId: true },
        distinct: ['subjectId'],
      })
      where.id = { in: assignments.map(a => a.subjectId) }
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
router.get('/:id', authenticate, async (req, res, next) => {
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
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
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

    // QĐ5: Validate max subjects
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const subjectCount = await prisma.subject.count({
      where: { tenantId: req.tenantId, isActive: true }
    })
    if (subjectCount >= settings.maxSubjects) {
      throw new AppError(
        `Số môn học không được vượt quá ${settings.maxSubjects}`,
        400, 'MAX_SUBJECTS_EXCEEDED'
      )
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
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    const { name, code, description, isActive } = req.body

    // Check for duplicate code
    if (code && code.toUpperCase() !== existing.code.toUpperCase()) {
      const dup = await prisma.subject.findFirst({
        where: { tenantId: req.tenantId, code: code.toUpperCase(), id: { not: req.params.id } }
      })
      if (dup) throw new AppError('Subject code already exists', 409, 'DUPLICATE_CODE')
    }

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        name,
        code: code?.toUpperCase(),
        description,
        isActive
      }
    })

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// DELETE /subjects/:id (soft delete)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    await prisma.subject.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })

    // Also deactivate score components
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
