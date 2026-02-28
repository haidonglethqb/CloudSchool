const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Get all grades with classes (BM2)
router.get('/grades', authenticate, async (req, res, next) => {
  try {
    const grades = await prisma.grade.findMany({
      where: { tenantId: req.tenantId },
      include: {
        classes: {
          where: { isActive: true },
          include: {
            _count: { select: { students: true } }
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { level: 'asc' }
    })

    res.json({ data: grades })
  } catch (error) {
    next(error)
  }
})

// Get all classes
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { gradeId } = req.query

    const classes = await prisma.class.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true,
        ...(gradeId && { gradeId })
      },
      include: {
        grade: true,
        _count: { select: { students: true } }
      },
      orderBy: { name: 'asc' }
    })

    res.json({ data: classes })
  } catch (error) {
    next(error)
  }
})

// Get class by ID with students (BM2 - Danh sách lớp)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const classInfo = await prisma.class.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      },
      include: {
        grade: true,
        students: {
          where: { isActive: true },
          orderBy: { fullName: 'asc' }
        },
        _count: { select: { students: true } }
      }
    })

    if (!classInfo) {
      throw new AppError('Class not found', 404, 'NOT_FOUND')
    }

    res.json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// Create new class
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), [
  body('name').notEmpty().withMessage('Class name is required'),
  body('gradeId').notEmpty().withMessage('Grade is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, gradeId, homeroomTeacher, maxStudents } = req.body

    // Get tenant settings for max class size
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    const classInfo = await prisma.class.create({
      data: {
        tenantId: req.tenantId,
        gradeId,
        name,
        homeroomTeacher,
        maxStudents: maxStudents || settings.maxClassSize
      },
      include: {
        grade: true
      }
    })

    res.status(201).json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// Update class
router.patch('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, homeroomTeacher, maxStudents, isActive } = req.body

    const classInfo = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        name,
        homeroomTeacher,
        maxStudents,
        isActive
      },
      include: {
        grade: true,
        _count: { select: { students: true } }
      }
    })

    res.json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// PUT alias for update (frontend compatibility)
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, homeroomTeacher, maxStudents, isActive, gradeId } = req.body

    const classInfo = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        name,
        homeroomTeacher,
        maxStudents,
        isActive,
        ...(gradeId && { gradeId })
      },
      include: {
        grade: true,
        _count: { select: { students: true } }
      }
    })

    res.json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// Delete class (soft delete)
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Check if class has students
    const classInfo = await prisma.class.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { students: true } } }
    })

    if (classInfo._count.students > 0) {
      throw new AppError('Cannot delete class with students', 400, 'CLASS_HAS_STUDENTS')
    }

    await prisma.class.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })

    res.json({ data: { message: 'Class deleted successfully' } })
  } catch (error) {
    next(error)
  }
})

// Get class students with grades
router.get('/:id/students', authenticate, async (req, res, next) => {
  try {
    const { semesterId } = req.query

    const students = await prisma.student.findMany({
      where: {
        classId: req.params.id,
        isActive: true
      },
      include: {
        scores: {
          where: semesterId ? { semesterId } : {},
          include: {
            subject: true,
            semester: true
          }
        }
      },
      orderBy: { fullName: 'asc' }
    })

    res.json({ data: students })
  } catch (error) {
    next(error)
  }
})

// Create grade (khối)
router.post('/grades', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), [
  body('name').notEmpty().withMessage('Grade name is required'),
  body('level').isInt({ min: 1, max: 12 }).withMessage('Level must be between 1 and 12')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, level } = req.body

    const grade = await prisma.grade.create({
      data: {
        tenantId: req.tenantId,
        name,
        level
      }
    })

    res.status(201).json({ data: grade })
  } catch (error) {
    next(error)
  }
})

// Update grade
router.patch('/grades/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, level } = req.body

    const grade = await prisma.grade.update({
      where: { id: req.params.id },
      data: { name, level }
    })

    res.json({ data: grade })
  } catch (error) {
    next(error)
  }
})

// Delete grade
router.delete('/grades/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Check if grade has classes
    const grade = await prisma.grade.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { classes: true } } }
    })

    if (grade._count.classes > 0) {
      throw new AppError('Cannot delete grade with classes', 400, 'GRADE_HAS_CLASSES')
    }

    await prisma.grade.delete({
      where: { id: req.params.id }
    })

    res.json({ data: { message: 'Grade deleted successfully' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
