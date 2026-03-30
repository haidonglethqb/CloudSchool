const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /users - List users (SUPER_ADMIN, STAFF)
router.get('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      role: { notIn: ['PLATFORM_ADMIN', 'PARENT', 'STUDENT'] },
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(role && { role }),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'inactive' && { isActive: false })
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, fullName: true, role: true, department: true, phone: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ])

    res.json({
      data: users,
      meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

// GET /users/:id
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: {
        id: true, email: true, fullName: true, role: true, department: true,
        phone: true, isActive: true, createdAt: true, updatedAt: true,
        teacherAssignments: {
          include: { class: true, subject: true }
        }
      }
    })

    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')
    res.json({ data: user })
  } catch (error) {
    next(error)
  }
})

// POST /users - Create user (SUPER_ADMIN only)
router.post('/', authenticate, authorize('SUPER_ADMIN'), [
  body('fullName').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('role').isIn(['SUPER_ADMIN', 'STAFF', 'TEACHER']).withMessage('Invalid role')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { fullName, email, password, role, department, phone } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        tenantId: req.tenantId,
        fullName,
        email,
        password: hashedPassword,
        role,
        department,
        phone
      },
      select: { id: true, email: true, fullName: true, role: true, department: true, isActive: true, createdAt: true }
    })

    res.status(201).json({ data: user })
  } catch (error) {
    next(error)
  }
})

// PUT /users/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { fullName, email, role, department, phone, isActive, password } = req.body

    const updateData = {}
    if (fullName) updateData.fullName = fullName
    if (email) updateData.email = email
    if (role) updateData.role = role
    if (department !== undefined) updateData.department = department
    if (phone !== undefined) updateData.phone = phone
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, email: true, fullName: true, role: true, department: true, isActive: true }
    })

    res.json({ data: user })
  } catch (error) {
    next(error)
  }
})

// PATCH /users/:id/disable
router.patch('/:id/disable', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })
    res.json({ data: { message: 'User disabled' } })
  } catch (error) {
    next(error)
  }
})

// PUT /users/:id/assignments - Manage teacher assignments (SUPER_ADMIN only)
router.put('/:id/assignments', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { assignments } = req.body
    if (!Array.isArray(assignments)) {
      throw new AppError('assignments must be an array', 400, 'INVALID_INPUT')
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId, role: 'TEACHER' },
    })
    if (!targetUser) throw new AppError('Teacher not found', 404, 'NOT_FOUND')

    // Validate all classIds and subjectIds belong to this tenant
    const classIds = [...new Set(assignments.map(a => a.classId))]
    const subjectIds = [...new Set(assignments.map(a => a.subjectId))]
    const [validClasses, validSubjects] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: classIds }, tenantId: req.tenantId }, select: { id: true } }),
      prisma.subject.findMany({ where: { id: { in: subjectIds }, tenantId: req.tenantId }, select: { id: true } })
    ])
    if (validClasses.length !== classIds.length) throw new AppError('One or more classes not found', 404, 'NOT_FOUND')
    if (validSubjects.length !== subjectIds.length) throw new AppError('One or more subjects not found', 404, 'NOT_FOUND')

    // Delete all existing assignments for this teacher
    await prisma.teacherAssignment.deleteMany({
      where: { teacherId: req.params.id },
    })

    // Create new assignments
    if (assignments.length > 0) {
      await prisma.teacherAssignment.createMany({
        data: assignments.map(a => ({
          tenantId: req.tenantId,
          teacherId: req.params.id,
          classId: a.classId,
          subjectId: a.subjectId,
          isHomeroom: a.isHomeroom || false,
        })),
        skipDuplicates: true,
      })
    }

    const updated = await prisma.user.findFirst({
      where: { id: req.params.id },
      select: {
        id: true, fullName: true,
        teacherAssignments: { include: { class: true, subject: true } },
      },
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /users/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      throw new AppError('Cannot delete yourself', 400, 'SELF_DELETE')
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'User deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
