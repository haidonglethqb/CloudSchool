const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')

const parseDateInput = (value, fieldName) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is invalid`, 400, 'INVALID_DATE')
  }
  return date
}

const getAcademicYearLabel = (academicYear) => `${academicYear.startYear}-${academicYear.endYear}`

const ensureNoDateOverlap = async (tenantId, startDate, endDate, excludeId = null) => {
  const overlap = await prisma.academicYear.findFirst({
    where: {
      tenantId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { startYear: true, endYear: true }
  })

  if (overlap) {
    throw new AppError(
      `Academic year overlaps with existing range ${overlap.startYear}-${overlap.endYear}`,
      409,
      'OVERLAPPING_YEAR'
    )
  }
}

const validateSemesterWindow = ({ semesterStart, semesterEnd, academicYear, existingSemesters, semesterNum, semesterId = null }) => {
  if (semesterStart < academicYear.startDate || semesterEnd > academicYear.endDate) {
    throw new AppError('Học kỳ phải nằm trong khoảng ngày của năm học', 400, 'SEMESTER_OUT_OF_YEAR_RANGE')
  }

  const overlap = existingSemesters.find((sem) => {
    if (semesterId && sem.id === semesterId) return false
    if (!sem.startDate || !sem.endDate) return false
    return sem.startDate <= semesterEnd && sem.endDate >= semesterStart
  })
  if (overlap) {
    throw new AppError(`Học kỳ bị chồng lấn với kỳ ${overlap.semesterNum}`, 409, 'OVERLAPPING_SEMESTER')
  }

  const prevSemester = existingSemesters
    .filter((sem) => sem.id !== semesterId && sem.semesterNum < semesterNum && sem.endDate)
    .sort((a, b) => b.semesterNum - a.semesterNum)[0]
  if (prevSemester && semesterStart <= prevSemester.endDate) {
    throw new AppError(`Học kỳ ${semesterNum} phải bắt đầu sau ngày kết thúc kỳ ${prevSemester.semesterNum}`, 400, 'SEMESTER_NOT_AFTER_PREVIOUS')
  }

  const nextSemester = existingSemesters
    .filter((sem) => sem.id !== semesterId && sem.semesterNum > semesterNum && sem.startDate)
    .sort((a, b) => a.semesterNum - b.semesterNum)[0]
  if (nextSemester && semesterEnd >= nextSemester.startDate) {
    throw new AppError(`Học kỳ ${semesterNum} phải kết thúc trước ngày bắt đầu kỳ ${nextSemester.semesterNum}`, 400, 'SEMESTER_NOT_BEFORE_NEXT')
  }
}

// Shared read endpoint used by score/report/student views.
// Must stay outside the /academic-calendar permission gate.
router.get('/semesters', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
  try {
    const semesters = await prisma.semester.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ year: 'desc' }, { semesterNum: 'asc' }]
    })
    res.json({ data: semesters })
  } catch (error) {
    next(error)
  }
})

router.use(authenticate, requireFeature('academic-calendar'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('academic-calendar'))

// GET /academic-years
router.get('/', async (req, res, next) => {
  try {
    const academicYears = await prisma.academicYear.findMany({
      where: { tenantId: req.tenantId },
      include: {
        semesters: { orderBy: [{ semesterNum: 'asc' }, { startDate: 'asc' }] },
        _count: { select: { enrollments: true } }
      },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }, { startYear: 'desc' }]
    })
    res.json({ data: academicYears })
  } catch (error) {
    next(error)
  }
})

// GET /academic-years/:id
router.get('/:id', async (req, res, next) => {
  try {
    const ay = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        semesters: { orderBy: [{ semesterNum: 'asc' }, { startDate: 'asc' }] },
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
router.post('/', authorize('SUPER_ADMIN', 'STAFF'), [
  body('startYear').isInt({ min: 2000, max: 2100 }).withMessage('Invalid start year'),
  body('endYear').isInt({ min: 2000, max: 2100 }).withMessage('Invalid end year'),
  body('startDate').isISO8601().withMessage('startDate is required'),
  body('endDate').isISO8601().withMessage('endDate is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { startYear, endYear, startDate, endDate } = req.body
    if (startYear >= endYear) throw new AppError('Năm bắt đầu phải nhỏ hơn năm kết thúc', 400, 'INVALID_YEAR_RANGE')

    const parsedStartDate = parseDateInput(startDate, 'startDate')
    const parsedEndDate = parseDateInput(endDate, 'endDate')
    if (parsedStartDate >= parsedEndDate) throw new AppError('startDate must be before endDate', 400, 'INVALID_DATE_RANGE')

    const existing = await prisma.academicYear.findFirst({
      where: { tenantId: req.tenantId, startYear, endYear }
    })
    if (existing) throw new AppError('Năm học này đã tồn tại', 409, 'DUPLICATE')

    await ensureNoDateOverlap(req.tenantId, parsedStartDate, parsedEndDate)

    const ay = await prisma.academicYear.create({
      data: {
        tenantId: req.tenantId,
        startYear,
        endYear,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        isActive: false
      },
      include: { semesters: true }
    })

    res.status(201).json({ data: ay })
  } catch (error) {
    next(error)
  }
})

// PUT /academic-years/:id
router.put('/:id', authorize('SUPER_ADMIN', 'STAFF'), [
  body('startYear').optional().isInt({ min: 2000, max: 2100 }),
  body('endYear').optional().isInt({ min: 2000, max: 2100 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
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
    if (startYear >= endYear) throw new AppError('Năm bắt đầu phải nhỏ hơn năm kết thúc', 400, 'INVALID_YEAR_RANGE')

    const parsedStartDate = req.body.startDate ? parseDateInput(req.body.startDate, 'startDate') : existing.startDate
    const parsedEndDate = req.body.endDate ? parseDateInput(req.body.endDate, 'endDate') : existing.endDate
    if (!parsedStartDate || !parsedEndDate) throw new AppError('Academic year must have startDate and endDate', 400, 'MISSING_DATE_RANGE')
    if (parsedStartDate >= parsedEndDate) throw new AppError('startDate must be before endDate', 400, 'INVALID_DATE_RANGE')

    await ensureNoDateOverlap(req.tenantId, parsedStartDate, parsedEndDate, req.params.id)

    const semesters = await prisma.semester.findMany({
      where: { tenantId: req.tenantId, academicYearId: req.params.id },
      orderBy: { semesterNum: 'asc' }
    })
    for (const semester of semesters) {
      if (!semester.startDate || !semester.endDate) continue
      if (semester.startDate < parsedStartDate || semester.endDate > parsedEndDate) {
        throw new AppError('Khoảng ngày năm học mới không chứa đầy đủ các học kỳ đã có', 400, 'YEAR_RANGE_CONFLICT')
      }
    }

    const ay = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: { startYear, endYear, startDate: parsedStartDate, endDate: parsedEndDate },
      include: { semesters: true }
    })

    // Keep semester.year string consistent with academic year label
    await prisma.semester.updateMany({
      where: { tenantId: req.tenantId, academicYearId: req.params.id },
      data: { year: getAcademicYearLabel({ startYear, endYear }) }
    })

    res.json({ data: ay })
  } catch (error) {
    next(error)
  }
})

// PATCH /academic-years/:id/activate
router.patch('/:id/activate', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Academic year not found', 404, 'NOT_FOUND')

    const updated = await prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { tenantId: req.tenantId },
        data: { isActive: false }
      })
      return tx.academicYear.update({
        where: { id: req.params.id },
        data: { isActive: true }
      })
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// GET /academic-years/:id/semesters
router.get('/:id/semesters', async (req, res, next) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!year) throw new AppError('Academic year not found', 404, 'NOT_FOUND')

    const semesters = await prisma.semester.findMany({
      where: { tenantId: req.tenantId, academicYearId: req.params.id },
      orderBy: [{ semesterNum: 'asc' }, { startDate: 'asc' }]
    })
    res.json({ data: semesters })
  } catch (error) {
    next(error)
  }
})

// POST /academic-years/:id/semesters
router.post('/:id/semesters', authorize('SUPER_ADMIN', 'STAFF'), [
  body('semesterNum').isInt({ min: 1 }).withMessage('semesterNum is required'),
  body('startDate').isISO8601().withMessage('startDate is required'),
  body('endDate').isISO8601().withMessage('endDate is required'),
  body('name').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!year) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
    if (!year.startDate || !year.endDate) throw new AppError('Academic year date range is missing', 400, 'MISSING_YEAR_DATES')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const maxSemesters = settings?.maxSemesters ?? 2

    const semesterNum = Number(req.body.semesterNum)
    if (semesterNum > maxSemesters) {
      throw new AppError(`Số học kỳ không được vượt quá ${maxSemesters}`, 400, 'EXCEEDS_MAX_SEMESTERS')
    }

    const existingSemesters = await prisma.semester.findMany({
      where: { tenantId: req.tenantId, academicYearId: req.params.id },
      orderBy: { semesterNum: 'asc' }
    })
    if (existingSemesters.length >= maxSemesters) {
      throw new AppError(`Năm học đã đạt tối đa ${maxSemesters} học kỳ`, 400, 'MAX_SEMESTERS_REACHED')
    }
    if (existingSemesters.some((sem) => sem.semesterNum === semesterNum)) {
      throw new AppError(`Học kỳ ${semesterNum} đã tồn tại trong năm học này`, 409, 'DUPLICATE_SEMESTER')
    }

    const startDate = parseDateInput(req.body.startDate, 'startDate')
    const endDate = parseDateInput(req.body.endDate, 'endDate')
    if (startDate >= endDate) throw new AppError('startDate must be before endDate', 400, 'INVALID_DATE_RANGE')

    validateSemesterWindow({
      semesterStart: startDate,
      semesterEnd: endDate,
      academicYear: year,
      existingSemesters,
      semesterNum
    })

    const semester = await prisma.semester.create({
      data: {
        tenantId: req.tenantId,
        academicYearId: req.params.id,
        name: req.body.name?.trim() || `Học kỳ ${semesterNum}`,
        year: getAcademicYearLabel(year),
        semesterNum,
        startDate,
        endDate,
        isActive: false
      }
    })

    res.status(201).json({ data: semester })
  } catch (error) {
    next(error)
  }
})

// PATCH /academic-years/:id/semesters/:semesterId
router.patch('/:id/semesters/:semesterId', authorize('SUPER_ADMIN', 'STAFF'), [
  body('semesterNum').optional().isInt({ min: 1 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('name').optional().isString(),
  body('isActive').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!year) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
    if (!year.startDate || !year.endDate) throw new AppError('Academic year date range is missing', 400, 'MISSING_YEAR_DATES')

    const existing = await prisma.semester.findFirst({
      where: { id: req.params.semesterId, tenantId: req.tenantId, academicYearId: req.params.id }
    })
    if (!existing) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const maxSemesters = settings?.maxSemesters ?? 2

    const semesterNum = req.body.semesterNum !== undefined ? Number(req.body.semesterNum) : existing.semesterNum
    if (semesterNum > maxSemesters) {
      throw new AppError(`Số học kỳ không được vượt quá ${maxSemesters}`, 400, 'EXCEEDS_MAX_SEMESTERS')
    }

    const startDate = req.body.startDate ? parseDateInput(req.body.startDate, 'startDate') : existing.startDate
    const endDate = req.body.endDate ? parseDateInput(req.body.endDate, 'endDate') : existing.endDate
    if (!startDate || !endDate) throw new AppError('Semester must have startDate and endDate', 400, 'MISSING_SEMESTER_DATES')
    if (startDate >= endDate) throw new AppError('startDate must be before endDate', 400, 'INVALID_DATE_RANGE')

    const existingSemesters = await prisma.semester.findMany({
      where: { tenantId: req.tenantId, academicYearId: req.params.id },
      orderBy: { semesterNum: 'asc' }
    })

    if (existingSemesters.some((sem) => sem.id !== existing.id && sem.semesterNum === semesterNum)) {
      throw new AppError(`Học kỳ ${semesterNum} đã tồn tại trong năm học này`, 409, 'DUPLICATE_SEMESTER')
    }

    validateSemesterWindow({
      semesterStart: startDate,
      semesterEnd: endDate,
      academicYear: year,
      existingSemesters,
      semesterNum,
      semesterId: existing.id
    })

    const semester = await prisma.$transaction(async (tx) => {
      if (req.body.isActive === true) {
        await tx.semester.updateMany({
          where: { tenantId: req.tenantId },
          data: { isActive: false }
        })

        await tx.academicYear.updateMany({
          where: { tenantId: req.tenantId },
          data: { isActive: false }
        })

        await tx.academicYear.update({
          where: { id: req.params.id },
          data: { isActive: true }
        })
      }
      return tx.semester.update({
        where: { id: existing.id },
        data: {
          semesterNum,
          name: req.body.name !== undefined ? req.body.name : existing.name,
          startDate,
          endDate,
          isActive: req.body.isActive !== undefined ? req.body.isActive : existing.isActive,
          year: getAcademicYearLabel(year)
        }
      })
    })

    res.json({ data: semester })
  } catch (error) {
    next(error)
  }
})

// DELETE /academic-years/:id/semesters/:semesterId
router.delete('/:id/semesters/:semesterId', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const semester = await prisma.semester.findFirst({
      where: { id: req.params.semesterId, tenantId: req.tenantId, academicYearId: req.params.id }
    })
    if (!semester) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    const [scoreCount, promoCount, feeCount, enrollmentCount, transferCount] = await Promise.all([
      prisma.score.count({ where: { semesterId: semester.id } }),
      prisma.promotion.count({ where: { semesterId: semester.id } }),
      prisma.fee.count({ where: { semesterId: semester.id } }),
      prisma.classEnrollment.count({ where: { semesterId: semester.id } }),
      prisma.transferHistory.count({ where: { semesterId: semester.id } })
    ])

    if (scoreCount > 0) throw new AppError('Cannot delete semester with existing scores', 400, 'HAS_SCORES')
    if (promoCount > 0) throw new AppError('Cannot delete semester with existing promotion records', 400, 'HAS_PROMOTIONS')
    if (feeCount > 0) throw new AppError('Cannot delete semester with associated fees', 400, 'HAS_FEES')
    if (enrollmentCount > 0) throw new AppError('Cannot delete semester with class enrollments', 400, 'HAS_ENROLLMENTS')
    if (transferCount > 0) throw new AppError('Cannot delete semester with transfer history', 400, 'HAS_TRANSFERS')

    await prisma.semester.delete({ where: { id: semester.id } })
    res.json({ data: { message: 'Xóa học kỳ thành công' } })
  } catch (error) {
    next(error)
  }
})

// DELETE /academic-years/:id
router.delete('/:id', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const ay = await prisma.academicYear.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { semesters: true, enrollments: true, graduationArchives: true } } }
    })
    if (!ay) throw new AppError('Academic year not found', 404, 'NOT_FOUND')

    if (ay._count.semesters > 0 || ay._count.enrollments > 0 || ay._count.graduationArchives > 0) {
      throw new AppError('Không thể xóa năm học đang có học kỳ, phân lớp hoặc lưu trữ tốt nghiệp', 400, 'HAS_DEPENDENCIES')
    }

    await prisma.academicYear.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Xóa năm học thành công' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
