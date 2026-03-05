const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Generate student code
const generateStudentCode = async (tenantId) => {
  const count = await prisma.student.count({ where: { tenantId } })
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
        where: { teacherId: req.user.id },
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
router.get('/:id', authenticate, async (req, res, next) => {
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

    const { fullName, gender, dateOfBirth, address, phone, parentName, parentPhone, classId } = req.body

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

    // Check class capacity
    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, tenantId: req.tenantId },
        include: { _count: { select: { students: true } } }
      })
      if (!cls) throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')
      if (cls._count.students >= cls.capacity) {
        throw new AppError(`Class ${cls.name} is full (max: ${cls.capacity})`, 400, 'CLASS_FULL')
      }
    }

    const studentCode = await generateStudentCode(req.tenantId)

    const student = await prisma.student.create({
      data: {
        tenantId: req.tenantId,
        studentCode,
        fullName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        address,
        phone,
        parentName,
        parentPhone,
        classId
      },
      include: { class: { include: { grade: true } } }
    })

    res.status(201).json({ data: student })
  } catch (error) {
    next(error)
  }
})

// PUT /students/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { fullName, gender, dateOfBirth, address, phone, parentName, parentPhone, classId, isActive } = req.body

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

    // Check class capacity if transferring
    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, tenantId: req.tenantId },
        include: { _count: { select: { students: true } } }
      })
      if (cls && cls._count.students >= cls.capacity) {
        throw new AppError(`Class ${cls.name} is full`, 400, 'CLASS_FULL')
      }
    }

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
    // Cannot delete if scores exist
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

    const cls = await prisma.class.findFirst({
      where: { id: classId, tenantId: req.tenantId },
      include: { _count: { select: { students: true } } }
    })
    if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
    if (cls._count.students >= cls.capacity) {
      throw new AppError('Target class is full', 400, 'CLASS_FULL')
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { classId },
      include: { class: { include: { grade: true } } }
    })

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

module.exports = router
