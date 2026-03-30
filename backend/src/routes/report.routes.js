const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// Helper: Calculate weighted average from scores with scoreComponent
function calcWeightedAverage (scores) {
  let weightedSum = 0
  let totalWeight = 0
  for (const s of scores) {
    if (s.scoreComponent) {
      weightedSum += s.value * s.scoreComponent.weight
      totalWeight += s.scoreComponent.weight
    }
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
}

// GET /reports/subject-summary - Subject summary report
router.get('/subject-summary', authenticate, async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query
    if (!subjectId || !semesterId) {
      throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    const classes = await prisma.class.findMany({
      where: { tenantId: req.tenantId, isActive: true },
      include: {
        grade: true,
        students: { where: { isActive: true } }
      },
      orderBy: { name: 'asc' }
    })

    const classStats = await Promise.all(
      classes.map(async (cls) => {
        const studentIds = cls.students.map(s => s.id)
        if (studentIds.length === 0) {
          return { class: { id: cls.id, name: cls.name, grade: cls.grade }, totalStudents: 0, passedStudents: 0, passRate: 0, averageScore: 0 }
        }

        const scores = await prisma.score.findMany({
          where: { studentId: { in: studentIds }, subjectId, semesterId, tenantId: req.tenantId },
          include: { scoreComponent: true }
        })

        let passedCount = 0
        let totalAvg = 0
        let withScores = 0

        for (const sid of studentIds) {
          const studentScores = scores.filter(s => s.studentId === sid)
          const avg = calcWeightedAverage(studentScores)
          if (avg !== null) {
            totalAvg += avg
            withScores++
            if (avg >= settings.passScore) passedCount++
          }
        }

        const avgScore = withScores > 0 ? Math.round((totalAvg / withScores) * 100) / 100 : 0
        const passRate = studentIds.length > 0 ? Math.round((passedCount / studentIds.length) * 10000) / 100 : 0

        return {
          class: { id: cls.id, name: cls.name, grade: cls.grade },
          totalStudents: studentIds.length,
          passedStudents: passedCount,
          passRate,
          averageScore: avgScore
        }
      })
    )

    const [subject, semester] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
    ])

    const totalStudents = classStats.reduce((s, c) => s + c.totalStudents, 0)
    const totalPassed = classStats.reduce((s, c) => s + c.passedStudents, 0)
    const overallPassRate = totalStudents > 0 ? Math.round((totalPassed / totalStudents) * 10000) / 100 : 0
    const activeClasses = classStats.filter(c => c.totalStudents > 0)
    const overallAverage = activeClasses.length > 0
      ? Math.round((activeClasses.reduce((s, c) => s + c.averageScore, 0) / activeClasses.length) * 100) / 100
      : 0

    res.json({
      data: {
        subject, semester, passScore: settings.passScore,
        classes: classStats,
        summary: { totalStudents, totalPassed, passRate: overallPassRate, averageScore: overallAverage }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/semester-summary - Semester summary report
router.get('/semester-summary', authenticate, async (req, res, next) => {
  try {
    const { semesterId } = req.query
    if (!semesterId) throw new AppError('semesterId is required', 400, 'MISSING_PARAMS')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const subjects = await prisma.subject.findMany({ where: { tenantId: req.tenantId, isActive: true } })

    const classes = await prisma.class.findMany({
      where: { tenantId: req.tenantId, isActive: true },
      include: { grade: true, students: { where: { isActive: true } } },
      orderBy: { name: 'asc' }
    })

    const classStats = await Promise.all(
      classes.map(async (cls) => {
        const studentIds = cls.students.map(s => s.id)
        if (studentIds.length === 0) {
          return { class: { id: cls.id, name: cls.name, grade: cls.grade }, totalStudents: 0, passedStudents: 0, passRate: 0, averageScore: 0 }
        }

        const scores = await prisma.score.findMany({
          where: { studentId: { in: studentIds }, semesterId, tenantId: req.tenantId },
          include: { scoreComponent: true }
        })

        let passedCount = 0
        let totalAvg = 0
        let withScores = 0

        for (const sid of studentIds) {
          const studentScores = scores.filter(s => s.studentId === sid)

          // Average across all subjects
          const subjectAverages = []
          for (const subj of subjects) {
            const subjScores = studentScores.filter(s => s.subjectId === subj.id)
            const avg = calcWeightedAverage(subjScores)
            if (avg !== null) subjectAverages.push(avg)
          }

          if (subjectAverages.length > 0) {
            const overallAvg = subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length
            totalAvg += overallAvg
            withScores++
            if (overallAvg >= settings.passScore) passedCount++
          }
        }

        const avgScore = withScores > 0 ? Math.round((totalAvg / withScores) * 100) / 100 : 0
        const passRate = studentIds.length > 0 ? Math.round((passedCount / studentIds.length) * 10000) / 100 : 0

        return {
          class: { id: cls.id, name: cls.name, grade: cls.grade },
          totalStudents: studentIds.length,
          passedStudents: passedCount,
          passRate,
          averageScore: avgScore
        }
      })
    )

    const semester = await prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
    const totalStudents = classStats.reduce((s, c) => s + c.totalStudents, 0)
    const totalPassed = classStats.reduce((s, c) => s + c.passedStudents, 0)
    const overallPassRate = totalStudents > 0 ? Math.round((totalPassed / totalStudents) * 10000) / 100 : 0
    const activeClasses = classStats.filter(c => c.totalStudents > 0)
    const overallAverage = activeClasses.length > 0
      ? Math.round((activeClasses.reduce((s, c) => s + c.averageScore, 0) / activeClasses.length) * 100) / 100
      : 0

    res.json({
      data: {
        semester, passScore: settings.passScore,
        classes: classStats,
        summary: { totalStudents, totalPassed, passRate: overallPassRate, averageScore: overallAverage }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/dashboard - Dashboard stats
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    const [totalStudents, totalClasses, totalSubjects, activeSemester, recentStudents, gradeDistribution] = await Promise.all([
      prisma.student.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.class.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.subject.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.semester.findFirst({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.student.findMany({
        where: { tenantId: req.tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: { include: { grade: true } } }
      }),
      prisma.grade.findMany({
        where: { tenantId: req.tenantId },
        include: {
          classes: {
            where: { isActive: true },
            include: { _count: { select: { students: true } } }
          }
        },
        orderBy: { level: 'asc' }
      })
    ])

    const gradeStats = gradeDistribution.map(g => ({
      grade: g.name, level: g.level,
      classCount: g.classes.length,
      studentCount: g.classes.reduce((sum, c) => sum + c._count.students, 0)
    }))

    res.json({
      data: {
        stats: { totalStudents, totalClasses, totalSubjects, maxClassSize: settings.maxClassSize },
        activeSemester, recentStudents, gradeStats
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/transfer-report - BM8: Báo cáo chuyển lớp
router.get('/transfer-report', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { semesterId } = req.query

    const where = {
      tenantId: req.tenantId,
      ...(semesterId && { semesterId })
    }

    const transfers = await prisma.transferHistory.findMany({
      where,
      include: {
        student: { select: { id: true, studentCode: true, fullName: true } },
        fromClass: { select: { id: true, name: true } },
        toClass: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, year: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({
      data: {
        transfers,
        totalTransfers: transfers.length
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /reports/retention-report - BM9: Báo cáo HS lưu ban
router.get('/retention-report', authenticate, authorize('SUPER_ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { semesterId } = req.query

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })

    const failWhere = {
      tenantId: req.tenantId,
      result: 'FAIL',
      ...(semesterId && { semesterId })
    }

    const failPromotions = await prisma.promotion.findMany({
      where: failWhere,
      include: {
        student: { select: { id: true, studentCode: true, fullName: true, isActive: true } },
        class: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, year: true } }
      }
    })

    // Count total FAIL records per student (across all semesters)
    const studentFailCounts = {}
    const allFails = await prisma.promotion.findMany({
      where: { tenantId: req.tenantId, result: 'FAIL' },
      select: { studentId: true }
    })
    for (const f of allFails) {
      studentFailCounts[f.studentId] = (studentFailCounts[f.studentId] || 0) + 1
    }

    const retentions = failPromotions.map(p => ({
      student: p.student,
      class: p.class,
      semester: p.semester,
      retentionCount: studentFailCounts[p.studentId] || 1,
      handling: (studentFailCounts[p.studentId] || 1) >= settings.maxRetentions
        ? 'Ngừng tiếp nhận'
        : 'Lưu ban'
    }))

    res.json({
      data: {
        retentions,
        maxRetentions: settings.maxRetentions
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
