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

// POST /promotion/calculate - Calculate promotions for a class
router.post('/calculate', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { classId, semesterId } = req.body

    if (!classId || !semesterId) {
      throw new AppError('classId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    // Get all students in class
    const students = await prisma.student.findMany({
      where: { classId, isActive: true },
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
      for (const [subjectId, scores] of Object.entries(subjectScores)) {
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
        : 0

      // Determine result
      let result = 'PASS'
      if (average < settings.passScore) {
        result = 'FAIL'
      } else if (subjectAverages.some(avg => avg < settings.passScore)) {
        result = 'RETAKE'
      }

      results.push({ studentId: student.id, classId, semesterId, average, result })
    }

    // Upsert promotions
    const promotions = await Promise.all(
      results.map(r =>
        prisma.promotion.upsert({
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
      )
    )

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
