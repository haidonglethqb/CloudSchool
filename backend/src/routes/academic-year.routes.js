const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /academic-years
router.get('/', authenticate, async (req, res, next) => {
  try {
    const academicYears = await prisma.academicYear.findMany({
      where: { tenantId: req.tenantId },
      include: {
        semesters: { orderBy: { semesterNum: 'asc' } },
        _count: { select: { enrollments: true } }
      },
      orderBy: { startYear: 'desc' }
    })
    res.json({ data: academicYears })
  } catch (error) {
    next(error)
  }
})

// GET /academic-years/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const ay = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        semesters: { orderBy: { semesterNum: 'asc' } },
        _count: { select: { enrollments: true } }
      }
    })
    if (!ay) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
    res.json({ data: ay })
  } catch (error) {
    next(error)
  }
})

// POST /academic-years
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('startYear').isInt({ min: 2000, max: 2100 }).withMessage('Invalid start year'),
  body('endYear').isInt({ min: 2000, max: 2100 }).withMessage('Invalid end year'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { startYear, endYear } = req.body

    // QĐ1: startYear < endYear
    if (startYear >= endYear) {
      throw new AppError('Năm bắt đầu phải nhỏ hơn năm kết thúc', 400, 'INVALID_YEAR_RANGE')
    }

    const existing = await prisma.academicYear.findFirst({
      where: { tenantId: req.tenantId, startYear, endYear }
    })
    if (existing) {
      throw new AppError('Năm học này đã tồn tại', 409, 'DUPLICATE')
    }

    const ay = await prisma.academicYear.create({
      data: { tenantId: req.tenantId, startYear, endYear },
      include: { semesters: true }
    })

    res.status(201).json({ data: ay })
  } catch (error) {
    next(error)
  }
})

// PUT /academic-years/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('startYear').optional().isInt({ min: 2000, max: 2100 }),
  body('endYear').optional().isInt({ min: 2000, max: 2100 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const existing = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Academic year not found', 404, 'NOT_FOUND')

    const startYear = req.body.startYear ?? existing.startYear
    const endYear = req.body.endYear ?? existing.endYear

    if (startYear >= endYear) {
      throw new AppError('Năm bắt đầu phải nhỏ hơn năm kết thúc', 400, 'INVALID_YEAR_RANGE')
    }

    const ay = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: { startYear, endYear },
      include: { semesters: true }
    })

    res.json({ data: ay })
  } catch (error) {
    next(error)
  }
})

// DELETE /academic-years/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const ay = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { semesters: true, enrollments: true } } }
    })
    if (!ay) throw new AppError('Academic year not found', 404, 'NOT_FOUND')

    if (ay._count.semesters > 0 || ay._count.enrollments > 0) {
      throw new AppError('Không thể xóa năm học đang có học kỳ hoặc phân lớp', 400, 'HAS_DEPENDENCIES')
    }

    await prisma.academicYear.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Xóa năm học thành công' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
