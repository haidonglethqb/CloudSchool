const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize, tenantGuard } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { getTenantPlanUsage, getTenantPlanLimits } = require('../utils/subscription-limits')
const { getUserAssignmentScope, ensureClassAccess } = require('../utils/assignment-scope')

router.use(authenticate, requireFeature('classes'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('classes'))

const buildAcademicYearLabel = (academicYear) => `${academicYear.startYear}-${academicYear.endYear}`

const getActiveAcademicYear = async (tenantId) => {
  return prisma.academicYear.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true, startYear: true, endYear: true }
  })
}

const buildAcademicYearClassFilter = async (tenantId, { academicYear, academicYearId }) => {
  if (academicYearId) return { academicYearId }
  if (academicYear) return { academicYear }

  const activeYear = await getActiveAcademicYear(tenantId)
  if (!activeYear) {
    return { academicYearId: '__no_active_year__' }
  }
  return { academicYearId: activeYear.id }
}

const getActiveSemesterWithAcademicYear = async (tenantId, tx) => {
  const client = tx || prisma
  const activeSemester = await client.semester.findFirst({
    where: { tenantId, isActive: true },
    include: { academicYear: true },
    orderBy: [{ updatedAt: 'desc' }, { semesterNum: 'asc' }]
  })
  if (!activeSemester || !activeSemester.academicYearId) {
    throw new AppError('Không có học kỳ đang hoạt động hợp lệ', 400, 'NO_ACTIVE_SEMESTER')
  }
  return activeSemester
}

// GET /classes/grades - Get grades with classes
router.get('/grades', tenantGuard, async (req, res, next) => {
  try {
    const yearFilter = await buildAcademicYearClassFilter(req.tenantId, {
      academicYear: req.query.academicYear,
      academicYearId: req.query.academicYearId
    })
    const scope = await getUserAssignmentScope(prisma, req)
    const assignmentClassFilter = scope ? { id: { in: scope.classIds } } : {}

    const grades = await prisma.grade.findMany({
      where: { tenantId: req.tenantId },
      include: {
        classes: {
          where: {
            tenantId: req.tenantId,
            isActive: true,
            ...yearFilter,
            ...assignmentClassFilter
          },
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
router.get('/', async (req, res, next) => {
  try {
    const { gradeId, academicYear, academicYearId } = req.query
    const yearFilter = await buildAcademicYearClassFilter(req.tenantId, { academicYear, academicYearId })

    const where = {
      tenantId: req.tenantId,
      isActive: true,
      ...(gradeId && { gradeId }),
      ...yearFilter
    }

    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) where.id = { in: scope.classIds }

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
router.get('/:id', async (req, res, next) => {
  try {
    await ensureClassAccess(prisma, req, req.params.id)

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
router.post('/', authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty().withMessage('Class name is required'),
  body('gradeId').notEmpty().withMessage('Grade is required'),
  body('academicYearId').optional().isString().notEmpty().withMessage('academicYearId must be a valid string'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, gradeId, academicYearId } = req.body

    const grade = await prisma.grade.findFirst({ where: { id: gradeId, tenantId: req.tenantId } })
    if (!grade) throw new AppError('Grade not found', 404, 'GRADE_NOT_FOUND')

    const targetAcademicYear = academicYearId
      ? await prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId: req.tenantId } })
      : await prisma.academicYear.findFirst({ where: { tenantId: req.tenantId, isActive: true } })

    if (!targetAcademicYear) {
      throw new AppError('No active academic year found', 400, 'NO_ACTIVE_ACADEMIC_YEAR')
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (!settings) throw new AppError('Tenant settings not configured', 404, 'SETTINGS_NOT_FOUND')
    if (grade.level < settings.minGradeLevel || grade.level > settings.maxGradeLevel) {
      throw new AppError(
        `Grade must be between ${settings.minGradeLevel}-${settings.maxGradeLevel}`,
        400,
        'INVALID_GRADE_LEVEL'
      )
    }

    const [usage, limits] = await Promise.all([
      getTenantPlanUsage(prisma, req.tenantId),
      getTenantPlanLimits(prisma, req.tenantId)
    ])
    if (limits && usage.classes + 1 > limits.classes) {
      throw new AppError(`Cannot exceed subscription class limit (${limits.classes})`, 400, 'PLAN_LIMIT_EXCEEDED')
    }
    const academicYearLabel = buildAcademicYearLabel(targetAcademicYear)

    const classInfo = await prisma.class.create({
      data: {
        tenantId: req.tenantId,
        gradeId,
        name,
        academicYearId: targetAcademicYear.id,
        academicYear: academicYearLabel,
        capacity: settings?.maxClassSize || 40
      },
      include: { grade: true }
    })

    res.status(201).json({ data: classInfo })
  } catch (error) {
    next(error)
  }
})

// PUT /classes/:id
router.put('/:id', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
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
      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
      if (!settings) throw new AppError('Tenant settings not configured', 404, 'SETTINGS_NOT_FOUND')
      if (grade.level < settings.minGradeLevel || grade.level > settings.maxGradeLevel) {
        throw new AppError(
          `Grade must be between ${settings.minGradeLevel}-${settings.maxGradeLevel}`,
          400,
          'INVALID_GRADE_LEVEL'
        )
      }
    }

    // Validate capacity is not less than current student count
    if (capacity !== undefined) {
      const cls = await prisma.class.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: { _count: { select: { students: true } } }
      })
      if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
      if (!settings) throw new AppError('Tenant settings not configured', 404, 'SETTINGS_NOT_FOUND')
      if (capacity > settings.maxClassSize) {
        throw new AppError(`Capacity cannot exceed max class size (${settings.maxClassSize})`, 400, 'CAPACITY_EXCEEDS_SETTINGS')
      }
      if (capacity < cls._count.students) {
        throw new AppError(`Capacity (${capacity}) cannot be less than current student count (${cls._count.students})`, 400, 'CAPACITY_TOO_LOW')
      }
    }

    const classInfo = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(gradeId && { gradeId }),
        ...(academicYear && { academicYear }),
        ...(capacity !== undefined && { capacity }),
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
router.delete('/:id', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const classInfo = await prisma.class.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { students: true } } }
    })

    if (!classInfo) throw new AppError('Class not found', 404, 'NOT_FOUND')

    if (classInfo._count.students > 0) {
      throw new AppError('Cannot delete class with students', 400, 'CLASS_HAS_STUDENTS')
    }

    const [assignmentCount, feeCount] = await Promise.all([
      prisma.teacherAssignment.count({ where: { classId: req.params.id } }),
      prisma.fee.count({ where: { classId: req.params.id } })
    ])
    if (assignmentCount > 0) {
      throw new AppError('Cannot delete class with active teacher assignments', 400, 'HAS_ASSIGNMENTS')
    }
    if (feeCount > 0) {
      throw new AppError('Cannot delete class with associated fees', 400, 'HAS_FEES')
    }

    await prisma.class.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Class deleted' } })
  } catch (error) {
    next(error)
  }
})

// POST /classes/:id/assign-teacher
router.post('/:id/assign-teacher', authorize('SUPER_ADMIN'), [
  body('teacherId').notEmpty(),
  body('subjectId').notEmpty()
], async (req, res, next) => {
  try {
    const { teacherId, subjectId, isHomeroom } = req.body

    // Verify class, teacher, and subject belong to current tenant
    const [cls, teacher, subject] = await Promise.all([
      prisma.class.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }),
      prisma.user.findFirst({ where: { id: teacherId, tenantId: req.tenantId, role: { in: ['TEACHER', 'STAFF'] } } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } })
    ])
    if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
    if (!teacher) throw new AppError('Teacher/staff not found', 404, 'NOT_FOUND')
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
router.delete('/:id/assign-teacher/:assignmentId', authorize('SUPER_ADMIN'), async (req, res, next) => {
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
router.get('/:id/students', async (req, res, next) => {
  try {
    await ensureClassAccess(prisma, req, req.params.id)

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
router.post('/:id/students', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { studentId } = req.body

    // Use transaction to prevent race conditions
    const student = await prisma.$transaction(async (tx) => {
      const activeSemester = await getActiveSemesterWithAcademicYear(req.tenantId, tx)

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

      const updatedStudent = await tx.student.update({
        where: { id: studentId },
        data: { classId: req.params.id }
      })

      await tx.classEnrollment.upsert({
        where: {
          studentId_semesterId: {
            studentId,
            semesterId: activeSemester.id
          }
        },
        create: {
          tenantId: req.tenantId,
          studentId,
          classId: req.params.id,
          semesterId: activeSemester.id,
          academicYearId: activeSemester.academicYearId
        },
        update: {
          classId: req.params.id,
          academicYearId: activeSemester.academicYearId
        }
      })

      return updatedStudent
    }, { isolationLevel: 'Serializable' })
    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// DELETE /classes/:id/students/:studentId - Remove student from class
router.delete('/:id/students/:studentId', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
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
