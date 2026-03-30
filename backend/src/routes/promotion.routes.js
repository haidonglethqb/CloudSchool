const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /promotion - List promotions
router.get('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { semesterId, classId } = req.query

    const where = {
      tenantId: req.tenantId,
      ...(semesterId && { semesterId }),
      ...(classId && { classId })
    }

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        class: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, year: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ data: promotions })
  } catch (error) {
    next(error)
  }
})

// POST /promotion/calculate - Calculate promotions for a class or all classes
router.post('/calculate', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { classId, semesterId } = req.body

    if (!semesterId) {
      throw new AppError('semesterId is required', 400, 'MISSING_PARAMS')
    }

    // Validate semester belongs to this tenant
    const semesterCheck = await prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
    if (!semesterCheck) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    // If classId provided, validate it; otherwise calculate for all classes
    let classIds = []
    if (classId) {
      const classCheck = await prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId } })
      if (!classCheck) throw new AppError('Class not found', 404, 'NOT_FOUND')
      classIds = [classId]
    } else {
      const allClasses = await prisma.class.findMany({
        where: { tenantId: req.tenantId, isActive: true },
        select: { id: true }
      })
      classIds = allClasses.map(c => c.id)
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    // Get all students in target classes
    const students = await prisma.student.findMany({
      where: { classId: { in: classIds }, tenantId: req.tenantId, isActive: true },
      include: {
        scores: {
          where: { semesterId },
          include: { scoreComponent: true, subject: true }
        }
      }
    })

    const results = []

    for (const student of students) {
      // Group scores by subject
      const subjectScores = {}
      for (const score of student.scores) {
        if (!subjectScores[score.subjectId]) {
          subjectScores[score.subjectId] = []
        }
        subjectScores[score.subjectId].push(score)
      }

      // Calculate weighted average per subject
      const subjectAverages = []
      for (const [, scores] of Object.entries(subjectScores)) {
        let weightedSum = 0
        let totalWeight = 0
        for (const s of scores) {
          weightedSum += s.value * s.scoreComponent.weight
          totalWeight += s.scoreComponent.weight
        }
        if (totalWeight > 0) {
          subjectAverages.push(weightedSum / totalWeight)
        }
      }

      // Overall average
      const average = subjectAverages.length > 0
        ? Math.round((subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length) * 100) / 100
        : null

      // Skip students with no scores
      if (average === null) continue

      // Determine result
      let result = 'PASS'
      if (average < settings.passScore) {
        result = 'FAIL'
      } else if (subjectAverages.some(avg => avg < settings.passScore)) {
        result = 'RETAKE'
      }

      results.push({ studentId: student.id, classId: student.classId, semesterId, average, result })
    }

    // Upsert promotions and handle retentions atomically
    const promotions = await prisma.$transaction(async (tx) => {
      const upserted = []
      for (const r of results) {
        const p = await tx.promotion.upsert({
          where: {
            studentId_classId_semesterId: {
              studentId: r.studentId,
              classId: r.classId,
              semesterId: r.semesterId
            }
          },
          create: { tenantId: req.tenantId, ...r },
          update: { average: r.average, result: r.result },
          include: {
            student: { select: { id: true, fullName: true, studentCode: true } },
            class: { select: { id: true, name: true } }
          }
        })
        upserted.push(p)
      }

      // QĐ9: Auto-deactivate students who exceeded maxRetentions (batch)
      const failStudentIds = upserted.filter(p => p.result === 'FAIL').map(p => p.studentId)
      if (failStudentIds.length > 0) {
        const failCounts = await tx.promotion.groupBy({
          by: ['studentId'],
          where: { studentId: { in: failStudentIds }, tenantId: req.tenantId, result: 'FAIL' },
          _count: { _all: true }
        })

        for (const fc of failCounts) {
          if (fc._count._all >= settings.maxRetentions) {
            await tx.student.update({
              where: { id: fc.studentId },
              data: { isActive: false }
            })
            const promo = upserted.find(p => p.studentId === fc.studentId)
            if (promo) {
              await tx.promotion.update({
                where: { id: promo.id },
                data: { note: `Ngừng tiếp nhận - vượt quá ${settings.maxRetentions} lần lưu ban` }
              })
            }
          }
        }
      }

      return upserted
    })

    res.json({ data: promotions })
  } catch (error) {
    next(error)
  }
})

// PUT /promotion/:id - Update promotion result manually
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { result, note } = req.body

    if (!['PASS', 'FAIL', 'RETAKE'].includes(result)) {
      throw new AppError('Invalid result', 400, 'INVALID_RESULT')
    }

    const existing = await prisma.promotion.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Promotion not found', 404, 'NOT_FOUND')

    const promotion = await prisma.promotion.update({
      where: { id: req.params.id },
      data: { result, note },
      include: {
        student: { select: { id: true, fullName: true } },
        class: { select: { id: true, name: true } }
      }
    })

    res.json({ data: promotion })
  } catch (error) {
    next(error)
  }
})

module.exports = router
