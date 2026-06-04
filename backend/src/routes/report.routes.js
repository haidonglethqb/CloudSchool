const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getUserAssignmentScope, ensureClassAccess } = require('../utils/assignment-scope')

function calcWeightedAverage(scores) {
  let weightedSum = 0
  let totalWeight = 0
  for (const score of scores) {
    if (!score.scoreComponent || score.scoreComponent.isActive === false) continue
    weightedSum += score.value * score.scoreComponent.weight
    totalWeight += score.scoreComponent.weight
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
}

const buildAcademicYearLabel = (academicYear) => `${academicYear.startYear}-${academicYear.endYear}`

const getScopedClassIds = async (req, subjectId = null) => {
  const scope = await getUserAssignmentScope(prisma, req, subjectId)
  return scope ? scope.classIds : null
}

const getSemesterClassFilter = async (tenantId, semesterId) => {
  if (!semesterId) return {}
  const semester = await prisma.semester.findFirst({
    where: { tenantId, id: semesterId },
    include: { academicYear: true }
  })
  if (!semester) throw new AppError('Semester not found', 404, 'NOT_FOUND')
  if (semester.academicYearId) return { academicYearId: semester.academicYearId }
  if (semester.academicYear) return { academicYear: buildAcademicYearLabel(semester.academicYear) }
  if (semester.year) return { academicYear: semester.year }
  return {}
}

const getCalendarContext = async (tenantId, selectedAcademicYearId = null, selectedSemesterId = null, options = {}) => {
  const academicYears = await prisma.academicYear.findMany({
    where: { tenantId },
    include: { semesters: { orderBy: { semesterNum: 'asc' } } },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }, { startYear: 'desc' }]
  })
  if (academicYears.length === 0) return { academicYears: [], selectedAcademicYear: null, selectedSemester: null }

  let selectedAcademicYear = selectedAcademicYearId
    ? academicYears.find((year) => year.id === selectedAcademicYearId)
    : options.defaultToAllYears
      ? null
      : academicYears.find((year) => year.isActive) || academicYears[0]

  let selectedSemester = null
  if (selectedSemesterId) {
    selectedSemester = academicYears.flatMap((year) => year.semesters).find((semester) => semester.id === selectedSemesterId) || null
    if (selectedSemester?.academicYearId) {
      selectedAcademicYear = academicYears.find((year) => year.id === selectedSemester.academicYearId) || null
    }
  }

  if (!options.defaultToAllYears && selectedAcademicYear && !selectedSemester) {
    selectedSemester = selectedAcademicYear.semesters.find((semester) => semester.isActive) || selectedAcademicYear.semesters[selectedAcademicYear.semesters.length - 1] || null
  }

  return { academicYears, selectedAcademicYear, selectedSemester }
}

router.use(authenticate, requireFeature('reports'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('reports'))

// GET /reports/subject-summary (BM1)
router.get('/subject-summary', async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query
    if (!subjectId || !semesterId) throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (!settings) throw new AppError('Tenant settings not configured', 400, 'SETTINGS_NOT_FOUND')

    const yearFilter = await getSemesterClassFilter(req.tenantId, semesterId)
    const teacherClassIds = await getScopedClassIds(req, subjectId)
    const classes = await prisma.class.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true,
        ...yearFilter,
        ...(teacherClassIds ? { id: { in: teacherClassIds } } : {})
      },
      include: { grade: true, students: { where: { isActive: true } } },
      orderBy: { name: 'asc' }
    })

    const allStudentIds = classes.flatMap((cls) => cls.students.map((student) => student.id))
    const allScores = allStudentIds.length
      ? await prisma.score.findMany({
          where: { studentId: { in: allStudentIds }, subjectId, semesterId, tenantId: req.tenantId },
          include: { scoreComponent: true }
        })
      : []

    const scoresByStudent = {}
    for (const score of allScores) {
      if (!scoresByStudent[score.studentId]) scoresByStudent[score.studentId] = []
      scoresByStudent[score.studentId].push(score)
    }

    const classStats = classes.map((cls) => {
      const studentIds = cls.students.map((student) => student.id)
      let passedCount = 0
      let totalAvg = 0
      let withScores = 0

      for (const studentId of studentIds) {
        const avg = calcWeightedAverage(scoresByStudent[studentId] || [])
        if (avg === null) continue
        totalAvg += avg
        withScores += 1
        if (avg >= settings.passScore) passedCount += 1
      }

      const averageScore = withScores > 0 ? Math.round((totalAvg / withScores) * 100) / 100 : 0
      const passRate = studentIds.length > 0 ? Math.round((passedCount / studentIds.length) * 10000) / 100 : 0

      return {
        class: { id: cls.id, name: cls.name, grade: cls.grade },
        totalStudents: studentIds.length,
        passedStudents: passedCount,
        passRate,
        averageScore
      }
    })

    const [subject, semester] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } }),
    ])

    const totalStudents = classStats.reduce((sum, item) => sum + item.totalStudents, 0)
    const totalPassed = classStats.reduce((sum, item) => sum + item.passedStudents, 0)
    const passRate = totalStudents > 0 ? Math.round((totalPassed / totalStudents) * 10000) / 100 : 0
    const averageScore = classStats.length > 0
      ? Math.round((classStats.reduce((sum, item) => sum + item.averageScore, 0) / classStats.length) * 100) / 100
      : 0

    res.json({
      data: {
        subject,
        semester,
        passScore: settings.passScore,
        classes: classStats,
        summary: { totalStudents, totalPassed, passRate, averageScore }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/class-promotion-summary (BM2)
router.get('/class-promotion-summary', async (req, res, next) => {
  try {
    const { classId, semesterId } = req.query
    if (!classId || !semesterId) throw new AppError('classId and semesterId are required', 400, 'MISSING_PARAMS')

    await ensureClassAccess(prisma, req, classId)

    const classInfo = await prisma.class.findFirst({
      where: { id: classId, tenantId: req.tenantId },
      include: { grade: true }
    })
    if (!classInfo) throw new AppError('Class not found', 404, 'NOT_FOUND')

    const promotions = await prisma.promotion.findMany({
      where: { tenantId: req.tenantId, classId, semesterId },
      include: { student: { select: { id: true, fullName: true, studentCode: true } } },
      orderBy: { student: { fullName: 'asc' } }
    })

    const totalStudents = promotions.length
    const passStudents = promotions.filter((item) => item.result === 'PASS')
    const failStudents = promotions.filter((item) => item.result === 'FAIL')
    const retakeStudents = promotions.filter((item) => item.result === 'RETAKE')

    res.json({
      data: {
        class: classInfo,
        semesterId,
        students: promotions,
        summary: {
          totalStudents,
          passStudents: passStudents.length,
          failStudents: failStudents.length,
          retakeStudents: retakeStudents.length,
          passRate: totalStudents > 0 ? Math.round((passStudents.length / totalStudents) * 10000) / 100 : 0
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/semester-promotion-summary (BM3)
router.get('/semester-promotion-summary', async (req, res, next) => {
  try {
    const { semesterId } = req.query
    if (!semesterId) throw new AppError('semesterId is required', 400, 'MISSING_PARAMS')

    const semester = await prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
    if (!semester) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    const teacherClassIds = await getScopedClassIds(req)
    const promotions = await prisma.promotion.findMany({
      where: {
        tenantId: req.tenantId,
        semesterId,
        ...(teacherClassIds ? { classId: { in: teacherClassIds } } : {})
      },
      include: { class: { include: { grade: true } } }
    })

    const classMap = new Map()
    for (const promotion of promotions) {
      const key = promotion.classId
      if (!classMap.has(key)) {
        classMap.set(key, {
          class: promotion.class,
          totalStudents: 0,
          passStudents: 0,
          retakeStudents: 0
        })
      }
      const bucket = classMap.get(key)
      bucket.totalStudents += 1
      if (promotion.result === 'PASS') bucket.passStudents += 1
      if (promotion.result === 'RETAKE') bucket.retakeStudents += 1
    }

    const classes = [...classMap.values()].map((item) => ({
      class: item.class,
      totalStudents: item.totalStudents,
      passStudents: item.passStudents,
      retakeStudents: item.retakeStudents,
      failStudents: item.totalStudents - item.passStudents - item.retakeStudents,
      passRate: item.totalStudents > 0 ? Math.round((item.passStudents / item.totalStudents) * 10000) / 100 : 0
    }))

    const totalStudents = classes.reduce((sum, item) => sum + item.totalStudents, 0)
    const passStudents = classes.reduce((sum, item) => sum + item.passStudents, 0)
    const retakeStudents = classes.reduce((sum, item) => sum + item.retakeStudents, 0)

    res.json({
      data: {
        semester,
        classes,
        summary: {
          totalStudents,
          passStudents,
          retakeStudents,
          failStudents: totalStudents - passStudents - retakeStudents,
          passRate: totalStudents > 0 ? Math.round((passStudents / totalStudents) * 10000) / 100 : 0
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/year-promotion-summary (BM4)
router.get('/year-promotion-summary', async (req, res, next) => {
  try {
    const { academicYearId } = req.query
    if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')

    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: req.tenantId },
      include: { semesters: { orderBy: { semesterNum: 'asc' } } }
    })
    if (!year) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
    if (year.semesters.length === 0) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')

    const finalSemester = year.semesters[year.semesters.length - 1]
    const teacherClassIds = await getScopedClassIds(req)
    const promotions = await prisma.promotion.findMany({
      where: {
        tenantId: req.tenantId,
        semesterId: finalSemester.id,
        ...(teacherClassIds ? { classId: { in: teacherClassIds } } : {})
      },
      include: { class: { include: { grade: true } } }
    })

    const gradeMap = new Map()
    for (const promotion of promotions) {
      const key = promotion.class.grade.id
      if (!gradeMap.has(key)) {
        gradeMap.set(key, {
          grade: promotion.class.grade,
          totalStudents: 0,
          passStudents: 0,
          retakeStudents: 0
        })
      }
      const bucket = gradeMap.get(key)
      bucket.totalStudents += 1
      if (promotion.result === 'PASS') bucket.passStudents += 1
      if (promotion.result === 'RETAKE') bucket.retakeStudents += 1
    }

    const grades = [...gradeMap.values()]
      .sort((a, b) => a.grade.level - b.grade.level)
      .map((item) => ({
        grade: item.grade,
        totalStudents: item.totalStudents,
        passStudents: item.passStudents,
        retakeStudents: item.retakeStudents,
        failStudents: item.totalStudents - item.passStudents - item.retakeStudents,
        passRate: item.totalStudents > 0 ? Math.round((item.passStudents / item.totalStudents) * 10000) / 100 : 0
      }))

    const totalStudents = grades.reduce((sum, item) => sum + item.totalStudents, 0)
    const passStudents = grades.reduce((sum, item) => sum + item.passStudents, 0)
    const retakeStudents = grades.reduce((sum, item) => sum + item.retakeStudents, 0)

    res.json({
      data: {
        academicYear: year,
        semester: finalSemester,
        grades,
        summary: {
          totalStudents,
          passStudents,
          retakeStudents,
          failStudents: totalStudents - passStudents - retakeStudents,
          passRate: totalStudents > 0 ? Math.round((passStudents / totalStudents) * 10000) / 100 : 0
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const { academicYearId, semesterId, allYears } = req.query
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    if (!settings) throw new AppError('Tenant settings not configured', 400, 'SETTINGS_NOT_FOUND')

    const { academicYears, selectedAcademicYear, selectedSemester } = await getCalendarContext(req.tenantId, academicYearId, semesterId, {
      defaultToAllYears: allYears === 'true' && !academicYearId && !semesterId
    })

    const classWhere = { tenantId: req.tenantId, isActive: true }
    const studentWhere = { tenantId: req.tenantId, isActive: true }

    if (selectedAcademicYear) {
      const yearLabel = buildAcademicYearLabel(selectedAcademicYear)
      classWhere.OR = [{ academicYearId: selectedAcademicYear.id }, { academicYear: yearLabel }]
      studentWhere.class = {
        OR: [{ academicYearId: selectedAcademicYear.id }, { academicYear: yearLabel }]
      }
    }

    const scopedClassIds = await getScopedClassIds(req)
    if (scopedClassIds) {
      classWhere.id = { in: scopedClassIds }
      studentWhere.classId = { in: scopedClassIds }
    }

    const [totalStudents, totalClasses, totalSubjects, recentStudents, gradeDistribution] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.class.count({ where: classWhere }),
      prisma.subject.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.student.findMany({
        where: studentWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: { include: { grade: true } } }
      }),
      prisma.grade.findMany({
        where: { tenantId: req.tenantId },
        include: {
          classes: {
            where: classWhere,
            include: { _count: { select: { students: true } } }
          }
        },
        orderBy: { level: 'asc' }
      })
    ])

    const gradeStats = gradeDistribution.map((grade) => ({
      grade: grade.name,
      level: grade.level,
      classCount: grade.classes.length,
      studentCount: grade.classes.reduce((sum, cls) => sum + cls._count.students, 0)
    }))

    res.json({
      data: {
        stats: { totalStudents, totalClasses, totalSubjects, maxClassSize: settings.maxClassSize },
        selectedAcademicYear,
        selectedSemester,
        academicYears: academicYears.map((year) => ({
          id: year.id,
          startYear: year.startYear,
          endYear: year.endYear,
          isActive: year.isActive,
          semesterCount: year.semesters.length,
          semesters: year.semesters.map((semester) => ({
            id: semester.id,
            name: semester.name,
            year: semester.year,
            semesterNum: semester.semesterNum,
            academicYearId: semester.academicYearId,
            startDate: semester.startDate,
            endDate: semester.endDate,
            isActive: semester.isActive
          }))
        })),
        recentStudents,
        gradeStats
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/transfer-report
router.get('/transfer-report', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { semesterId } = req.query
    const transfers = await prisma.transferHistory.findMany({
      where: { tenantId: req.tenantId, ...(semesterId && { semesterId }) },
      include: {
        student: { select: { id: true, studentCode: true, fullName: true } },
        fromClass: { select: { id: true, name: true } },
        toClass: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, year: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ data: { transfers, totalTransfers: transfers.length } })
  } catch (error) {
    next(error)
  }
})

// GET /reports/graduation-summary
router.get('/graduation-summary', authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { academicYearId } = req.query
    if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')

    const academicYear = await prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: req.tenantId }
    })
    if (!academicYear) throw new AppError('Academic year not found', 404, 'NOT_FOUND')

    const graduations = await prisma.graduationArchive.findMany({
      where: { tenantId: req.tenantId, academicYearId },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true, gender: true, dateOfBirth: true, admissionDate: true } },
        sourceClass: { select: { id: true, name: true } }
      },
      orderBy: [{ sourceClass: { name: 'asc' } }, { student: { fullName: 'asc' } }]
    })

    const graduates = graduations.map((item) => {
      const admissionYear = item.student?.admissionDate ? new Date(item.student.admissionDate).getFullYear() : null
      const startYear = Number.isFinite(admissionYear) ? admissionYear : (academicYear.endYear - 3)
      const birthYear = item.student?.dateOfBirth ? new Date(item.student.dateOfBirth).getFullYear() : null
      return {
        ...item,
        age: birthYear ? academicYear.endYear - birthYear : null,
        courseLabel: `${startYear}-${academicYear.endYear}`
      }
    })

    res.json({
      data: {
        academicYear: {
          id: academicYear.id,
          startYear: academicYear.startYear,
          endYear: academicYear.endYear
        },
        graduates,
        summary: {
          totalGraduated: graduates.length
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
