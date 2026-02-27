const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// BM5.1 - Báo cáo tổng kết môn (Subject Summary Report)
router.get('/subject-summary', authenticate, async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query

    if (!subjectId || !semesterId) {
      throw new AppError('Subject ID and Semester ID are required', 400, 'MISSING_PARAMS')
    }

    // Get tenant settings
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    // Get all classes
    const classes = await prisma.class.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true
      },
      include: {
        grade: true,
        students: {
          where: { isActive: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Calculate statistics for each class
    const classStats = await Promise.all(
      classes.map(async (classInfo) => {
        const studentIds = classInfo.students.map(s => s.id)
        
        if (studentIds.length === 0) {
          return {
            class: classInfo,
            totalStudents: 0,
            passedStudents: 0,
            passRate: 0,
            averageScore: 0
          }
        }

        // Get all scores for students in this class
        const scores = await prisma.score.findMany({
          where: {
            studentId: { in: studentIds },
            subjectId,
            semesterId
          }
        })

        // Group scores by student
        const studentScores = {}
        for (const score of scores) {
          if (!studentScores[score.studentId]) {
            studentScores[score.studentId] = { quiz15: [], quiz45: [], final: [] }
          }
          if (score.scoreType === 'QUIZ_15') studentScores[score.studentId].quiz15.push(score.value)
          if (score.scoreType === 'QUIZ_45') studentScores[score.studentId].quiz45.push(score.value)
          if (score.scoreType === 'FINAL') studentScores[score.studentId].final.push(score.value)
        }

        // Calculate average for each student
        let passedCount = 0
        let totalAverage = 0
        let studentsWithScores = 0

        for (const studentId of studentIds) {
          const s = studentScores[studentId]
          if (!s) continue

          const avg15 = s.quiz15.length > 0 ? s.quiz15.reduce((a, b) => a + b, 0) / s.quiz15.length : null
          const avg45 = s.quiz45.length > 0 ? s.quiz45.reduce((a, b) => a + b, 0) / s.quiz45.length : null
          const avgFinal = s.final.length > 0 ? s.final.reduce((a, b) => a + b, 0) / s.final.length : null

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

          if (totalWeight > 0) {
            const average = weightedSum / totalWeight
            totalAverage += average
            studentsWithScores++
            if (average >= settings.passScore) {
              passedCount++
            }
          }
        }

        const avgScore = studentsWithScores > 0 ? totalAverage / studentsWithScores : 0
        const passRate = studentIds.length > 0 ? (passedCount / studentIds.length) * 100 : 0

        return {
          class: {
            id: classInfo.id,
            name: classInfo.name,
            grade: classInfo.grade
          },
          totalStudents: studentIds.length,
          passedStudents: passedCount,
          passRate: Math.round(passRate * 100) / 100,
          averageScore: Math.round(avgScore * 100) / 100
        }
      })
    )

    // Get subject and semester info
    const [subject, semester] = await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.semester.findUnique({ where: { id: semesterId } })
    ])

    // Calculate overall statistics
    const totalStudents = classStats.reduce((sum, c) => sum + c.totalStudents, 0)
    const totalPassed = classStats.reduce((sum, c) => sum + c.passedStudents, 0)
    const overallPassRate = totalStudents > 0 ? (totalPassed / totalStudents) * 100 : 0
    const overallAverage = classStats.length > 0
      ? classStats.reduce((sum, c) => sum + c.averageScore, 0) / classStats.filter(c => c.totalStudents > 0).length
      : 0

    res.json({
      data: {
        subject,
        semester,
        passScore: settings.passScore,
        classes: classStats,
        summary: {
          totalStudents,
          totalPassed,
          passRate: Math.round(overallPassRate * 100) / 100,
          averageScore: Math.round(overallAverage * 100) / 100
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// BM5.2 - Báo cáo tổng kết học kỳ (Semester Summary Report)
router.get('/semester-summary', authenticate, async (req, res, next) => {
  try {
    const { semesterId } = req.query

    if (!semesterId) {
      throw new AppError('Semester ID is required', 400, 'MISSING_PARAMS')
    }

    // Get tenant settings
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    // Get all subjects
    const subjects = await prisma.subject.findMany({
      where: { tenantId: req.tenantId, isActive: true }
    })

    // Get all classes
    const classes = await prisma.class.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true
      },
      include: {
        grade: true,
        students: {
          where: { isActive: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Calculate statistics for each class (overall across all subjects)
    const classStats = await Promise.all(
      classes.map(async (classInfo) => {
        const studentIds = classInfo.students.map(s => s.id)
        
        if (studentIds.length === 0) {
          return {
            class: classInfo,
            totalStudents: 0,
            passedStudents: 0,
            passRate: 0,
            averageScore: 0
          }
        }

        // Get all scores for students in this class for this semester
        const scores = await prisma.score.findMany({
          where: {
            studentId: { in: studentIds },
            semesterId
          }
        })

        // Calculate overall average for each student across all subjects
        let passedCount = 0
        let totalAverage = 0
        let studentsWithScores = 0

        for (const studentId of studentIds) {
          const studentScores = scores.filter(s => s.studentId === studentId)
          
          // Group by subject
          const subjectAverages = []
          for (const subject of subjects) {
            const subjectScores = studentScores.filter(s => s.subjectId === subject.id)
            
            const quiz15 = subjectScores.filter(s => s.scoreType === 'QUIZ_15').map(s => s.value)
            const quiz45 = subjectScores.filter(s => s.scoreType === 'QUIZ_45').map(s => s.value)
            const final = subjectScores.filter(s => s.scoreType === 'FINAL').map(s => s.value)

            const avg15 = quiz15.length > 0 ? quiz15.reduce((a, b) => a + b, 0) / quiz15.length : null
            const avg45 = quiz45.length > 0 ? quiz45.reduce((a, b) => a + b, 0) / quiz45.length : null
            const avgFinal = final.length > 0 ? final.reduce((a, b) => a + b, 0) / final.length : null

            let totalWeight = 0
            let weightedSum = 0

            if (avg15 !== null) { weightedSum += avg15 * settings.quiz15Weight; totalWeight += settings.quiz15Weight }
            if (avg45 !== null) { weightedSum += avg45 * settings.quiz45Weight; totalWeight += settings.quiz45Weight }
            if (avgFinal !== null) { weightedSum += avgFinal * settings.finalWeight; totalWeight += settings.finalWeight }

            if (totalWeight > 0) {
              subjectAverages.push(weightedSum / totalWeight)
            }
          }

          if (subjectAverages.length > 0) {
            const overallAvg = subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length
            totalAverage += overallAvg
            studentsWithScores++
            if (overallAvg >= settings.passScore) {
              passedCount++
            }
          }
        }

        const avgScore = studentsWithScores > 0 ? totalAverage / studentsWithScores : 0
        const passRate = studentIds.length > 0 ? (passedCount / studentIds.length) * 100 : 0

        return {
          class: {
            id: classInfo.id,
            name: classInfo.name,
            grade: classInfo.grade
          },
          totalStudents: studentIds.length,
          passedStudents: passedCount,
          passRate: Math.round(passRate * 100) / 100,
          averageScore: Math.round(avgScore * 100) / 100
        }
      })
    )

    // Get semester info
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } })

    // Calculate overall statistics
    const totalStudents = classStats.reduce((sum, c) => sum + c.totalStudents, 0)
    const totalPassed = classStats.reduce((sum, c) => sum + c.passedStudents, 0)
    const overallPassRate = totalStudents > 0 ? (totalPassed / totalStudents) * 100 : 0
    const overallAverage = classStats.filter(c => c.totalStudents > 0).length > 0
      ? classStats.filter(c => c.totalStudents > 0).reduce((sum, c) => sum + c.averageScore, 0) / classStats.filter(c => c.totalStudents > 0).length
      : 0

    res.json({
      data: {
        semester,
        passScore: settings.passScore,
        classes: classStats,
        summary: {
          totalStudents,
          totalPassed,
          passRate: Math.round(overallPassRate * 100) / 100,
          averageScore: Math.round(overallAverage * 100) / 100
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// Dashboard statistics
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: req.tenantId }
    })

    const [
      totalStudents,
      totalClasses,
      totalSubjects,
      activeSemester,
      recentStudents,
      classDistribution
    ] = await Promise.all([
      prisma.student.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.class.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.subject.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.semester.findFirst({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.student.findMany({
        where: { tenantId: req.tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: true }
      }),
      prisma.grade.findMany({
        where: { tenantId: req.tenantId },
        include: {
          classes: {
            where: { isActive: true },
            include: {
              _count: { select: { students: true } }
            }
          }
        },
        orderBy: { level: 'asc' }
      })
    ])

    // Calculate grade distribution
    const gradeStats = classDistribution.map(grade => ({
      grade: grade.name,
      level: grade.level,
      classCount: grade.classes.length,
      studentCount: grade.classes.reduce((sum, c) => sum + c._count.students, 0)
    }))

    res.json({
      data: {
        stats: {
          totalStudents,
          totalClasses,
          totalSubjects,
          maxClassSize: settings.maxClassSize
        },
        activeSemester,
        recentStudents,
        gradeStats
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
