const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// GET /scores/class/:classId - Get score sheet for a class
router.get('/class/:classId', authenticate, async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query

    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    // Teacher can only see assigned classes
    if (req.user.role === 'TEACHER') {
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { teacherId: req.user.id, classId: req.params.classId, subjectId }
      })
      if (!assignment) {
        throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
      }
    }

    const students = await prisma.student.findMany({
      where: { classId: req.params.classId, isActive: true },
      orderBy: { fullName: 'asc' }
    })

    // Get score components for this subject
    const scoreComponents = await prisma.scoreComponent.findMany({
      where: { tenantId: req.tenantId, subjectId },
      orderBy: { weight: 'desc' }
    })

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    // Batch fetch all scores for all students at once (avoid N+1)
    const studentIds = students.map(s => s.id)
    const allScores = await prisma.score.findMany({
      where: { studentId: { in: studentIds }, subjectId, semesterId },
      include: { scoreComponent: true }
    })

    // Group scores by student
    const scoresByStudent = {}
    for (const score of allScores) {
      if (!scoresByStudent[score.studentId]) scoresByStudent[score.studentId] = []
      scoresByStudent[score.studentId].push(score)
    }

    const studentsWithScores = students.map((student) => {
      const scores = scoresByStudent[student.id] || []

      let weightedSum = 0
      let totalWeight = 0
      const scoreMap = {}

      for (const sc of scoreComponents) {
        const score = scores.find(s => s.scoreComponentId === sc.id)
        scoreMap[sc.id] = score || null
        if (score) {
          weightedSum += score.value * sc.weight
          totalWeight += sc.weight
        }
      }

      const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null

      return {
        student,
        scores: scoreMap,
        average,
        isPassed: average !== null && average >= settings.passScore
      }
    })

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
        scoreComponents,
        students: studentsWithScores,
        passScore: settings.passScore
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /scores/student/:studentId - Get all scores for a student
router.get('/student/:studentId', authenticate, async (req, res, next) => {
  try {
    const { semesterId } = req.query

    const where = {
      studentId: req.params.studentId,
      tenantId: req.tenantId,
      ...(semesterId && { semesterId })
    }

    const scores = await prisma.score.findMany({
      where,
      include: {
        subject: true,
        semester: true,
        scoreComponent: true
      },
      orderBy: [{ subjectId: 'asc' }, { scoreComponentId: 'asc' }]
    })

    const student = await prisma.student.findFirst({
      where: { id: req.params.studentId, tenantId: req.tenantId },
      include: { class: { include: { grade: true } } }
    })
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')

    // Group by subject and calculate averages
    const subjects = await prisma.subject.findMany({
      where: { tenantId: req.tenantId, isActive: true }
    })

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    const subjectScores = subjects.map(subject => {
      const subjectData = scores.filter(s => s.subjectId === subject.id)

      let weightedSum = 0
      let totalWeight = 0
      for (const s of subjectData) {
        weightedSum += s.value * s.scoreComponent.weight
        totalWeight += s.scoreComponent.weight
      }

      const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null

      return {
        subject,
        scores: subjectData,
        average,
        isPassed: average !== null && average >= settings.passScore
      }
    }).filter(s => s.scores.length > 0)

    // Overall average
    const validAverages = subjectScores.filter(s => s.average !== null).map(s => s.average)
    const overallAverage = validAverages.length > 0
      ? Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 100) / 100
      : null

    // Ranking (among classmates)
    let ranking = null
    if (student.classId && semesterId) {
      const classmates = await prisma.student.findMany({
        where: { classId: student.classId, isActive: true },
        include: { scores: { where: { semesterId }, include: { scoreComponent: true } } }
      })

      const classmateAverages = classmates.map(cm => {
        let sum = 0; let weight = 0
        for (const s of cm.scores) {
          sum += s.value * s.scoreComponent.weight
          weight += s.scoreComponent.weight
        }
        return { id: cm.id, average: weight > 0 ? sum / weight : 0 }
      }).sort((a, b) => b.average - a.average)

      ranking = classmateAverages.findIndex(c => c.id === student.id) + 1
    }

    res.json({
      data: {
        student,
        subjectScores,
        overallAverage,
        ranking,
        totalStudents: student.classId ? await prisma.student.count({ where: { classId: student.classId, isActive: true } }) : null
      }
    })
  } catch (error) {
    next(error)
  }
})

// POST /scores - Create/Update score
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), [
  body('studentId').notEmpty(),
  body('subjectId').notEmpty(),
  body('semesterId').notEmpty(),
  body('scoreComponentId').notEmpty(),
  body('value').isFloat().withMessage('Score must be a number')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { studentId, subjectId, semesterId, scoreComponentId, value } = req.body

    // QĐ6: Validate score range from settings
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (value < settings.minScore || value > settings.maxScore) {
      throw new AppError(
        `Điểm phải nằm trong khoảng ${settings.minScore}-${settings.maxScore}`,
        400, 'INVALID_SCORE_RANGE'
      )
    }

    // Check if score is locked (teachers can't edit locked scores)
    const existingScore = await prisma.score.findUnique({
      where: {
        studentId_subjectId_semesterId_scoreComponentId: {
          studentId, subjectId, semesterId, scoreComponentId
        }
      }
    })

    if (existingScore && existingScore.isLocked && req.user.role === 'TEACHER') {
      throw new AppError('Score is locked. Only Admin/Staff can edit locked scores.', 403, 'SCORE_LOCKED')
    }

    // Teacher can only enter scores for assigned classes
    if (req.user.role === 'TEACHER') {
      const student = await prisma.student.findFirst({ where: { id: studentId, tenantId: req.tenantId } })
      if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { teacherId: req.user.id, classId: student.classId, subjectId }
      })
      if (!assignment) {
        throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
      }
    }

    const studentCheck = await prisma.student.findFirst({
      where: { id: studentId, tenantId: req.tenantId }
    })
    if (!studentCheck) throw new AppError('Student not found in your school', 404, 'NOT_FOUND')

    const score = await prisma.score.upsert({
      where: {
        studentId_subjectId_semesterId_scoreComponentId: {
          studentId, subjectId, semesterId, scoreComponentId
        }
      },
      create: {
        tenantId: req.tenantId,
        studentId, subjectId, semesterId, scoreComponentId, value
      },
      update: { value },
      include: { scoreComponent: true, subject: true, student: true }
    })

    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// POST /scores/batch - Batch save scores
router.post('/batch', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
  try {
    const { scores } = req.body

    if (!Array.isArray(scores) || scores.length === 0) {
      throw new AppError('Scores array is required', 400, 'INVALID_INPUT')
    }

    // QĐ6: Validate score range from settings
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    for (const s of scores) {
      if (s.value < settings.minScore || s.value > settings.maxScore) {
        throw new AppError(`Invalid score: ${s.value}`, 400, 'INVALID_SCORE')
      }
    }

    if (req.user.role === 'TEACHER') {
      // Collect unique studentId+subjectId pairs to validate assignments
      const pairsToCheck = new Map()
      for (const s of scores) {
        const key = `${s.studentId}::${s.subjectId}`
        if (!pairsToCheck.has(key)) {
          pairsToCheck.set(key, { studentId: s.studentId, subjectId: s.subjectId })
        }
      }

      for (const { studentId, subjectId } of pairsToCheck.values()) {
        const student = await prisma.student.findUnique({ where: { id: studentId } })
        if (!student || !student.classId) {
          throw new AppError('Student not found or not assigned to a class', 400, 'INVALID_STUDENT')
        }
        const assignment = await prisma.teacherAssignment.findFirst({
          where: { teacherId: req.user.id, classId: student.classId, subjectId }
        })
        if (!assignment) {
          throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
        }
      }

      // Check locked scores
      const existingScores = await prisma.score.findMany({
        where: {
          OR: scores.map(s => ({
            studentId: s.studentId,
            subjectId: s.subjectId,
            semesterId: s.semesterId,
            scoreComponentId: s.scoreComponentId,
          }))
        },
        select: { studentId: true, subjectId: true, semesterId: true, scoreComponentId: true, isLocked: true }
      })

      const lockedScore = existingScores.find(s => s.isLocked)
      if (lockedScore) {
        throw new AppError('One or more scores are locked. Only Admin/Staff can edit locked scores.', 403, 'SCORE_LOCKED')
      }
    }

    const results = await Promise.all(
      scores.map(({ studentId, subjectId, semesterId, scoreComponentId, value }) => {
        return prisma.score.upsert({
          where: {
            studentId_subjectId_semesterId_scoreComponentId: {
              studentId, subjectId, semesterId, scoreComponentId
            }
          },
          create: { tenantId: req.tenantId, studentId, subjectId, semesterId, scoreComponentId, value },
          update: { value }
        })
      })
    )

    res.json({ data: results })
  } catch (error) {
    next(error)
  }
})

// PATCH /scores/:id/lock
router.patch('/:id/lock', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existingScore = await prisma.score.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingScore) throw new AppError('Score not found', 404, 'NOT_FOUND')

    const score = await prisma.score.update({
      where: { id: req.params.id },
      data: { isLocked: true }
    })
    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// PATCH /scores/:id/unlock
router.patch('/:id/unlock', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existingScore = await prisma.score.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingScore) throw new AppError('Score not found', 404, 'NOT_FOUND')

    const score = await prisma.score.update({
      where: { id: req.params.id },
      data: { isLocked: false }
    })
    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// POST /scores/class/:classId/lock — Lock all scores for a class+subject+semester
router.post('/class/:classId/lock', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.body

    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const students = await prisma.student.findMany({
      where: { classId: req.params.classId },
      select: { id: true }
    })

    const result = await prisma.score.updateMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        subjectId,
        semesterId,
        tenantId: req.tenantId
      },
      data: { isLocked: true }
    })

    res.json({ data: { message: `Locked ${result.count} scores` } })
  } catch (error) {
    next(error)
  }
})

// POST /scores/class/:classId/unlock — Unlock all scores for a class+subject+semester
router.post('/class/:classId/unlock', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.body

    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const students = await prisma.student.findMany({
      where: { classId: req.params.classId },
      select: { id: true }
    })

    const result = await prisma.score.updateMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        subjectId,
        semesterId,
        tenantId: req.tenantId
      },
      data: { isLocked: false }
    })

    res.json({ data: { message: `Unlocked ${result.count} scores` } })
  } catch (error) {
    next(error)
  }
})

// DELETE /scores/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.score.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Score deleted' } })
  } catch (error) {
    next(error)
  }
})

// GET /scores/student/:studentId/yearly - BM7: Tra cứu điểm cả năm
router.get('/student/:studentId/yearly', authenticate, async (req, res, next) => {
  try {
    const { studentId } = req.params
    const { year } = req.query

    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId: req.tenantId },
      include: { class: { include: { grade: true } } }
    })
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')

    // Find semesters for this year
    const semesterWhere = { tenantId: req.tenantId }
    if (year) semesterWhere.year = year

    const semesters = await prisma.semester.findMany({
      where: semesterWhere,
      orderBy: { semesterNum: 'asc' }
    })

    const sem1 = semesters.find(s => s.semesterNum === 1)
    const sem2 = semesters.find(s => s.semesterNum === 2)

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    // Get all scores for both semesters
    const semesterIds = [sem1?.id, sem2?.id].filter(Boolean)
    const scores = await prisma.score.findMany({
      where: { studentId, semesterId: { in: semesterIds } },
      include: { scoreComponent: true, subject: true }
    })

    // Group by subject then by semester
    const subjectMap = {}
    for (const s of scores) {
      if (!subjectMap[s.subjectId]) {
        subjectMap[s.subjectId] = { subject: s.subject, sem1: [], sem2: [] }
      }
      if (sem1 && s.semesterId === sem1.id) subjectMap[s.subjectId].sem1.push(s)
      if (sem2 && s.semesterId === sem2.id) subjectMap[s.subjectId].sem2.push(s)
    }

    const calcWeightedAvg = (scores) => {
      if (!scores.length) return null
      let weightedSum = 0
      let totalWeight = 0
      for (const s of scores) {
        weightedSum += s.value * s.scoreComponent.weight
        totalWeight += s.scoreComponent.weight
      }
      return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
    }

    const subjects = Object.values(subjectMap).map(({ subject, sem1: s1, sem2: s2 }) => {
      const semester1Average = calcWeightedAvg(s1)
      const semester2Average = calcWeightedAvg(s2)
      const yearlyAverage = semester1Average != null && semester2Average != null
        ? Math.round(((semester1Average + semester2Average) / 2) * 100) / 100
        : semester1Average ?? semester2Average
      return {
        subject: { id: subject.id, name: subject.name },
        semester1Average,
        semester2Average,
        yearlyAverage,
        isPassed: yearlyAverage != null ? yearlyAverage >= settings.passScore : null
      }
    })

    const avg = (vals) => {
      const valid = vals.filter(v => v != null)
      return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100 : null
    }

    res.json({
      data: {
        student: { id: student.id, studentCode: student.studentCode, fullName: student.fullName, class: student.class },
        subjects,
        overallSemester1: avg(subjects.map(s => s.semester1Average)),
        overallSemester2: avg(subjects.map(s => s.semester2Average)),
        overallYearly: avg(subjects.map(s => s.yearlyAverage))
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
