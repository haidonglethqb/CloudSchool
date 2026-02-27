const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult, param, query } = require('express-validator')
const prisma = require('../lib/prisma')
const { AppError } = require('../middleware/errorHandler')
const { authenticate, authorize } = require('../middleware/auth')

// All routes require authentication
router.use(authenticate)

// ==================== ADMIN ROUTES ====================

// Get all parents in the current tenant
router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      role: 'PARENT'
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [parents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          children: {
            include: {
              student: {
                include: { class: true }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { fullName: 'asc' }
      }),
      prisma.user.count({ where })
    ])

    res.json({
      data: parents.map(p => ({
        id: p.id,
        email: p.email,
        fullName: p.fullName,
        phone: p.phone,
        isActive: p.isActive,
        children: p.children.map(c => ({
          id: c.student.id,
          fullName: c.student.fullName,
          studentCode: c.student.studentCode,
          className: c.student.class?.name,
          relationship: c.relationship
        })),
        createdAt: p.createdAt
      })),
      pagination: {
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

// Create new parent account (Admin only)
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('phone').optional(),
  body('studentIds').isArray({ min: 1 }).withMessage('At least one student must be assigned')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { email, password, fullName, phone, studentIds, relationships = [] } = req.body

    // Check email exists
    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: req.tenantId, email } }
    })
    if (existingUser) {
      throw new AppError('Email already exists', 409, 'DUPLICATE_EMAIL')
    }

    // Verify students belong to same tenant
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: req.tenantId
      }
    })
    if (students.length !== studentIds.length) {
      throw new AppError('Some students not found', 404, 'STUDENTS_NOT_FOUND')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Create parent and link to students
    const parent = await prisma.user.create({
      data: {
        tenantId: req.tenantId,
        email,
        password: hashedPassword,
        fullName,
        phone,
        role: 'PARENT',
        children: {
          create: studentIds.map((studentId, index) => ({
            studentId,
            relationship: relationships[index] || 'PARENT',
            isPrimary: index === 0
          }))
        }
      },
      include: {
        children: {
          include: {
            student: { include: { class: true } }
          }
        }
      }
    })

    res.status(201).json({
      data: {
        id: parent.id,
        email: parent.email,
        fullName: parent.fullName,
        phone: parent.phone,
        role: parent.role,
        children: parent.children.map(c => ({
          id: c.student.id,
          fullName: c.student.fullName,
          studentCode: c.student.studentCode,
          className: c.student.class?.name,
          relationship: c.relationship
        }))
      }
    })
  } catch (error) {
    next(error)
  }
})

// Update parent account
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), [
  param('id').isUUID().withMessage('Invalid parent ID'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('phone').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { id } = req.params
    const { email, fullName, phone, isActive, password } = req.body

    const parent = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId, role: 'PARENT' }
    })

    if (!parent) {
      throw new AppError('Parent not found', 404, 'PARENT_NOT_FOUND')
    }

    const updateData = {}
    if (email) updateData.email = email
    if (fullName) updateData.fullName = fullName
    if (phone !== undefined) updateData.phone = phone
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        children: {
          include: {
            student: { include: { class: true } }
          }
        }
      }
    })

    res.json({
      data: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone,
        isActive: updated.isActive,
        children: updated.children.map(c => ({
          id: c.student.id,
          fullName: c.student.fullName,
          studentCode: c.student.studentCode,
          className: c.student.class?.name,
          relationship: c.relationship
        }))
      }
    })
  } catch (error) {
    next(error)
  }
})

// Link additional student to parent
router.post('/:id/students', authorize('SUPER_ADMIN', 'ADMIN'), [
  param('id').isUUID().withMessage('Invalid parent ID'),
  body('studentId').isUUID().withMessage('Invalid student ID'),
  body('relationship').optional().isIn(['PARENT', 'GUARDIAN', 'OTHER'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { id } = req.params
    const { studentId, relationship = 'PARENT' } = req.body

    // Verify parent exists
    const parent = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId, role: 'PARENT' }
    })
    if (!parent) {
      throw new AppError('Parent not found', 404, 'PARENT_NOT_FOUND')
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId: req.tenantId }
    })
    if (!student) {
      throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND')
    }

    // Check if already linked
    const existing = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: id, studentId } }
    })
    if (existing) {
      throw new AppError('Student already linked to this parent', 409, 'DUPLICATE_LINK')
    }

    await prisma.parentStudent.create({
      data: { parentId: id, studentId, relationship }
    })

    res.status(201).json({
      message: 'Student linked successfully'
    })
  } catch (error) {
    next(error)
  }
})

// Remove student from parent
router.delete('/:id/students/:studentId', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { id, studentId } = req.params

    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: id, studentId } }
    })
    if (!link) {
      throw new AppError('Link not found', 404, 'LINK_NOT_FOUND')
    }

    await prisma.parentStudent.delete({
      where: { parentId_studentId: { parentId: id, studentId } }
    })

    res.json({ message: 'Student unlinked successfully' })
  } catch (error) {
    next(error)
  }
})

// Delete parent account
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params

    const parent = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId, role: 'PARENT' }
    })
    if (!parent) {
      throw new AppError('Parent not found', 404, 'PARENT_NOT_FOUND')
    }

    await prisma.user.delete({ where: { id } })

    res.json({ message: 'Parent deleted successfully' })
  } catch (error) {
    next(error)
  }
})

// ==================== PARENT ROUTES (for parent users) ====================

// Get my children
router.get('/my-children', authorize('PARENT'), async (req, res, next) => {
  try {
    const children = await prisma.parentStudent.findMany({
      where: { parentId: req.user.id },
      include: {
        student: {
          include: {
            class: {
              include: { grade: true }
            }
          }
        }
      }
    })

    res.json({
      data: children.map(c => ({
        id: c.student.id,
        studentCode: c.student.studentCode,
        fullName: c.student.fullName,
        gender: c.student.gender,
        dateOfBirth: c.student.dateOfBirth,
        class: c.student.class ? {
          id: c.student.class.id,
          name: c.student.class.name,
          grade: c.student.class.grade?.name
        } : null,
        relationship: c.relationship,
        isPrimary: c.isPrimary
      }))
    })
  } catch (error) {
    next(error)
  }
})

// Get child's scores
router.get('/my-children/:studentId/scores', authorize('PARENT'), async (req, res, next) => {
  try {
    const { studentId } = req.params
    const { semesterId } = req.query

    // Verify parent has access to this student
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: req.user.id, studentId } }
    })
    if (!link) {
      throw new AppError('You do not have access to this student', 403, 'FORBIDDEN')
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: { include: { grade: true } }
      }
    })

    const whereClause = { studentId }
    if (semesterId) {
      whereClause.semesterId = semesterId
    }

    const scores = await prisma.score.findMany({
      where: whereClause,
      include: {
        subject: true,
        semester: true
      },
      orderBy: [
        { semester: { year: 'desc' } },
        { semester: { semesterNum: 'desc' } },
        { subject: { name: 'asc' } }
      ]
    })

    // Group scores by subject and semester
    const groupedScores = {}
    for (const score of scores) {
      const key = `${score.semesterId}-${score.subjectId}`
      if (!groupedScores[key]) {
        groupedScores[key] = {
          semester: { id: score.semester.id, name: score.semester.name, year: score.semester.year },
          subject: { id: score.subject.id, name: score.subject.name },
          quiz15: [],
          quiz45: [],
          final: null
        }
      }
      if (score.scoreType === 'QUIZ_15') {
        groupedScores[key].quiz15.push(score.value)
      } else if (score.scoreType === 'QUIZ_45') {
        groupedScores[key].quiz45.push(score.value)
      } else if (score.scoreType === 'FINAL') {
        groupedScores[key].final = score.value
      }
    }

    // Get tenant settings for calculation
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.user.tenantId }
    })

    // Calculate averages
    const result = Object.values(groupedScores).map(item => {
      const quiz15Avg = item.quiz15.length > 0 
        ? item.quiz15.reduce((a, b) => a + b, 0) / item.quiz15.length 
        : null
      const quiz45Avg = item.quiz45.length > 0 
        ? item.quiz45.reduce((a, b) => a + b, 0) / item.quiz45.length 
        : null

      let average = null
      if (quiz15Avg !== null && quiz45Avg !== null && item.final !== null && settings) {
        const totalWeight = settings.quiz15Weight + settings.quiz45Weight + settings.finalWeight
        average = (quiz15Avg * settings.quiz15Weight + quiz45Avg * settings.quiz45Weight + item.final * settings.finalWeight) / totalWeight
        average = Math.round(average * 100) / 100
      }

      return {
        ...item,
        quiz15Avg: quiz15Avg !== null ? Math.round(quiz15Avg * 100) / 100 : null,
        quiz45Avg: quiz45Avg !== null ? Math.round(quiz45Avg * 100) / 100 : null,
        average,
        isPassing: average !== null ? average >= (settings?.passScore || 5.0) : null
      }
    })

    res.json({
      data: {
        student: {
          id: student.id,
          fullName: student.fullName,
          studentCode: student.studentCode,
          class: student.class?.name,
          grade: student.class?.grade?.name
        },
        scores: result
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get available semesters for parent to filter
router.get('/semesters', authorize('PARENT'), async (req, res, next) => {
  try {
    const semesters = await prisma.semester.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: [{ year: 'desc' }, { semesterNum: 'desc' }]
    })

    res.json({ data: semesters })
  } catch (error) {
    next(error)
  }
})

module.exports = router
