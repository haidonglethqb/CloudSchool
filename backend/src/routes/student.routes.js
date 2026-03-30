const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Generate student code
const generateStudentCode = async (tenantId, tx) => {
  const client = tx || prisma
  const count = await client.student.count({ where: { tenantId } })
  const year = new Date().getFullYear().toString().slice(-2)
  return `HS${year}${String(count + 1).padStart(4, '0')}`
}

// GET /students
router.get('/', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, classId, status } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentCode: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(classId && { classId }),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'inactive' && { isActive: false })
    }

    // Teacher can only see students in assigned classes
    if (req.user.role === 'TEACHER') {
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: req.user.id, tenantId: req.tenantId },
        select: { classId: true }
      })
      where.classId = { in: assignments.map(a => a.classId) }
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { class: { include: { grade: true } } },
        orderBy: { fullName: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.student.count({ where })
    ])

    res.json({
      data: students,
      meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

// GET /students/:id
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        class: { include: { grade: true } },
        scores: { include: { subject: true, semester: true, scoreComponent: true } }
      }
    })

    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')
    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// POST /students
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('fullName').notEmpty().withMessage('Name is required'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Invalid gender'),
  body('dateOfBirth').isISO8601().withMessage('Invalid date'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { fullName, gender, dateOfBirth, address, phone, parentName, parentPhone, classId, email, admissionDate } = req.body

    // Validate age
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--

    if (age < settings.minAge || age > settings.maxAge) {
      throw new AppError(`Student age (${age}) must be between ${settings.minAge}-${settings.maxAge}`, 400, 'INVALID_AGE')
    }

    // Use transaction to prevent race conditions
    const student = await prisma.$transaction(async (tx) => {
      // Check class capacity inside transaction
      if (classId) {
        const cls = await tx.class.findFirst({
          where: { id: classId, tenantId: req.tenantId },
          include: { _count: { select: { students: true } } }
        })
        if (!cls) throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')
        if (cls._count.students >= cls.capacity) {
          throw new AppError(`Class ${cls.name} is full (max: ${cls.capacity})`, 400, 'CLASS_FULL')
        }
      }

      const studentCode = await generateStudentCode(req.tenantId, tx)

      const newStudent = await tx.student.create({
        data: {
          tenantId: req.tenantId,
          studentCode,
          fullName,
          gender,
          dateOfBirth: new Date(dateOfBirth),
          email: email || null,
          address,
          phone,
          parentName,
          parentPhone,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          classId
        },
        include: { class: { include: { grade: true } } }
      })

      // Create enrollment if student is assigned to a class
      if (classId) {
        const activeSemester = await tx.semester.findFirst({
          where: { tenantId: req.tenantId, isActive: true }
        })
        if (activeSemester) {
          // Find or infer academicYearId
          let academicYearId = activeSemester.academicYearId
          if (!academicYearId) {
            // Try to find matching academic year by year string (e.g., "2024-2025")
            const yearMatch = activeSemester.year.match(/(\d{4})-(\d{4})/)
            if (yearMatch) {
              const [, startYear, endYear] = yearMatch
              const ay = await tx.academicYear.findFirst({
                where: {
                  tenantId: req.tenantId,
                  startYear: parseInt(startYear),
                  endYear: parseInt(endYear)
                }
              })
              academicYearId = ay?.id
            }
          }
          // Create enrollment only if we have academicYearId
          if (academicYearId) {
            await tx.classEnrollment.create({
              data: {
                tenantId: req.tenantId,
                studentId: newStudent.id,
                classId,
                semesterId: activeSemester.id,
                academicYearId
              }
            })
          }
        }
      }

      return newStudent
    })

    res.status(201).json({ data: student })
  } catch (error) {
    next(error)
  }
})

// PUT /students/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { fullName, gender, dateOfBirth, address, phone, parentName, parentPhone, classId, isActive, email, admissionDate } = req.body

    const updateData = {}
    if (fullName) updateData.fullName = fullName
    if (gender) updateData.gender = gender
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth)
    if (address !== undefined) updateData.address = address
    if (phone !== undefined) updateData.phone = phone
    if (parentName !== undefined) updateData.parentName = parentName
    if (parentPhone !== undefined) updateData.parentPhone = parentPhone
    if (classId !== undefined) updateData.classId = classId
    if (isActive !== undefined) updateData.isActive = isActive
    if (email !== undefined) updateData.email = email
    if (admissionDate) updateData.admissionDate = new Date(admissionDate)

    const existingStudent = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    // Prevent classId change via PUT - must use transfer endpoint
    if (classId !== undefined && classId !== existingStudent.classId) {
      throw new AppError('Không thể đổi lớp qua API này. Hãy sử dụng chức năng chuyển lớp.', 400, 'USE_TRANSFER')
    }
    delete updateData.classId

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: updateData,
      include: { class: { include: { grade: true } } }
    })

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// DELETE /students/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existingStudent = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    const scoreCount = await prisma.score.count({ where: { studentId: req.params.id } })
    if (scoreCount > 0) {
      throw new AppError('Cannot delete student with score records', 400, 'HAS_SCORES')
    }

    await prisma.student.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Student deleted' } })
  } catch (error) {
    next(error)
  }
})

// POST /students/:id/transfer - Transfer class
router.post('/:id/transfer', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const classId = req.body.classId || req.body.newClassId
    const { reason } = req.body

    if (!classId) {
      throw new AppError('Target class ID is required', 400, 'MISSING_PARAMS')
    }

    // Get current student
    const currentStudent = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!currentStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    if (!currentStudent.isActive) {
      throw new AppError('Cannot transfer inactive student', 400, 'STUDENT_INACTIVE')
    }

    const fromClassId = currentStudent.classId
    if (fromClassId === classId) {
      throw new AppError('Student is already in this class', 400, 'SAME_CLASS')
    }

    // Check target class
    const cls = await prisma.class.findFirst({
      where: { id: classId, tenantId: req.tenantId },
      include: { _count: { select: { students: true } } }
    })
    if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
    if (cls._count.students >= cls.capacity) {
      throw new AppError('Target class is full', 400, 'CLASS_FULL')
    }

    // Find active semester for enrollment + transfer history
    const activeSemester = await prisma.semester.findFirst({
      where: { tenantId: req.tenantId, isActive: true }
    })

    // Update student, record transfer, and update enrollment in a single transaction
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: req.params.id },
        data: { classId },
        include: { class: { include: { grade: true } } }
      })

      if (fromClassId) {
        await tx.transferHistory.create({
          data: {
            tenantId: req.tenantId,
            studentId: req.params.id,
            fromClassId,
            toClassId: classId,
            semesterId: activeSemester?.id || null,
            reason: reason || null,
            transferredBy: req.user.id
          }
        })
      }

      // Create/update enrollment for new class
      if (activeSemester) {
        let academicYearId = activeSemester.academicYearId
        if (!academicYearId) {
          const yearMatch = activeSemester.year.match(/(\d{4})-(\d{4})/)
          if (yearMatch) {
            const [, startYear, endYear] = yearMatch
            const ay = await tx.academicYear.findFirst({
              where: {
                tenantId: req.tenantId,
                startYear: parseInt(startYear),
                endYear: parseInt(endYear)
              }
            })
            academicYearId = ay?.id
          }
        }
        if (academicYearId) {
          await tx.classEnrollment.upsert({
            where: {
              studentId_semesterId: {
                studentId: req.params.id,
                semesterId: activeSemester.id
              }
            },
            create: {
              tenantId: req.tenantId,
              studentId: req.params.id,
              classId,
              semesterId: activeSemester.id,
              academicYearId
            },
            update: { classId }
          })
        }
      }
    })

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { class: { include: { grade: true } } }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'TRANSFER_STUDENT',
        entity: 'Student',
        entityId: req.params.id,
        details: JSON.stringify({ fromClassId, toClassId: classId, reason })
      }
    })

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// GET /students/:id/transfer-history
router.get('/:id/transfer-history', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const history = await prisma.transferHistory.findMany({
      where: { studentId: req.params.id, tenantId: req.tenantId },
      include: {
        fromClass: { include: { grade: true } },
        toClass: { include: { grade: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ data: history })
  } catch (error) {
    next(error)
  }
})

module.exports = router
