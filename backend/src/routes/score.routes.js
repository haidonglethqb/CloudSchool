const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getUserAssignmentScope, ensureClassSubjectAccess } = require('../utils/assignment-scope')
const { getComponentSetForSubjectSemester, getEffectiveSubjectsForClass, resolveScoreEntryContext } = require('../utils/academic-scope')

router.use(authenticate, requireFeature('scores'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('scores'))

const assertSemesterOpenForScoreEntry = async (tenantId, semesterId) => {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, tenantId },
    select: { id: true, name: true, isActive: true, startDate: true, endDate: true }
  })

  if (!semester) {
    throw new AppError('Semester not found', 404, 'NOT_FOUND')
  }

  if (!semester.isActive) {
    throw new AppError('Semester is not open for score entry', 403, 'SEMESTER_CLOSED')
  }

  return semester
}

const resolveStudentClassInSemester = async (tenantId, studentId, semesterId) => {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { tenantId, studentId, semesterId },
    select: { classId: true }
  })
  if (enrollment?.classId) return enrollment.classId

  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId, isActive: true },
    select: { classId: true }
  })
  return student?.classId || null
}

const getStudentIdsForClassAndSemester = async (tenantId, classId, semesterId) => {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { tenantId, classId, semesterId },
    select: { studentId: true }
  })

  if (enrollments.length > 0) {
    return [...new Set(enrollments.map((item) => item.studentId))]
  }

  const legacyStudents = await prisma.student.findMany({
    where: { tenantId, classId, isActive: true },
    select: { id: true }
  })
  return legacyStudents.map((student) => student.id)
}

const assertAssignedUserCanAccessStudent = async (req, studentId, semesterId = null) => {
  const scope = await getUserAssignmentScope(prisma, req, { semesterId })
  if (!scope) return
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId: req.tenantId },
    select: { classId: true }
  })
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')
  const semesterClassId = semesterId
    ? await resolveStudentClassInSemester(req.tenantId, studentId, semesterId)
    : null
  const classId = semesterClassId || student.classId
  if (!classId) throw new AppError('Student has no class', 400, 'INVALID_STUDENT')

  if (!scope.classIds.includes(classId)) throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
}

const createActorSnapshot = (user) => ({
  actorId: user?.id || null,
  actorName: user?.fullName || user?.email || 'Unknown',
  actorRole: String(user?.role || 'UNKNOWN'),
})

const createScoreHistoryPayload = ({
  tenantId,
  scoreId = null,
  studentId,
  studentCode = null,
  studentName,
  classId = null,
  className = null,
  subjectId,
  subjectName,
  semesterId,
  semesterName,
  scoreComponentId,
  scoreComponentName,
  action,
  oldValue = null,
  newValue = null,
  actor,
}) => ({
  tenantId,
  scoreId,
  studentId,
  studentCode,
  studentName,
  classId,
  className,
  subjectId,
  subjectName,
  semesterId,
  semesterName,
  scoreComponentId,
  scoreComponentName,
  action,
  oldValue,
  newValue,
  actorId: actor.actorId,
  actorName: actor.actorName,
  actorRole: actor.actorRole,
})

// GET /scores/history - Get score mutation history for a class/subject/semester context
router.get('/history', async (req, res, next) => {
  try {
    const { classId, subjectId, semesterId, scoreComponentId, page = 1, limit = 20 } = req.query

    if (!classId || !subjectId || !semesterId) {
      throw new AppError('classId, subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    await ensureClassSubjectAccess(prisma, req, classId, subjectId, { semesterId })

    const skip = (Number(page) - 1) * Number(limit)
    const where = {
      tenantId: req.tenantId,
      classId,
      subjectId,
      semesterId,
      ...(scoreComponentId ? { scoreComponentId } : {}),
    }

    const [entries, total] = await Promise.all([
      prisma.scoreHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.scoreHistory.count({ where }),
    ])

    res.json({
      data: entries,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /scores/class/:classId - Get score sheet for a class
router.get('/class/:classId', async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query

    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    await ensureClassSubjectAccess(prisma, req, req.params.classId, subjectId, { semesterId })

    const scoreContext = await resolveScoreEntryContext(prisma, req.tenantId, {
      classId: req.params.classId,
      subjectId,
      semesterId
    })

    const studentIds = await getStudentIdsForClassAndSemester(req.tenantId, req.params.classId, semesterId)
    const students = studentIds.length > 0
      ? await prisma.student.findMany({
          where: { id: { in: studentIds }, tenantId: req.tenantId, isActive: true },
          orderBy: { fullName: 'asc' }
        })
      : []

    const scoreComponents = scoreContext.components

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    // Batch fetch all scores for all students at once (avoid N+1)
    const orderedStudentIds = students.map(s => s.id)
    const allScores = await prisma.score.findMany({
      where: { studentId: { in: orderedStudentIds }, subjectId, semesterId, tenantId: req.tenantId },
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
        subjectVersionId: scoreContext.version.id,
        componentSet: scoreContext.componentSet,
        scoreComponents,
        warning: scoreContext.componentWarning,
        students: studentsWithScores,
        passScore: settings.passScore
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /scores/student/:studentId - Get all scores for a student
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const { semesterId } = req.query

    await assertAssignedUserCanAccessStudent(req, req.params.studentId, semesterId || null)

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
    let scoreContext = null
    if (semesterId) {
      const [semester, classIdForSemester] = await Promise.all([
        prisma.semester.findFirst({
          where: { id: semesterId, tenantId: req.tenantId },
          select: { id: true, academicYearId: true }
        }),
        resolveStudentClassInSemester(req.tenantId, req.params.studentId, semesterId)
      ])
      if (semester?.academicYearId && classIdForSemester) {
        try {
          const [classContext, effectiveSubjects] = await Promise.all([
            prisma.class.findFirst({
              where: { id: classIdForSemester, tenantId: req.tenantId },
              include: { grade: true }
            }),
            getEffectiveSubjectsForClass(prisma, req.tenantId, {
              classId: classIdForSemester,
              academicYearId: semester.academicYearId
            })
          ])
          const subjectContexts = await Promise.all(effectiveSubjects.map(async (subject) => {
            const componentContext = await getComponentSetForSubjectSemester(prisma, req.tenantId, {
              subjectId: subject.id,
              semesterId
            })
            return {
              subject,
              componentSet: componentContext.componentSet,
              components: componentContext.components,
              warning: componentContext.warning
            }
          }))
          scoreContext = { class: classContext, subjects: subjectContexts }
        } catch {
          scoreContext = null
        }
      }
    }

    const subjectScores = subjects.map(subject => {
      const subjectData = scores.filter(s => s.subjectId === subject.id)
      const activeSubjectData = subjectData.filter((s) => s.scoreComponent && s.scoreComponent.isActive !== false)

      let weightedSum = 0
      let totalWeight = 0
      for (const s of activeSubjectData) {
        weightedSum += s.value * s.scoreComponent.weight
        totalWeight += s.scoreComponent.weight
      }

      const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null

      return {
        subject,
        scores: activeSubjectData,
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
    let rankingStudentIds = null
    if (semesterId) {
      const selectedEnrollment = await prisma.classEnrollment.findFirst({
        where: { tenantId: req.tenantId, studentId: student.id, semesterId },
        select: { classId: true }
      })
      if (selectedEnrollment?.classId) {
        const classmates = await prisma.classEnrollment.findMany({
          where: { tenantId: req.tenantId, classId: selectedEnrollment.classId, semesterId },
          select: { studentId: true }
        })
        rankingStudentIds = classmates.map((item) => item.studentId)
      }
    }

    if ((rankingStudentIds?.length || student.classId) && semesterId) {
      const classmateScores = await prisma.score.findMany({
        where: {
          ...(rankingStudentIds ? { studentId: { in: rankingStudentIds } } : { student: { classId: student.classId, tenantId: req.tenantId, isActive: true } }),
          semesterId,
          tenantId: req.tenantId
        },
        select: { studentId: true, subjectId: true, value: true, scoreComponent: { select: { weight: true, isActive: true } } }
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
          for (const s of scores) {
            if (!s.scoreComponent || s.scoreComponent.isActive === false) continue
            wSum += s.value * s.scoreComponent.weight
            wTotal += s.scoreComponent.weight
          }
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
        scoreContext,
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
router.post('/', [
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

    const { studentId, subjectId, semesterId, scoreComponentId } = req.body
    const value = Number(req.body.value)

    // QĐ6: Validate score range from settings
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (value < settings.minScore || value > settings.maxScore) {
      throw new AppError(
        `Điểm phải nằm trong khoảng ${settings.minScore}-${settings.maxScore}`,
        400, 'INVALID_SCORE_RANGE'
      )
    }

    const semester = await assertSemesterOpenForScoreEntry(req.tenantId, semesterId)

    const [studentCheck, subjectCheck, componentCheck] = await Promise.all([
      prisma.student.findFirst({
        where: { id: studentId, tenantId: req.tenantId },
        select: { id: true, fullName: true, studentCode: true }
      }),
      prisma.subject.findFirst({
        where: { id: subjectId, tenantId: req.tenantId },
        select: { id: true, name: true, isActive: true }
      }),
      prisma.scoreComponent.findFirst({
        where: { id: scoreComponentId, tenantId: req.tenantId },
        include: { scoreComponentSet: true }
      })
    ])
    if (!studentCheck) throw new AppError('Student not found in your school', 404, 'NOT_FOUND')
    if (!subjectCheck) throw new AppError('Subject not found', 404, 'NOT_FOUND')
    if (!componentCheck) throw new AppError('Score component not found', 404, 'NOT_FOUND')
    if (!subjectCheck.isActive) throw new AppError('Subject is inactive', 400, 'SUBJECT_INACTIVE')
    if (!componentCheck.isActive) throw new AppError('Score component is inactive', 400, 'SCORE_COMPONENT_INACTIVE')

    const classId = await resolveStudentClassInSemester(req.tenantId, studentId, semesterId)
    if (!classId) {
      throw new AppError('Student not assigned to a class in this semester', 400, 'INVALID_STUDENT')
    }

    await ensureClassSubjectAccess(prisma, req, classId, subjectId, { semesterId })
    const scoreContext = await resolveScoreEntryContext(prisma, req.tenantId, { classId, subjectId, semesterId })
    if (!scoreContext.components.some((component) => component.id === scoreComponentId)) {
      throw new AppError('Thành phần điểm không thuộc môn và học kỳ đã chọn', 400, 'COMPONENT_SET_MISMATCH')
    }

    const existingScore = await prisma.score.findUnique({
      where: {
        studentId_subjectId_semesterId_scoreComponentId: {
          studentId, subjectId, semesterId, scoreComponentId
        }
      },
      select: { id: true, value: true, isLocked: true }
    })
    if (existingScore?.isLocked && req.user.role === 'TEACHER') {
      throw new AppError('Score is locked. Only Admin/Staff can edit locked scores.', 403, 'SCORE_LOCKED')
    }

    const classSnapshot = await prisma.class.findFirst({
      where: { id: classId, tenantId: req.tenantId },
      select: { id: true, name: true }
    })

    const actor = createActorSnapshot(req.user)

    const score = await prisma.score.upsert({
      where: {
        studentId_subjectId_semesterId_scoreComponentId: {
          studentId, subjectId, semesterId, scoreComponentId
        }
      },
      create: {
        tenantId: req.tenantId,
        studentId, subjectId, subjectVersionId: scoreContext.version.id, semesterId, scoreComponentId, value
      },
      update: { value, subjectVersionId: scoreContext.version.id }
    })

    await prisma.scoreHistory.create({
      data: createScoreHistoryPayload({
        tenantId: req.tenantId,
        scoreId: score.id,
        studentId,
        studentCode: studentCheck.studentCode,
        studentName: studentCheck.fullName,
        classId: classSnapshot?.id || null,
        className: classSnapshot?.name || null,
        subjectId,
        subjectName: subjectCheck.name,
        semesterId,
        semesterName: semester.name,
        scoreComponentId,
        scoreComponentName: componentCheck.name,
        action: existingScore ? 'UPDATE' : 'CREATE',
        oldValue: existingScore?.value ?? null,
        newValue: value,
        actor,
      })
    })

    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// POST /scores/batch - Batch save scores
router.post('/batch', async (req, res, next) => {
  try {
    const { scores } = req.body

    if (!Array.isArray(scores) || scores.length === 0) {
      throw new AppError('Scores array is required', 400, 'INVALID_INPUT')
    }

    // QĐ6: Validate score range from settings
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    for (const s of scores) {
      if (!s.studentId || !s.subjectId || !s.semesterId || !s.scoreComponentId) {
        throw new AppError('Missing required score fields', 400, 'INVALID_INPUT')
      }
      if (s.value < settings.minScore || s.value > settings.maxScore) {
        throw new AppError(`Invalid score: ${s.value}`, 400, 'INVALID_SCORE')
      }
    }

    const semesterIds = [...new Set(scores.map((s) => s.semesterId))]
    for (const semesterId of semesterIds) {
      await assertSemesterOpenForScoreEntry(req.tenantId, semesterId)
    }

    // Verify all students belong to this tenant
    const allStudentIds = [...new Set(scores.map(s => s.studentId))]
    const students = await prisma.student.findMany({
      where: { id: { in: allStudentIds }, tenantId: req.tenantId, isActive: true },
      select: { id: true, classId: true, fullName: true, studentCode: true }
    })
    if (students.length !== allStudentIds.length) {
      throw new AppError('One or more students not found in your school', 404, 'STUDENT_NOT_FOUND')
    }
    // Validate scoreComponents belong to their subjects
    const componentIds = [...new Set(scores.map(s => s.scoreComponentId))]
    const subjectIds = [...new Set(scores.map(s => s.subjectId))]
    const [components, subjects, semesters, existingScores] = await Promise.all([
      prisma.scoreComponent.findMany({ where: { id: { in: componentIds }, tenantId: req.tenantId }, include: { scoreComponentSet: true } }),
      prisma.subject.findMany({ where: { id: { in: subjectIds }, tenantId: req.tenantId }, select: { id: true, name: true, isActive: true } }),
      prisma.semester.findMany({ where: { id: { in: semesterIds }, tenantId: req.tenantId }, select: { id: true, name: true } }),
      prisma.score.findMany({
        where: {
          tenantId: req.tenantId,
          OR: scores.map(s => ({
            studentId: s.studentId,
            subjectId: s.subjectId,
            semesterId: s.semesterId,
            scoreComponentId: s.scoreComponentId,
          }))
        },
        select: { id: true, studentId: true, subjectId: true, semesterId: true, scoreComponentId: true, value: true, isLocked: true }
      })
    ])
    const componentMap = new Map(components.map((component) => [component.id, component]))
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
    const semesterMap = new Map(semesters.map((semester) => [semester.id, semester]))
    const studentMap = new Map(students.map((student) => [student.id, student]))
    const existingScoreMap = new Map(existingScores.map((score) => [
      `${score.studentId}::${score.subjectId}::${score.semesterId}::${score.scoreComponentId}`,
      score,
    ]))

    for (const s of scores) {
      const component = componentMap.get(s.scoreComponentId)
      const subject = subjectMap.get(s.subjectId)
      const semester = semesterMap.get(s.semesterId)

      if (!component) {
        throw new AppError(`Score component ${s.scoreComponentId} not found`, 404, 'COMPONENT_NOT_FOUND')
      }
      if (!subject) {
        throw new AppError(`Subject ${s.subjectId} not found`, 404, 'SUBJECT_NOT_FOUND')
      }
      if (!semester) {
        throw new AppError(`Semester ${s.semesterId} not found`, 404, 'NOT_FOUND')
      }
      if (!subject.isActive) {
        throw new AppError('Subject is inactive', 400, 'SUBJECT_INACTIVE')
      }
      if (!component.isActive) {
        throw new AppError('Score component is inactive', 400, 'SCORE_COMPONENT_INACTIVE')
      }
    }

    const studentSemesterPairs = new Map()
    for (const score of scores) {
      const key = `${score.studentId}::${score.semesterId}`
      if (!studentSemesterPairs.has(key)) {
        studentSemesterPairs.set(key, { studentId: score.studentId, semesterId: score.semesterId })
      }
    }

    const classByStudentSemester = new Map()
    for (const { studentId, semesterId } of studentSemesterPairs.values()) {
      const classId = await resolveStudentClassInSemester(req.tenantId, studentId, semesterId)
      if (!classId) {
        throw new AppError('Student not found or not assigned to a class', 400, 'INVALID_STUDENT')
      }
      classByStudentSemester.set(`${studentId}::${semesterId}`, classId)
    }

    const classIds = [...new Set(Array.from(classByStudentSemester.values()))]
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds }, tenantId: req.tenantId },
      select: { id: true, name: true }
    })
    const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]))

    const contextByClassSubjectSemester = new Map()
    const subjectVersionByScoreKey = new Map()
    for (const s of scores) {
      const classId = classByStudentSemester.get(`${s.studentId}::${s.semesterId}`)
      const contextKey = `${classId}::${s.subjectId}::${s.semesterId}`
      if (!contextByClassSubjectSemester.has(contextKey)) {
        contextByClassSubjectSemester.set(
          contextKey,
          await resolveScoreEntryContext(prisma, req.tenantId, { classId, subjectId: s.subjectId, semesterId: s.semesterId })
        )
      }
      const context = contextByClassSubjectSemester.get(contextKey)
      if (!context.components.some((component) => component.id === s.scoreComponentId)) {
        throw new AppError('Thành phần điểm không thuộc môn và học kỳ đã chọn', 400, 'COMPONENT_SET_MISMATCH')
      }
      subjectVersionByScoreKey.set(
        `${s.studentId}::${s.subjectId}::${s.semesterId}::${s.scoreComponentId}`,
        context.version.id
      )
    }

    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) {
      // Batch validate all student+subject pairs at once
      const pairsToCheck = new Map()
      for (const s of scores) {
        const key = `${s.studentId}::${s.subjectId}::${s.semesterId}`
        if (!pairsToCheck.has(key)) {
          pairsToCheck.set(key, { studentId: s.studentId, subjectId: s.subjectId, semesterId: s.semesterId })
        }
      }

      for (const { studentId, subjectId, semesterId } of pairsToCheck.values()) {
        const classId = classByStudentSemester.get(`${studentId}::${semesterId}`)
        if (!classId || !scope.classSubjectSemesterSet.has(`${classId}::${subjectId}::${semesterId}`)) {
          throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
        }
      }

      const lockedScore = existingScores.find(s => s.isLocked)
      if (lockedScore && req.user.role === 'TEACHER') {
        throw new AppError('One or more scores are locked. Only Admin/Staff can edit locked scores.', 403, 'SCORE_LOCKED')
      }
    }

    const actor = createActorSnapshot(req.user)

    const results = await prisma.$transaction(async (tx) => {
      const upsertedScores = await Promise.all(
        scores.map(({ studentId, subjectId, semesterId, scoreComponentId, value }) => {
          const subjectVersionId = subjectVersionByScoreKey.get(`${studentId}::${subjectId}::${semesterId}::${scoreComponentId}`) || null
          return tx.score.upsert({
            where: {
              studentId_subjectId_semesterId_scoreComponentId: {
                studentId, subjectId, semesterId, scoreComponentId
              }
            },
            create: { tenantId: req.tenantId, studentId, subjectId, subjectVersionId, semesterId, scoreComponentId, value: Number(value) },
            update: { value: Number(value), subjectVersionId }
          })
        })
      )

      await tx.scoreHistory.createMany({
        data: scores.map((scoreInput, index) => {
          const existingScore = existingScoreMap.get(`${scoreInput.studentId}::${scoreInput.subjectId}::${scoreInput.semesterId}::${scoreInput.scoreComponentId}`)
          const student = studentMap.get(scoreInput.studentId)
          const subject = subjectMap.get(scoreInput.subjectId)
          const semester = semesterMap.get(scoreInput.semesterId)
          const component = componentMap.get(scoreInput.scoreComponentId)
          const classId = classByStudentSemester.get(`${scoreInput.studentId}::${scoreInput.semesterId}`)
          const classSnapshot = classMap.get(classId)

          return createScoreHistoryPayload({
            tenantId: req.tenantId,
            scoreId: upsertedScores[index].id,
            studentId: scoreInput.studentId,
            studentCode: student?.studentCode || null,
            studentName: student?.fullName || 'Unknown',
            classId: classSnapshot?.id || null,
            className: classSnapshot?.name || null,
            subjectId: scoreInput.subjectId,
            subjectName: subject?.name || 'Unknown',
            semesterId: scoreInput.semesterId,
            semesterName: semester?.name || 'Unknown',
            scoreComponentId: scoreInput.scoreComponentId,
            scoreComponentName: component?.name || 'Unknown',
            action: existingScore ? 'UPDATE' : 'CREATE',
            oldValue: existingScore?.value ?? null,
            newValue: Number(scoreInput.value),
            actor,
          })
        })
      })

      return upsertedScores
    })

    res.json({ data: results })
  } catch (error) {
    next(error)
  }
})

// PATCH /scores/:id/lock
router.patch('/:id/lock', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.score.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        subject: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        scoreComponent: { select: { id: true, name: true } },
      }
    })
    if (!existing) throw new AppError('Score not found', 404, 'NOT_FOUND')

    const classId = await resolveStudentClassInSemester(req.tenantId, existing.studentId, existing.semesterId)
    const classSnapshot = classId
      ? await prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, select: { id: true, name: true } })
      : null
    const actor = createActorSnapshot(req.user)

    const score = await prisma.$transaction(async (tx) => {
      const updated = await tx.score.update({
        where: { id: req.params.id },
        data: { isLocked: true }
      })

      await tx.scoreHistory.create({
        data: createScoreHistoryPayload({
          tenantId: req.tenantId,
          scoreId: updated.id,
          studentId: existing.student.id,
          studentCode: existing.student.studentCode,
          studentName: existing.student.fullName,
          classId: classSnapshot?.id || null,
          className: classSnapshot?.name || null,
          subjectId: existing.subject.id,
          subjectName: existing.subject.name,
          semesterId: existing.semester.id,
          semesterName: existing.semester.name,
          scoreComponentId: existing.scoreComponent.id,
          scoreComponentName: existing.scoreComponent.name,
          action: 'LOCK',
          oldValue: existing.value,
          newValue: existing.value,
          actor,
        })
      })

      return updated
    })

    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// PATCH /scores/:id/unlock
router.patch('/:id/unlock', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.score.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        subject: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        scoreComponent: { select: { id: true, name: true } },
      }
    })
    if (!existing) throw new AppError('Score not found', 404, 'NOT_FOUND')

    const classId = await resolveStudentClassInSemester(req.tenantId, existing.studentId, existing.semesterId)
    const classSnapshot = classId
      ? await prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, select: { id: true, name: true } })
      : null
    const actor = createActorSnapshot(req.user)

    const score = await prisma.$transaction(async (tx) => {
      const updated = await tx.score.update({
        where: { id: req.params.id },
        data: { isLocked: false }
      })

      await tx.scoreHistory.create({
        data: createScoreHistoryPayload({
          tenantId: req.tenantId,
          scoreId: updated.id,
          studentId: existing.student.id,
          studentCode: existing.student.studentCode,
          studentName: existing.student.fullName,
          classId: classSnapshot?.id || null,
          className: classSnapshot?.name || null,
          subjectId: existing.subject.id,
          subjectName: existing.subject.name,
          semesterId: existing.semester.id,
          semesterName: existing.semester.name,
          scoreComponentId: existing.scoreComponent.id,
          scoreComponentName: existing.scoreComponent.name,
          action: 'UNLOCK',
          oldValue: existing.value,
          newValue: existing.value,
          actor,
        })
      })

      return updated
    })

    res.json({ data: score })
  } catch (error) {
    next(error)
  }
})

// POST /scores/class/:classId/lock — Lock all scores for a class+subject+semester
router.post('/class/:classId/lock', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.body

    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const classCheck = await prisma.class.findFirst({ where: { id: req.params.classId, tenantId: req.tenantId }, select: { id: true, name: true } })
    if (!classCheck) throw new AppError('Class not found', 404, 'NOT_FOUND')
    await ensureClassSubjectAccess(prisma, req, req.params.classId, subjectId, { semesterId })

    const studentIds = await getStudentIdsForClassAndSemester(req.tenantId, req.params.classId, semesterId)

    const affectedScores = await prisma.score.findMany({
      where: {
        studentId: { in: studentIds },
        subjectId,
        semesterId,
        tenantId: req.tenantId
      },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        subject: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        scoreComponent: { select: { id: true, name: true } },
      }
    })

    const actor = createActorSnapshot(req.user)

    const result = await prisma.$transaction(async (tx) => {
      const updatedResult = await tx.score.updateMany({
        where: {
          studentId: { in: studentIds },
          subjectId,
          semesterId,
          tenantId: req.tenantId
        },
        data: { isLocked: true }
      })

      if (affectedScores.length > 0) {
        await tx.scoreHistory.createMany({
          data: affectedScores.map((score) => createScoreHistoryPayload({
            tenantId: req.tenantId,
            scoreId: score.id,
            studentId: score.student.id,
            studentCode: score.student.studentCode,
            studentName: score.student.fullName,
            classId: classCheck.id,
            className: classCheck.name,
            subjectId: score.subject.id,
            subjectName: score.subject.name,
            semesterId: score.semester.id,
            semesterName: score.semester.name,
            scoreComponentId: score.scoreComponent.id,
            scoreComponentName: score.scoreComponent.name,
            action: 'LOCK',
            oldValue: score.value,
            newValue: score.value,
            actor,
          }))
        })
      }

      return updatedResult
    })

    res.json({ data: { message: `Locked ${result.count} scores` } })
  } catch (error) {
    next(error)
  }
})

// POST /scores/class/:classId/unlock — Unlock all scores for a class+subject+semester
router.post('/class/:classId/unlock', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.body

    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const classCheck = await prisma.class.findFirst({ where: { id: req.params.classId, tenantId: req.tenantId }, select: { id: true, name: true } })
    if (!classCheck) throw new AppError('Class not found', 404, 'NOT_FOUND')
    await ensureClassSubjectAccess(prisma, req, req.params.classId, subjectId, { semesterId })

    const studentIds = await getStudentIdsForClassAndSemester(req.tenantId, req.params.classId, semesterId)

    const affectedScores = await prisma.score.findMany({
      where: {
        studentId: { in: studentIds },
        subjectId,
        semesterId,
        tenantId: req.tenantId
      },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        subject: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        scoreComponent: { select: { id: true, name: true } },
      }
    })

    const actor = createActorSnapshot(req.user)

    const result = await prisma.$transaction(async (tx) => {
      const updatedResult = await tx.score.updateMany({
        where: {
          studentId: { in: studentIds },
          subjectId,
          semesterId,
          tenantId: req.tenantId
        },
        data: { isLocked: false }
      })

      if (affectedScores.length > 0) {
        await tx.scoreHistory.createMany({
          data: affectedScores.map((score) => createScoreHistoryPayload({
            tenantId: req.tenantId,
            scoreId: score.id,
            studentId: score.student.id,
            studentCode: score.student.studentCode,
            studentName: score.student.fullName,
            classId: classCheck.id,
            className: classCheck.name,
            subjectId: score.subject.id,
            subjectName: score.subject.name,
            semesterId: score.semester.id,
            semesterName: score.semester.name,
            scoreComponentId: score.scoreComponent.id,
            scoreComponentName: score.scoreComponent.name,
            action: 'UNLOCK',
            oldValue: score.value,
            newValue: score.value,
            actor,
          }))
        })
      }

      return updatedResult
    })

    res.json({ data: { message: `Unlocked ${result.count} scores` } })
  } catch (error) {
    next(error)
  }
})

// DELETE /scores/:id
router.delete('/:id', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.score.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        subject: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        scoreComponent: { select: { id: true, name: true } },
      }
    })
    if (!existing) throw new AppError('Score not found', 404, 'NOT_FOUND')

    const classId = await resolveStudentClassInSemester(req.tenantId, existing.studentId, existing.semesterId)
    const classSnapshot = classId
      ? await prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, select: { id: true, name: true } })
      : null
    const actor = createActorSnapshot(req.user)

    await prisma.$transaction(async (tx) => {
      await tx.score.delete({ where: { id: req.params.id } })
      await tx.scoreHistory.create({
        data: createScoreHistoryPayload({
          tenantId: req.tenantId,
          scoreId: existing.id,
          studentId: existing.student.id,
          studentCode: existing.student.studentCode,
          studentName: existing.student.fullName,
          classId: classSnapshot?.id || null,
          className: classSnapshot?.name || null,
          subjectId: existing.subject.id,
          subjectName: existing.subject.name,
          semesterId: existing.semester.id,
          semesterName: existing.semester.name,
          scoreComponentId: existing.scoreComponent.id,
          scoreComponentName: existing.scoreComponent.name,
          action: 'DELETE',
          oldValue: existing.value,
          newValue: null,
          actor,
        })
      })
    })

    res.json({ data: { message: 'Score deleted' } })
  } catch (error) {
    next(error)
  }
})

// GET /scores/student/:studentId/yearly - BM7: Tra cứu điểm cả năm
router.get('/student/:studentId/yearly', async (req, res, next) => {
  try {
    const { studentId } = req.params
    const { year } = req.query

    await assertAssignedUserCanAccessStudent(req, studentId)

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
    const semesterNumToId = {}
    for (const sem of semesters) {
      semesterNumToId[sem.semesterNum] = sem
    }

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
        if (!s.scoreComponent || s.scoreComponent.isActive === false) continue
        weightedSum += s.value * s.scoreComponent.weight
        totalWeight += s.scoreComponent.weight
      }
      return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
    }

    const subjects = Object.values(subjectMap).map(({ subject, semesters: semScores }) => {
      // Build dynamic semester averages (supports 1, 2, 3+ semesters)
      const semesterAverages = {}
      for (const semesterNum of Object.keys(semScores)) {
        semesterAverages[semesterNum] = calcWeightedAvg(semScores[semesterNum] || [])
      }

      // Keep backward-compat fields for 2-semester schools
      const semester1Average = semesterAverages[1] ?? null
      const semester2Average = semesterAverages[2] ?? null

      // Calculate yearly average from all available semesters
      const allSemAvgs = Object.values(semesterAverages).filter((v) => v != null)
      const yearlyAverage = allSemAvgs.length > 0
        ? Math.round((allSemAvgs.reduce((a, b) => a + b, 0) / allSemAvgs.length) * 100) / 100
        : null

      return {
        subject: { id: subject.id, name: subject.name },
        semesterAverages,
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
