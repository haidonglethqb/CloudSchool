const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Validation for score (QD4: 0 <= Điểm <= 10)
const validateScore = [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('subjectId').notEmpty().withMessage('Subject ID is required'),
  body('semesterId').notEmpty().withMessage('Semester ID is required'),
  body('scoreType').isIn(['QUIZ_15', 'QUIZ_45', 'FINAL']).withMessage('Invalid score type'),
  body('value').isFloat({ min: 0, max: 10 }).withMessage('Score must be between 0 and 10')
]

// Get scores by class and subject (BM4 - Bảng điểm môn học)
router.get('/class/:classId', authenticate, async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query

    if (!subjectId || !semesterId) {
      throw new AppError('Subject ID and Semester ID are required', 400, 'MISSING_PARAMS')
    }

    // Get all students in class
    const students = await prisma.student.findMany({
      where: {
        classId: req.params.classId,
        isActive: true
      },
      orderBy: { fullName: 'asc' }
    })

    // Get settings for grade calculation
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    // Get scores for each student
    const studentsWithScores = await Promise.all(
      students.map(async (student) => {
        const scores = await prisma.score.findMany({
          where: {
            studentId: student.id,
            subjectId,
            semesterId
          }
        })

        const quiz15Scores = scores.filter(s => s.scoreType === 'QUIZ_15')
        const quiz45Scores = scores.filter(s => s.scoreType === 'QUIZ_45')
        const finalScores = scores.filter(s => s.scoreType === 'FINAL')

        // Calculate averages
        const avg15 = quiz15Scores.length > 0 
          ? quiz15Scores.reduce((sum, s) => sum + s.value, 0) / quiz15Scores.length 
          : null
        const avg45 = quiz45Scores.length > 0 
          ? quiz45Scores.reduce((sum, s) => sum + s.value, 0) / quiz45Scores.length 
          : null
        const avgFinal = finalScores.length > 0 
          ? finalScores.reduce((sum, s) => sum + s.value, 0) / finalScores.length 
          : null

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

        return {
          student,
          scores: {
            quiz15: quiz15Scores,
            quiz45: quiz45Scores,
            final: finalScores
          },
          averages: {
            quiz15: avg15 ? Math.round(avg15 * 100) / 100 : null,
            quiz45: avg45 ? Math.round(avg45 * 100) / 100 : null,
            final: avgFinal ? Math.round(avgFinal * 100) / 100 : null,
            total: average
          },
          isPassed: average !== null && average >= settings.passScore
        }
      })
    )

    // Get class and subject info
    const [classInfo, subject, semester] = await Promise.all([
      prisma.class.findUnique({ where: { id: req.params.classId }, include: { grade: true } }),
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.semester.findUnique({ where: { id: semesterId } })
    ])

    res.json({
      data: {
        class: classInfo,
        subject,
        semester,
        students: studentsWithScores,
        settings: {
          quiz15Weight: settings.quiz15Weight,
          quiz45Weight: settings.quiz45Weight,
          finalWeight: settings.finalWeight,
          passScore: settings.passScore
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// Add/Update score
router.post('/', authenticate, validateScore, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { studentId, subjectId, semesterId, scoreType, value, note } = req.body

    // Verify student belongs to tenant
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId: req.tenantId }
    })

    if (!student) {
      throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND')
    }

    const score = await prisma.score.create({
      data: {
        tenantId: req.tenantId,
        studentId,
        subjectId,
        semesterId,
        scoreType,
        value,
        note
      },
      include: {
        student: true,
        subject: true,
        semester: true
      }
    })

    res.status(201).json({ data: score })
  } catch (error) {
    next(error)
  }
})

// Batch update scores (for scoresheet)
router.post('/batch', authenticate, async (req, res, next) => {
  try {
    const { scores } = req.body

    if (!Array.isArray(scores) || scores.length === 0) {
      throw new AppError('Scores array is required', 400, 'INVALID_INPUT')
    }

    // Validate all scores
    for (const score of scores) {
      if (score.value < 0 || score.value > 10) {
        throw new AppError(`Invalid score value: ${score.value}. Must be between 0 and 10`, 400, 'INVALID_SCORE')
      }
    }

    // Process scores
    const results = await Promise.all(
      scores.map(async (scoreData) => {
        const { id, studentId, subjectId, semesterId, scoreType, value, note } = scoreData

        if (id) {
          // Update existing score
          return prisma.score.update({
            where: { id },
            data: { value, note }
          })
        } else {
          // Create new score
          return prisma.score.create({
            data: {
              tenantId: req.tenantId,
              studentId,
              subjectId,
              semesterId,
              scoreType,
              value,
              note
            }
          })
        }
      })
    )

    res.json({ data: results })
  } catch (error) {
    next(error)
  }
})

// Update single score
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { value, note } = req.body

    if (value !== undefined && (value < 0 || value > 10)) {
      throw new AppError('Score must be between 0 and 10', 400, 'INVALID_SCORE')
    }

    const score = await prisma.score.update({
      where: { id: req.params.id },
      data: { value, note }
    })

    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// Delete score
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.score.delete({
      where: { id: req.params.id }
    })

    res.json({ data: { message: 'Score deleted successfully' } })
  } catch (error) {
    next(error)
  }
})

// Get student scores
router.get('/student/:studentId', authenticate, async (req, res, next) => {
  try {
    const { semesterId, subjectId } = req.query

    const scores = await prisma.score.findMany({
      where: {
        studentId: req.params.studentId,
        ...(semesterId && { semesterId }),
        ...(subjectId && { subjectId })
      },
      include: {
        subject: true,
        semester: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ data: scores })
  } catch (error) {
    next(error)
  }
})

module.exports = router
