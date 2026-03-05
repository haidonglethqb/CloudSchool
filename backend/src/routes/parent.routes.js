const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult, param } = require('express-validator')
const prisma = require('../lib/prisma')
const { AppError } = require('../middleware/errorHandler')
const { authenticate, authorize } = require('../middleware/auth')

router.use(authenticate)

// Helper: weighted average from scores with scoreComponent
function calcWeightedAverage (scores) {
  let weightedSum = 0; let totalWeight = 0
  for (const s of scores) {
    if (s.scoreComponent) {
      weightedSum += s.value * s.scoreComponent.weight
      totalWeight += s.scoreComponent.weight
    }
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
}

// ==================== PARENT SELF-SERVICE ====================

// GET /parents/semesters
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

// GET /parents/my-children
router.get('/my-children', authorize('PARENT'), async (req, res, next) => {
  try {
    const children = await prisma.parentStudent.findMany({
      where: { parentId: req.user.id },
      include: { student: { include: { class: { include: { grade: true } } } } }
    })

    res.json({
      data: children.map(c => ({
        id: c.student.id,
        studentCode: c.student.studentCode,
        fullName: c.student.fullName,
        gender: c.student.gender,
        dateOfBirth: c.student.dateOfBirth,
        class: c.student.class ? { id: c.student.class.id, name: c.student.class.name, grade: c.student.class.grade?.name } : null,
        relationship: c.relationship,
        isPrimary: c.isPrimary
      }))
    })
  } catch (error) {
    next(error)
  }
})

// GET /parents/my-children/:studentId/scores
router.get('/my-children/:studentId/scores', authorize('PARENT'), async (req, res, next) => {
  try {
    const { studentId } = req.params
    const { semesterId } = req.query

    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: req.user.id, studentId } }
    })
    if (!link) throw new AppError('Access denied', 403, 'FORBIDDEN')

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { include: { grade: true } } }
    })

    const where = { studentId }
    if (semesterId) where.semesterId = semesterId

    const scores = await prisma.score.findMany({
      where,
      include: { subject: true, semester: true, scoreComponent: true },
      orderBy: [{ semester: { year: 'desc' } }, { subject: { name: 'asc' } }]
    })

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.user.tenantId } })

    // Group by semester + subject
    const grouped = {}
    for (const score of scores) {
      const key = `${score.semesterId}-${score.subjectId}`
      if (!grouped[key]) {
        grouped[key] = {
          semester: { id: score.semester.id, name: score.semester.name, year: score.semester.year },
          subject: { id: score.subject.id, name: score.subject.name },
          scores: []
        }
      }
      grouped[key].scores.push(score)
    }

    const result = Object.values(grouped).map(item => {
      const average = calcWeightedAverage(item.scores)
      return {
        ...item,
        scores: item.scores.map(s => ({
          id: s.id,
          component: s.scoreComponent?.name,
          weight: s.scoreComponent?.weight,
          value: s.value
        })),
        average,
        isPassing: average !== null ? average >= (settings?.passScore || 5.0) : null
      }
    })

    res.json({
      data: {
        student: {
          id: student.id, fullName: student.fullName, studentCode: student.studentCode,
          class: student.class?.name, grade: student.class?.grade?.name
        },
        scores: result
      }
    })
  } catch (error) {
    next(error)
  }
})

// ==================== ADMIN ROUTES ====================

// GET /parents
router.get('/', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = { tenantId: req.tenantId, role: 'PARENT' }
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
        include: { children: { include: { student: { include: { class: true } } } } },
        skip, take: parseInt(limit),
        orderBy: { fullName: 'asc' }
      }),
      prisma.user.count({ where })
    ])

    res.json({
      data: parents.map(p => ({
        id: p.id, email: p.email, fullName: p.fullName, phone: p.phone, isActive: p.isActive,
        children: p.children.map(c => ({
          id: c.student.id, fullName: c.student.fullName, studentCode: c.student.studentCode,
          className: c.student.class?.name, relationship: c.relationship
        })),
        createdAt: p.createdAt
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

// POST /parents
router.post('/', authorize('SUPER_ADMIN', 'STAFF'), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('studentIds').isArray({ min: 1 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { email, password, fullName, phone, studentIds, relationships = [] } = req.body

    const existing = await prisma.user.findFirst({
      where: { tenantId: req.tenantId, email }
    })
    if (existing) throw new AppError('Email already exists', 409, 'DUPLICATE')

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, tenantId: req.tenantId }
    })
    if (students.length !== studentIds.length) throw new AppError('Some students not found', 404, 'NOT_FOUND')

    const hashedPassword = await bcrypt.hash(password, 10)

    const parent = await prisma.user.create({
      data: {
        tenantId: req.tenantId, email, password: hashedPassword,
        fullName, phone, role: 'PARENT',
        children: {
          create: studentIds.map((studentId, i) => ({
            studentId, relationship: relationships[i] || 'PARENT', isPrimary: i === 0
          }))
        }
      },
      include: { children: { include: { student: { include: { class: true } } } } }
    })

    res.status(201).json({ data: { id: parent.id, email: parent.email, fullName: parent.fullName, role: parent.role } })
  } catch (error) {
    next(error)
  }
})

// PUT /parents/:id
router.put('/:id', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { email, fullName, phone, isActive, password } = req.body
    const parent = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, role: 'PARENT' } })
    if (!parent) throw new AppError('Parent not found', 404, 'NOT_FOUND')

    const updateData = {}
    if (email) updateData.email = email
    if (fullName) updateData.fullName = fullName
    if (phone !== undefined) updateData.phone = phone
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const updated = await prisma.user.update({ where: { id: req.params.id }, data: updateData })
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// POST /parents/:id/students - Link student
router.post('/:id/students', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { studentId, relationship = 'PARENT' } = req.body
    await prisma.parentStudent.create({ data: { parentId: req.params.id, studentId, relationship } })
    res.status(201).json({ data: { message: 'Student linked' } })
  } catch (error) {
    next(error)
  }
})

// DELETE /parents/:id/students/:studentId - Unlink student
router.delete('/:id/students/:studentId', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    await prisma.parentStudent.delete({
      where: { parentId_studentId: { parentId: req.params.id, studentId: req.params.studentId } }
    })
    res.json({ data: { message: 'Student unlinked' } })
  } catch (error) {
    next(error)
  }
})

// DELETE /parents/:id
router.delete('/:id', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const parent = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, role: 'PARENT' } })
    if (!parent) throw new AppError('Parent not found', 404, 'NOT_FOUND')
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Parent deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
