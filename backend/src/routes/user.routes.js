const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize, invalidateUserCache } = require('../middleware/auth')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { isValidVietnamPhone, normalizeVietnamPhone } = require('../utils/phone')
const { assertRoleUserLimit } = require('../utils/subscription-limits')

router.use(authenticate, requireFeature('users'))

// GET /users - List users (SUPER_ADMIN, STAFF)
router.get('/', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('users'), async (req, res, next) => {
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
router.get('/:id', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('users'), async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: {
        id: true, email: true, fullName: true, role: true, department: true,
        phone: true, isActive: true, createdAt: true, updatedAt: true,
        teacherAssignments: {
          include: { class: true, subject: true, semester: true }
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
router.post('/', authorize('SUPER_ADMIN'), [
  body('fullName').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('role').isIn(['SUPER_ADMIN', 'STAFF', 'TEACHER']).withMessage('Invalid role'),
  body('phone').optional({ values: 'falsy' }).custom((value) => {
    if (!isValidVietnamPhone(value)) throw new Error('Phone must be a valid Vietnam phone number (0 + 9 or 10 digits)')
    return true
  })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { fullName, email, password, role, department } = req.body
    const phone = normalizeVietnamPhone(req.body.phone)
    const hashedPassword = await bcrypt.hash(password, 10)
    await assertRoleUserLimit(prisma, req.tenantId, role)

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
router.put('/:id', authorize('SUPER_ADMIN'), [
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional({ values: 'falsy' }).custom((value) => {
    if (!isValidVietnamPhone(value)) throw new Error('Phone must be a valid Vietnam phone number (0 + 9 or 10 digits)')
    return true
  })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { fullName, email, role, department, phone, isActive, password } = req.body
    const normalizedPhone = normalizeVietnamPhone(phone)

    const ALLOWED_TENANT_ROLES = ['SUPER_ADMIN', 'STAFF', 'TEACHER']
    if (role && !ALLOWED_TENANT_ROLES.includes(role)) {
      throw new AppError('Invalid role. Allowed roles: SUPER_ADMIN, STAFF, TEACHER', 400, 'INVALID_ROLE')
    }

    const updateData = {}
    if (fullName) updateData.fullName = fullName
    if (email) updateData.email = email
    if (role) updateData.role = role
    if (department !== undefined) updateData.department = department
    if (phone !== undefined) updateData.phone = normalizedPhone
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    // Prevent self-disable
    if (req.params.id === req.user.id && isActive === false) {
      throw new AppError('Cannot disable yourself', 400, 'SELF_DISABLE')
    }

    // Check for duplicate email within tenant
    if (email && email !== existingUser.email) {
      const dup = await prisma.user.findFirst({
        where: { tenantId: req.tenantId, email, id: { not: req.params.id } }
      })
      if (dup) throw new AppError('Email already exists', 409, 'DUPLICATE_EMAIL')
    }

    const effectiveRole = role || existingUser.role
    const effectiveActive = isActive !== undefined ? isActive : existingUser.isActive
    const needsLimitCheck =
      effectiveActive &&
      ['STAFF', 'TEACHER'].includes(effectiveRole) &&
      (effectiveRole !== existingUser.role || existingUser.isActive === false)
    if (needsLimitCheck) {
      await assertRoleUserLimit(prisma, req.tenantId, effectiveRole, req.params.id)
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, email: true, fullName: true, role: true, department: true, isActive: true }
    })

    invalidateUserCache(req.params.id)
    res.json({ data: user })
  } catch (error) {
    next(error)
  }
})

// PATCH /users/:id/disable
router.patch('/:id/disable', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Prevent self-disable
    if (req.params.id === req.user.id) {
      throw new AppError('Cannot disable yourself', 400, 'SELF_DISABLE')
    }
    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })
    invalidateUserCache(req.params.id)
    res.json({ data: { message: 'User disabled' } })
  } catch (error) {
    next(error)
  }
})

// PUT /users/:id/assignments - Manage teacher/staff assignments (SUPER_ADMIN only)
router.put('/:id/assignments', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { assignments } = req.body
    if (!Array.isArray(assignments)) {
      throw new AppError('assignments must be an array', 400, 'INVALID_INPUT')
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId, role: { in: ['TEACHER', 'STAFF'] } },
    })
    if (!targetUser) throw new AppError('Teacher/staff not found', 404, 'NOT_FOUND')

    // Validate all classIds, subjectIds, and semesterIds belong to this tenant
    if (assignments.some((assignment) => !assignment.classId || !assignment.subjectId || !assignment.semesterId)) {
      throw new AppError('Each assignment must include classId, subjectId, and semesterId', 400, 'INVALID_INPUT')
    }

    const classIds = [...new Set(assignments.map(a => a.classId))]
    const subjectIds = [...new Set(assignments.map(a => a.subjectId))]
    const semesterIds = [...new Set(assignments.map(a => a.semesterId))]
    const [validClasses, validSubjects, validSemesters] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: classIds }, tenantId: req.tenantId }, select: { id: true, academicYearId: true, academicYear: true } }),
      prisma.subject.findMany({ where: { id: { in: subjectIds }, tenantId: req.tenantId }, select: { id: true } }),
      prisma.semester.findMany({ where: { id: { in: semesterIds }, tenantId: req.tenantId }, select: { id: true, academicYearId: true, year: true } })
    ])
    if (validClasses.length !== classIds.length) throw new AppError('One or more classes not found', 404, 'NOT_FOUND')
    if (validSubjects.length !== subjectIds.length) throw new AppError('One or more subjects not found', 404, 'NOT_FOUND')
    if (validSemesters.length !== semesterIds.length) throw new AppError('One or more semesters not found', 404, 'NOT_FOUND')

    const classMap = new Map(validClasses.map((item) => [item.id, item]))
    const semesterMap = new Map(validSemesters.map((item) => [item.id, item]))
    const invalidAssignment = assignments.find((assignment) => {
      const classItem = classMap.get(assignment.classId)
      const semester = semesterMap.get(assignment.semesterId)
      if (!classItem || !semester) return true
      return classItem.academicYearId
        ? classItem.academicYearId !== semester.academicYearId
        : classItem.academicYear !== semester.year
    })
    if (invalidAssignment) {
      throw new AppError('Class assignment must belong to the selected semester academic year', 400, 'CLASS_SEMESTER_MISMATCH')
    }

    // Delete all existing assignments for this teacher, then create new ones atomically
    await prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.deleteMany({
        where: { teacherId: req.params.id, tenantId: req.tenantId },
      })

      if (assignments.length > 0) {
        await tx.teacherAssignment.createMany({
          data: assignments.map(a => ({
            tenantId: req.tenantId,
            teacherId: req.params.id,
            classId: a.classId,
            semesterId: a.semesterId,
            subjectId: a.subjectId,
            isHomeroom: a.isHomeroom || false,
          })),
          skipDuplicates: true,
        })
      }
    })

    const updated = await prisma.user.findFirst({
      where: { id: req.params.id },
      select: {
        id: true, fullName: true,
        teacherAssignments: { include: { class: true, subject: true, semester: true } },
      },
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /users/:id
router.delete('/:id', authorize('SUPER_ADMIN'), async (req, res, next) => {
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
    invalidateUserCache(req.params.id)
    res.json({ data: { message: 'User deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
