const express = require('express')
const router = express.Router()
const { body, query, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Validation for student creation (BM1)
const validateStudent = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Invalid gender'),
  body('dateOfBirth').isISO8601().withMessage('Invalid date format'),
  body('email').optional().isEmail().withMessage('Invalid email format')
]

// Helper function to validate age (QD1)
const validateAge = async (tenantId, dateOfBirth) => {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId }
  })
  
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  if (age < settings.minAge || age > settings.maxAge) {
    throw new AppError(
      `Student age must be between ${settings.minAge} and ${settings.maxAge} years`,
      400,
      'INVALID_AGE'
    )
  }
  
  return age
}

// Generate student code
const generateStudentCode = async (tenantId) => {
  const count = await prisma.student.count({ where: { tenantId } })
  const year = new Date().getFullYear().toString().slice(-2)
  return `HS${year}${String(count + 1).padStart(4, '0')}`
}

// Get all students (BM3)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, classId, gradeId } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      isActive: true,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentCode: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(classId && { classId }),
      ...(gradeId && { class: { gradeId } })
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: {
            include: { grade: true }
          }
        },
        orderBy: { fullName: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.student.count({ where })
    ])

    res.json({
      data: students,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get student by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { 
        id: req.params.id,
        tenantId: req.tenantId
      },
      include: {
        class: {
          include: { grade: true }
        },
        scores: {
          include: {
            subject: true,
            semester: true
          }
        }
      }
    })

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND')
    }

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// Create new student (BM1 - Tiếp nhận học sinh)
router.post('/', authenticate, validateStudent, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { fullName, gender, dateOfBirth, address, email, phone, classId } = req.body

    // Validate age (QD1)
    await validateAge(req.tenantId, dateOfBirth)

    // Check class capacity if classId provided (QD2)
    if (classId) {
      const classInfo = await prisma.class.findFirst({
        where: { id: classId, tenantId: req.tenantId },
        include: { _count: { select: { students: true } } }
      })

      if (!classInfo) {
        throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')
      }

      if (classInfo._count.students >= classInfo.maxStudents) {
        throw new AppError(
          `Class ${classInfo.name} is full (max: ${classInfo.maxStudents})`,
          400,
          'CLASS_FULL'
        )
      }
    }

    // Generate student code
    const studentCode = await generateStudentCode(req.tenantId)

    const student = await prisma.student.create({
      data: {
        tenantId: req.tenantId,
        studentCode,
        fullName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        address,
        email,
        phone,
        classId
      },
      include: {
        class: {
          include: { grade: true }
        }
      }
    })

    res.status(201).json({ data: student })
  } catch (error) {
    next(error)
  }
})

// Update student
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { fullName, gender, dateOfBirth, address, email, phone, classId } = req.body

    // Validate age if dateOfBirth is being updated
    if (dateOfBirth) {
      await validateAge(req.tenantId, dateOfBirth)
    }

    // Check class capacity if classId is being updated
    if (classId) {
      const classInfo = await prisma.class.findFirst({
        where: { id: classId, tenantId: req.tenantId },
        include: { _count: { select: { students: true } } }
      })

      if (!classInfo) {
        throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')
      }

      const currentStudent = await prisma.student.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId }
      })

      // Only check capacity if student is moving to a different class
      if (currentStudent.classId !== classId && classInfo._count.students >= classInfo.maxStudents) {
        throw new AppError(
          `Class ${classInfo.name} is full (max: ${classInfo.maxStudents})`,
          400,
          'CLASS_FULL'
        )
      }
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        fullName,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address,
        email,
        phone,
        classId
      },
      include: {
        class: {
          include: { grade: true }
        }
      }
    })

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// Delete student (soft delete)
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.student.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })

    res.json({ data: { message: 'Student deleted successfully' } })
  } catch (error) {
    next(error)
  }
})

// Get student with grades summary (BM3)
router.get('/:id/grades', authenticate, async (req, res, next) => {
  try {
    const { semesterId } = req.query

    const student = await prisma.student.findFirst({
      where: { 
        id: req.params.id,
        tenantId: req.tenantId
      },
      include: {
        class: true,
        scores: {
          where: semesterId ? { semesterId } : {},
          include: {
            subject: true,
            semester: true
          }
        }
      }
    })

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND')
    }

    // Get settings for calculating weighted average
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    // Calculate average per subject
    const subjects = await prisma.subject.findMany({
      where: { tenantId: req.tenantId, isActive: true }
    })

    const gradesBySubject = subjects.map(subject => {
      const subjectScores = student.scores.filter(s => s.subjectId === subject.id)
      
      const quiz15Scores = subjectScores.filter(s => s.scoreType === 'QUIZ_15').map(s => s.value)
      const quiz45Scores = subjectScores.filter(s => s.scoreType === 'QUIZ_45').map(s => s.value)
      const finalScores = subjectScores.filter(s => s.scoreType === 'FINAL').map(s => s.value)

      const avg15 = quiz15Scores.length > 0 ? quiz15Scores.reduce((a, b) => a + b, 0) / quiz15Scores.length : null
      const avg45 = quiz45Scores.length > 0 ? quiz45Scores.reduce((a, b) => a + b, 0) / quiz45Scores.length : null
      const avgFinal = finalScores.length > 0 ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length : null

      // Calculate weighted average
      let totalWeight = 0
      let weightedSum = 0

      if (avg15 !== null) {
        weightedSum += avg15 * settings.quiz15Weight
        totalWeight += settings.quiz15Weight
      }
      if (avg45 !== null) {
        weightedSum += avg45 * settings.quiz45Weight
        totalWeight += settings.quiz45Weight
      }
      if (avgFinal !== null) {
        weightedSum += avgFinal * settings.finalWeight
        totalWeight += settings.finalWeight
      }

      const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
      const isPassed = average !== null && average >= settings.passScore

      return {
        subject: subject,
        quiz15Average: avg15 ? Math.round(avg15 * 100) / 100 : null,
        quiz45Average: avg45 ? Math.round(avg45 * 100) / 100 : null,
        finalAverage: avgFinal ? Math.round(avgFinal * 100) / 100 : null,
        average,
        isPassed
      }
    })

    // Calculate overall average
    const validAverages = gradesBySubject.filter(g => g.average !== null).map(g => g.average)
    const overallAverage = validAverages.length > 0 
      ? Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 100) / 100
      : null

    res.json({
      data: {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          fullName: student.fullName,
          class: student.class
        },
        gradesBySubject,
        overallAverage,
        passScore: settings.passScore
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
