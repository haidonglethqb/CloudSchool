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
        where: { teacherId: req.user.id, classId: req.params.classId, subjectId, tenantId: req.tenantId }
      })
      if (!assignment) {
        throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
      }
    }

    // Validate classId belongs to this tenant
    const classCheck = await prisma.class.findFirst({ where: { id: req.params.classId, tenantId: req.tenantId } })
    if (!classCheck) throw new AppError('Class not found', 404, 'NOT_FOUND')

    const students = await prisma.student.findMany({
      where: { classId: req.params.classId, tenantId: req.tenantId, isActive: true },
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
      where: { studentId: { in: studentIds }, subjectId, semesterId, tenantId: req.tenantId },
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
      prisma.class.findFirst({ where: { id: req.params.classId, tenantId: req.tenantId }, include: { grade: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
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

    // Ranking (among classmates) - use per-subject averages to match overallAverage logic
    let ranking = null
    let totalStudents = null
    if (student.classId && semesterId) {
      const classmateScores = await prisma.score.findMany({
        where: { student: { classId: student.classId, tenantId: req.tenantId, isActive: true }, semesterId, tenantId: req.tenantId },
        select: { studentId: true, subjectId: true, value: true, scoreComponent: { select: { weight: true } } }
      })

      // Group by student → subject
      const byStudent = {}
      for (const s of classmateScores) {
        if (!byStudent[s.studentId]) byStudent[s.studentId] = {}
        if (!byStudent[s.studentId][s.subjectId]) byStudent[s.studentId][s.subjectId] = []
        byStudent[s.studentId][s.subjectId].push(s)
      }

      const classmateAverages = Object.entries(byStudent).map(([id, subjects]) => {
        const subjectAvgs = []
        for (const scores of Object.values(subjects)) {
          let wSum = 0; let wTotal = 0
          for (const s of scores) { wSum += s.value * s.scoreComponent.weight; wTotal += s.scoreComponent.weight }
          if (wTotal > 0) subjectAvgs.push(wSum / wTotal)
        }
        const avg = subjectAvgs.length > 0 ? Math.round((subjectAvgs.reduce((a, b) => a + b, 0) / subjectAvgs.length) * 100) / 100 : 0
        return { id, average: avg }
      }).sort((a, b) => b.average - a.average)

      const studentIndex = classmateAverages.findIndex(c => c.id === student.id)
      ranking = studentIndex >= 0 ? studentIndex + 1 : null
      totalStudents = classmateAverages.length
    }

    res.json({
      data: {
        student,
        subjectScores,
        overallAverage,
        ranking,
        totalStudents
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
        where: { teacherId: req.user.id, classId: student.classId, subjectId, tenantId: req.tenantId }
      })
      if (!assignment) {
        throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
      }
    }

    const [studentCheck, subjectCheck, semesterCheck, componentCheck] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, tenantId: req.tenantId } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } }),
      prisma.scoreComponent.findFirst({ where: { id: scoreComponentId, tenantId: req.tenantId } })
    ])
    if (!studentCheck) throw new AppError('Student not found in your school', 404, 'NOT_FOUND')
    if (!subjectCheck) throw new AppError('Subject not found', 404, 'NOT_FOUND')
    if (!semesterCheck) throw new AppError('Semester not found', 404, 'NOT_FOUND')
    if (!componentCheck) throw new AppError('Score component not found', 404, 'NOT_FOUND')

    // Enforce semester date window for teachers
    if (req.user.role === 'TEACHER' && semesterCheck.startDate && semesterCheck.endDate) {
      // Use configurable timezone offset (default Vietnam UTC+7)
      const tzOffset = (parseInt(process.env.TZ_OFFSET_HOURS || '7') * 60 * 60 * 1000)
      const now = new Date(Date.now() + tzOffset)
      const start = new Date(new Date(semesterCheck.startDate).getTime() + tzOffset)
      const end = new Date(new Date(semesterCheck.endDate).getTime() + tzOffset)
      if (now < start || now > end) {
        throw new AppError(
          'Ngoài thời gian nhập điểm cho học kỳ này',
          403, 'SEMESTER_CLOSED'
        )
      }
    }

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

    // Enforce semester date window for teachers (batch)
    if (req.user.role === 'TEACHER' && scores.length > 0) {
      const semesterIds = [...new Set(scores.map(s => s.semesterId))]
      const semesters = await prisma.semester.findMany({
        where: { id: { in: semesterIds }, tenantId: req.tenantId }
      })
      const now = new Date()
      for (const sem of semesters) {
        if (sem.startDate && sem.endDate) {
          if (now < new Date(sem.startDate) || now > new Date(sem.endDate)) {
            throw new AppError(
              `Ngoài thời gian nhập điểm cho học kỳ ${sem.name}`,
              403, 'SEMESTER_CLOSED'
            )
          }
        }
      }
    }

    // Verify all students belong to this tenant
    const allStudentIds = [...new Set(scores.map(s => s.studentId))]
    const students = await prisma.student.findMany({
      where: { id: { in: allStudentIds }, tenantId: req.tenantId },
      select: { id: true }
    })
    if (students.length !== allStudentIds.length) {
      throw new AppError('One or more students not found in your school', 404, 'STUDENT_NOT_FOUND')
    }

    // Validate scoreComponents belong to their subjects
    const componentIds = [...new Set(scores.map(s => s.scoreComponentId))]
    const subjectIds = [...new Set(scores.map(s => s.subjectId))]
    const [components, subjects] = await Promise.all([
      prisma.scoreComponent.findMany({ where: { id: { in: componentIds }, tenantId: req.tenantId }, select: { id: true, subjectId: true } }),
      prisma.subject.findMany({ where: { id: { in: subjectIds }, tenantId: req.tenantId }, select: { id: true } })
    ])
    const componentMap = new Map(components.map(c => [c.id, c.subjectId]))
    const subjectSet = new Set(subjects.map(s => s.id))
    for (const s of scores) {
      if (!componentMap.has(s.scoreComponentId)) {
        throw new AppError(`Score component ${s.scoreComponentId} not found`, 404, 'COMPONENT_NOT_FOUND')
      }
      if (componentMap.get(s.scoreComponentId) !== s.subjectId) {
        throw new AppError(`Score component does not belong to the specified subject`, 400, 'COMPONENT_SUBJECT_MISMATCH')
      }
      if (!subjectSet.has(s.subjectId)) {
        throw new AppError(`Subject ${s.subjectId} not found`, 404, 'SUBJECT_NOT_FOUND')
      }
    }

    if (req.user.role === 'TEACHER') {
      // Batch validate all student+subject pairs at once
      const pairsToCheck = new Map()
      for (const s of scores) {
        const key = `${s.studentId}::${s.subjectId}`
        if (!pairsToCheck.has(key)) {
          pairsToCheck.set(key, { studentId: s.studentId, subjectId: s.subjectId })
        }
      }

      const studentIds = [...new Set(scores.map(s => s.studentId))]
      const batchStudents = await prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId: req.tenantId },
        select: { id: true, classId: true }
      })
      const studentMap = new Map(batchStudents.map(s => [s.id, s]))

      const classIds = [...new Set(batchStudents.filter(s => s.classId).map(s => s.classId))]
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: req.user.id, classId: { in: classIds }, tenantId: req.tenantId },
        select: { classId: true, subjectId: true }
      })
      const assignmentSet = new Set(assignments.map(a => `${a.classId}::${a.subjectId}`))

      for (const { studentId, subjectId } of pairsToCheck.values()) {
        const student = studentMap.get(studentId)
        if (!student || !student.classId) {
          throw new AppError('Student not found or not assigned to a class', 400, 'INVALID_STUDENT')
        }
        if (!assignmentSet.has(`${student.classId}::${subjectId}`)) {
          throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
        }
      }

      // Check locked scores
      const existingScores = await prisma.score.findMany({
        where: {
          tenantId: req.tenantId,
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

    const results = await prisma.$transaction(
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
    const score = await prisma.score.update({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { isLocked: true }
    })
    res.json({ data: score })
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new AppError('Score not found', 404, 'NOT_FOUND'))
    }
    next(error)
  }
})

// PATCH /scores/:id/unlock
router.patch('/:id/unlock', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const score = await prisma.score.update({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { isLocked: false }
    })
    res.json({ data: score })
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new AppError('Score not found', 404, 'NOT_FOUND'))
    }
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

    const classCheck = await prisma.class.findFirst({ where: { id: req.params.classId, tenantId: req.tenantId } })
    if (!classCheck) throw new AppError('Class not found', 404, 'NOT_FOUND')

    const students = await prisma.student.findMany({
      where: { classId: req.params.classId, tenantId: req.tenantId },
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

    const classCheck = await prisma.class.findFirst({ where: { id: req.params.classId, tenantId: req.tenantId } })
    if (!classCheck) throw new AppError('Class not found', 404, 'NOT_FOUND')

    const students = await prisma.student.findMany({
      where: { classId: req.params.classId, tenantId: req.tenantId },
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
    const existing = await prisma.score.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Score not found', 404, 'NOT_FOUND')

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

    // Support dynamic number of semesters (not just 1 and 2)
    const semesterMap = {}
    for (const sem of semesters) {
      semesterMap[sem.semesterNum] = sem
    }
    const sem1 = semesterMap[1]
    const sem2 = semesterMap[2]

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    // Get all scores for ALL semesters of this year
    const semesterIds = semesters.map(s => s.id)
    const scores = await prisma.score.findMany({
      where: { studentId, semesterId: { in: semesterIds }, tenantId: req.tenantId },
      include: { scoreComponent: true, subject: true }
    })

    // Group by subject then by semester (support dynamic semester count)
    const subjectMap = {}
    for (const s of scores) {
      if (!subjectMap[s.subjectId]) {
        subjectMap[s.subjectId] = { subject: s.subject, semesters: {} }
      }
      const sem = semesters.find(sem => sem.id === s.semesterId)
      if (sem) {
        if (!subjectMap[s.subjectId].semesters[sem.semesterNum]) {
          subjectMap[s.subjectId].semesters[sem.semesterNum] = []
        }
        subjectMap[s.subjectId].semesters[sem.semesterNum].push(s)
      }
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

    const subjects = Object.values(subjectMap).map(({ subject, semesters: semScores }) => {
      const semester1Average = calcWeightedAvg(semScores[1] || [])
      const semester2Average = calcWeightedAvg(semScores[2] || [])
      
      // Calculate yearly average from all available semesters
      const allSemAvgs = Object.values(semScores).map(scores => calcWeightedAvg(scores)).filter(v => v != null)
      const yearlyAverage = allSemAvgs.length > 0
        ? Math.round((allSemAvgs.reduce((a, b) => a + b, 0) / allSemAvgs.length) * 100) / 100
        : null
      
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
