const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /classes/grades - Get grades with classes
router.get('/grades', authenticate, async (req, res, next) => {
  try {
    const grades = await prisma.grade.findMany({
      where: { tenantId: req.tenantId },
      include: {
        classes: {
          where: { isActive: true },
          include: { _count: { select: { students: true } } },
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

// GET /classes
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { gradeId, academicYear } = req.query

    let where = {
      tenantId: req.tenantId,
      isActive: true,
      ...(gradeId && { gradeId }),
      ...(academicYear && { academicYear })
    }

    // Teacher only sees assigned classes
    if (req.user.role === 'TEACHER') {
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: req.user.id },
        select: { classId: true }
      })
      where.id = { in: assignments.map(a => a.classId) }
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        grade: true,
        _count: { select: { students: true } },
        teacherAssignments: {
          include: {
            teacher: { select: { id: true, fullName: true } },
            subject: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    res.json({ data: classes })
  } catch (error) {
    next(error)
  }
})

// GET /classes/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const classInfo = await prisma.class.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        grade: true,
        students: {
          where: { isActive: true },
          orderBy: { fullName: 'asc' }
        },
        teacherAssignments: {
          include: {
            teacher: { select: { id: true, fullName: true } },
            subject: { select: { id: true, name: true } }
          }
        },
        _count: { select: { students: true } }
      }
    })

    if (!classInfo) throw new AppError('Class not found', 404, 'NOT_FOUND')
    res.json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// POST /classes
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty().withMessage('Class name is required'),
  body('gradeId').notEmpty().withMessage('Grade is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, gradeId, academicYear, capacity } = req.body

    const grade = await prisma.grade.findFirst({ where: { id: gradeId, tenantId: req.tenantId } })
    if (!grade) throw new AppError('Grade not found', 404, 'GRADE_NOT_FOUND')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    const classInfo = await prisma.class.create({
      data: {
        tenantId: req.tenantId,
        gradeId,
        name,
        academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        capacity: capacity || settings?.maxClassSize || 40
      },
      include: { grade: true }
    })

    res.status(201).json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// PUT /classes/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { name, gradeId, academicYear, capacity, isActive } = req.body

    const existingClass = await prisma.class.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingClass) throw new AppError('Class not found', 404, 'NOT_FOUND')

    // Validate gradeId belongs to this tenant
    if (gradeId && gradeId !== existingClass.gradeId) {
      const grade = await prisma.grade.findFirst({ where: { id: gradeId, tenantId: req.tenantId } })
      if (!grade) throw new AppError('Grade not found', 404, 'GRADE_NOT_FOUND')
    }

    const classInfo = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(gradeId && { gradeId }),
        ...(academicYear && { academicYear }),
        ...(capacity && { capacity }),
        ...(isActive !== undefined && { isActive })
      },
      include: { grade: true, _count: { select: { students: true } } }
    })

    res.json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// DELETE /classes/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const classInfo = await prisma.class.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { students: true } } }
    })

    if (!classInfo) throw new AppError('Class not found', 404, 'NOT_FOUND')

    if (classInfo._count.students > 0) {
      throw new AppError('Cannot delete class with students', 400, 'CLASS_HAS_STUDENTS')
    }

    await prisma.class.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Class deleted' } })
  } catch (error) {
    next(error)
  }
})

// POST /classes/:id/assign-teacher
router.post('/:id/assign-teacher', authenticate, authorize('SUPER_ADMIN'), [
  body('teacherId').notEmpty(),
  body('subjectId').notEmpty()
], async (req, res, next) => {
  try {
    const { teacherId, subjectId, isHomeroom } = req.body

    // Verify class, teacher, and subject belong to current tenant
    const [cls, teacher, subject] = await Promise.all([
      prisma.class.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }),
      prisma.user.findFirst({ where: { id: teacherId, tenantId: req.tenantId, role: 'TEACHER' } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } })
    ])
    if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
    if (!teacher) throw new AppError('Teacher not found', 404, 'NOT_FOUND')
    if (!subject) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    const assignment = await prisma.teacherAssignment.create({
      data: {
        tenantId: req.tenantId,
        teacherId,
        classId: req.params.id,
        subjectId,
        isHomeroom: isHomeroom || false
      },
      include: {
        teacher: { select: { id: true, fullName: true } },
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } }
      }
    })

    res.status(201).json({ data: assignment })
  } catch (error) {
    next(error)
  }
})

// DELETE /classes/:id/assign-teacher/:assignmentId
router.delete('/:id/assign-teacher/:assignmentId', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existingAssignment = await prisma.teacherAssignment.findFirst({
      where: { id: req.params.assignmentId, tenantId: req.tenantId }
    })
    if (!existingAssignment) throw new AppError('Assignment not found', 404, 'NOT_FOUND')

    await prisma.teacherAssignment.delete({ where: { id: req.params.assignmentId } })
    res.json({ data: { message: 'Assignment removed' } })
  } catch (error) {
    next(error)
  }
})

// GET /classes/:id/students
router.get('/:id/students', authenticate, async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { classId: req.params.id, tenantId: req.tenantId, isActive: true },
      orderBy: { fullName: 'asc' }
    })
    res.json({ data: students })
  } catch (error) {
    next(error)
  }
})

// POST /classes/:id/students - Add student to class
router.post('/:id/students', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { studentId } = req.body

    // Use transaction to prevent race conditions
    const student = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: { _count: { select: { students: true } } }
      })
      if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
      if (cls._count.students >= cls.capacity) {
        throw new AppError('Class is full', 400, 'CLASS_FULL')
      }

      // Verify student belongs to current tenant
      const existingStudent = await tx.student.findFirst({
        where: { id: studentId, tenantId: req.tenantId }
      })
      if (!existingStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

      return tx.student.update({
        where: { id: studentId },
        data: { classId: req.params.id }
      })
    })
    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// DELETE /classes/:id/students/:studentId - Remove student from class
router.delete('/:id/students/:studentId', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existingStudent = await prisma.student.findFirst({
      where: { id: req.params.studentId, tenantId: req.tenantId }
    })
    if (!existingStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    const student = await prisma.student.update({
      where: { id: req.params.studentId },
      data: { classId: null }
    })
    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

module.exports = router
