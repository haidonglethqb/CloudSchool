const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /fees - List all fees for the tenant
router.get('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { category, isActive } = req.query

    const where = {
      tenantId: req.tenantId,
      ...(category && { category }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    }

    const fees = await prisma.fee.findMany({
      where,
      include: {
        grade: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        _count: { select: { studentFees: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const feesWithStats = await Promise.all(
      fees.map(async (fee) => {
        const stats = await prisma.studentFee.aggregate({
          where: { feeId: fee.id },
          _sum: { paidAmount: true, amount: true },
          _count: { _all: true },
        })
        const paidCount = await prisma.studentFee.count({
          where: { feeId: fee.id, status: 'PAID' },
        })
        return {
          ...fee,
          stats: {
            totalStudents: stats._count._all,
            totalAmount: stats._sum.amount || 0,
            totalPaid: stats._sum.paidAmount || 0,
            paidCount,
          },
        }
      })
    )

    res.json({ data: feesWithStats })
  } catch (error) {
    next(error)
  }
})

// GET /fees/parent/my-fees - Get fees for parent's children (must be before /:id)
router.get('/parent/my-fees', authenticate, authorize('PARENT'), async (req, res, next) => {
  try {
    const parentLinks = await prisma.parentStudent.findMany({
      where: { parentId: req.user.id },
      select: { studentId: true },
    })

    const studentIds = parentLinks.map(l => l.studentId)
    if (studentIds.length === 0) {
      return res.json({ data: [] })
    }

    const studentFees = await prisma.studentFee.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        fee: {
          select: {
            id: true, name: true, description: true, category: true,
            isRequired: true, dueDate: true, isActive: true,
          },
        },
        student: {
          select: { id: true, fullName: true, studentCode: true, class: { select: { name: true } } },
        },
      },
      orderBy: [{ fee: { dueDate: 'asc' } }, { student: { fullName: 'asc' } }],
    })

    res.json({ data: studentFees })
  } catch (error) {
    next(error)
  }
})

// GET /fees/:id - Get fee details with student payments
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const fee = await prisma.fee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        grade: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        studentFees: {
          include: {
            student: {
              select: { id: true, fullName: true, studentCode: true, class: { select: { name: true } } },
            },
          },
          orderBy: { student: { fullName: 'asc' } },
        },
      },
    })

    if (!fee) throw new AppError('Fee not found', 404, 'NOT_FOUND')

    res.json({ data: fee })
  } catch (error) {
    next(error)
  }
})

// POST /fees - Create a fee and assign to students
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), [
  body('name').notEmpty().withMessage('Fee name is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be >= 0'),
  body('category').isIn(['TUITION', 'ACTIVITY', 'FACILITY', 'OTHER']).withMessage('Invalid category'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, description, amount, category, isRequired, dueDate, gradeId, classId, semesterId } = req.body

    const fee = await prisma.fee.create({
      data: {
        tenantId: req.tenantId,
        name,
        description,
        amount,
        category,
        isRequired: isRequired !== false,
        dueDate: dueDate ? new Date(dueDate) : null,
        gradeId: gradeId || null,
        classId: classId || null,
        semesterId: semesterId || null,
      },
      include: {
        grade: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
      },
    })

    // Auto-assign to applicable students
    const studentWhere = { tenantId: req.tenantId, isActive: true }
    if (classId) {
      studentWhere.classId = classId
    } else if (gradeId) {
      studentWhere.class = { gradeId }
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    })

    if (students.length > 0) {
      await prisma.studentFee.createMany({
        data: students.map(s => ({
          tenantId: req.tenantId,
          feeId: fee.id,
          studentId: s.id,
          amount: fee.amount,
        })),
        skipDuplicates: true,
      })
    }

    res.status(201).json({ data: fee, assignedCount: students.length })
  } catch (error) {
    next(error)
  }
})

// PUT /fees/:id - Update a fee
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.fee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!existing) throw new AppError('Fee not found', 404, 'NOT_FOUND')

    const { name, description, amount, category, isRequired, dueDate, isActive } = req.body

    const fee = await prisma.fee.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount }),
        ...(category && { category }),
        ...(isRequired !== undefined && { isRequired }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        grade: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
      },
    })

    res.json({ data: fee })
  } catch (error) {
    next(error)
  }
})

// DELETE /fees/:id - Delete a fee
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.fee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!existing) throw new AppError('Fee not found', 404, 'NOT_FOUND')

    await prisma.fee.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Fee deleted' } })
  } catch (error) {
    next(error)
  }
})

// PATCH /fees/:id/students/:studentId - Update a student's payment status
router.patch('/:id/students/:studentId', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { status, paidAmount, note } = req.body

    const fee = await prisma.fee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!fee) throw new AppError('Fee not found', 404, 'NOT_FOUND')

    const studentFee = await prisma.studentFee.findUnique({
      where: { feeId_studentId: { feeId: req.params.id, studentId: req.params.studentId } },
    })
    if (!studentFee) throw new AppError('Student fee record not found', 404, 'NOT_FOUND')

    const updateData = {}
    if (status) updateData.status = status
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount
    if (note !== undefined) updateData.note = note
    if (status === 'PAID') updateData.paidAt = new Date()

    const updated = await prisma.studentFee.update({
      where: { id: studentFee.id },
      data: updateData,
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        fee: { select: { id: true, name: true, amount: true } },
      },
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// POST /fees/:id/assign - Manually assign fee to specific students
router.post('/:id/assign', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { studentIds } = req.body
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('studentIds array is required', 400, 'INVALID_INPUT')
    }

    const fee = await prisma.fee.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!fee) throw new AppError('Fee not found', 404, 'NOT_FOUND')

    // Verify all students belong to current tenant
    const validStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, tenantId: req.tenantId },
      select: { id: true }
    })
    const validStudentIds = validStudents.map(s => s.id)
    if (validStudentIds.length === 0) {
      throw new AppError('No valid students found', 400, 'INVALID_INPUT')
    }

    await prisma.studentFee.createMany({
      data: validStudentIds.map(studentId => ({
        tenantId: req.tenantId,
        feeId: fee.id,
        studentId,
        amount: fee.amount,
      })),
      skipDuplicates: true,
    })

    res.json({ data: { message: `Assigned fee to ${validStudentIds.length} students` } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
