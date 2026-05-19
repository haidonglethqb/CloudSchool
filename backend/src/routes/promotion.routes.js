const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')

const getAcademicYearWithSemesters = async (tenantId, academicYearId) => {
  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, tenantId },
    include: { semesters: { orderBy: { semesterNum: 'asc' } } }
  })
  if (!academicYear) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
  return academicYear
}

const ensureYearEndReady = (academicYear) => {
  const now = new Date()
  const semesters = academicYear.semesters.filter((sem) => sem.startDate && sem.endDate)
  if (semesters.length < 2) {
    throw new AppError('Năm học cần ít nhất 2 học kỳ để xét lên lớp', 400, 'NOT_ENOUGH_SEMESTERS')
  }
  const firstTwo = semesters.slice(0, 2)
  const notEnded = firstTwo.find((sem) => sem.endDate >= now)
  if (notEnded) {
    throw new AppError('Chỉ xét lên lớp khi cả 2 học kỳ đã kết thúc', 400, 'SEMESTER_NOT_FINISHED')
  }
}

const buildPromotionEvaluation = async (tenantId, academicYear, classId = null) => {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } })
  if (!settings) throw new AppError('Tenant settings not configured', 400, 'SETTINGS_NOT_FOUND')

  const semesterIds = academicYear.semesters.map((sem) => sem.id)
  const finalSemester = academicYear.semesters[academicYear.semesters.length - 1]
  if (!finalSemester) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')

  const yearLabel = `${academicYear.startYear}-${academicYear.endYear}`
  const students = await prisma.student.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(classId && { classId }),
      class: {
        isActive: true,
        OR: [
          { academicYearId: academicYear.id },
          { academicYear: yearLabel }
        ]
      }
    },
    include: {
      class: { include: { grade: true } },
      scores: {
        where: { semesterId: { in: semesterIds } },
        include: {
          scoreComponent: true,
          subject: true,
          semester: true
        }
      }
    },
    orderBy: [{ class: { name: 'asc' } }, { fullName: 'asc' }]
  })

  const subjects = await prisma.subject.findMany({
    where: { tenantId, isActive: true },
    include: { scoreComponents: { where: { isActive: true } } }
  })

  const missingScores = []
  const evaluations = []

  for (const student of students) {
    const subjectYearlyAverages = []
    let studentHasMissing = false

    for (const subject of subjects) {
      const semesterAverages = []
      for (const semester of academicYear.semesters) {
        const semesterScores = student.scores.filter((score) => score.subjectId === subject.id && score.semesterId === semester.id)
        const componentMap = new Map(semesterScores.map((score) => [score.scoreComponentId, score]))
        const missingComponents = subject.scoreComponents
          .filter((component) => !componentMap.has(component.id))
          .map((component) => component.name)

        if (missingComponents.length > 0) {
          studentHasMissing = true
          missingScores.push({
            studentId: student.id,
            studentCode: student.studentCode,
            studentName: student.fullName,
            classId: student.classId,
            className: student.class?.name || '',
            subjectName: subject.name,
            semesterName: semester.name,
            missingComponents
          })
          continue
        }

        let weightedSum = 0
        let totalWeight = 0
        for (const score of semesterScores) {
          weightedSum += score.value * score.scoreComponent.weight
          totalWeight += score.scoreComponent.weight
        }
        if (totalWeight > 0) semesterAverages.push(weightedSum / totalWeight)
      }

      if (!studentHasMissing && semesterAverages.length === academicYear.semesters.length) {
        const subjectYearlyAverage = semesterAverages.reduce((sum, value) => sum + value, 0) / semesterAverages.length
        subjectYearlyAverages.push(subjectYearlyAverage)
      }
    }

    if (studentHasMissing || subjectYearlyAverages.length === 0) continue

    const overallAverage = Math.round((subjectYearlyAverages.reduce((sum, value) => sum + value, 0) / subjectYearlyAverages.length) * 100) / 100
    const failedSubject = subjectYearlyAverages.some((avg) => avg < settings.passScore)

    evaluations.push({
      tenantId,
      studentId: student.id,
      classId: student.classId,
      semesterId: finalSemester.id,
      average: overallAverage,
      result: overallAverage >= settings.passScore && !failedSubject ? 'PASS' : 'FAIL',
      note: `Xét năm học ${yearLabel}`
    })
  }

  return { missingScores, evaluations, finalSemester }
}

router.use(authenticate, requireFeature('reports'), authorize('SUPER_ADMIN'))

// POST /promotion/year-end/evaluate
router.post('/year-end/evaluate', async (req, res, next) => {
  try {
    const { academicYearId, classId } = req.body
    if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')

    const academicYear = await getAcademicYearWithSemesters(req.tenantId, academicYearId)
    ensureYearEndReady(academicYear)

    const { missingScores, evaluations, finalSemester } = await buildPromotionEvaluation(req.tenantId, academicYear, classId || null)

    if (missingScores.length > 0) {
      throw new AppError(
        `Chưa đủ dữ liệu điểm để xét lên lớp (${missingScores.length} bản ghi thiếu)`,
        400,
        'MISSING_SCORES',
        missingScores.slice(0, 200)
      )
    }

    const promotions = await prisma.$transaction(
      evaluations.map((evaluation) => prisma.promotion.upsert({
        where: {
          studentId_classId_semesterId: {
            studentId: evaluation.studentId,
            classId: evaluation.classId,
            semesterId: evaluation.semesterId
          }
        },
        create: evaluation,
        update: { average: evaluation.average, result: evaluation.result, note: evaluation.note }
      }))
    )

    res.json({
      data: {
        semesterId: finalSemester.id,
        total: promotions.length,
        passCount: promotions.filter((item) => item.result === 'PASS').length,
        failCount: promotions.filter((item) => item.result === 'FAIL').length,
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /promotion/year-end/results?academicYearId=...&classId=...
router.get('/year-end/results', async (req, res, next) => {
  try {
    const { academicYearId, classId } = req.query
    if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')

    const academicYear = await getAcademicYearWithSemesters(req.tenantId, academicYearId)
    const finalSemester = academicYear.semesters[academicYear.semesters.length - 1]
    if (!finalSemester) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')

    const promotions = await prisma.promotion.findMany({
      where: {
        tenantId: req.tenantId,
        semesterId: finalSemester.id,
        ...(classId && { classId })
      },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true, classId: true } },
        class: { select: { id: true, name: true, grade: true } }
      },
      orderBy: [{ result: 'asc' }, { student: { fullName: 'asc' } }]
    })

    res.json({
      data: {
        semesterId: finalSemester.id,
        passStudents: promotions.filter((item) => item.result === 'PASS'),
        failStudents: promotions.filter((item) => item.result === 'FAIL')
      }
    })
  } catch (error) {
    next(error)
  }
})

// POST /promotion/year-end/execute
router.post('/year-end/execute', async (req, res, next) => {
  try {
    const { academicYearId, passAssignments = [], failAssignments = [] } = req.body
    if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')

    const academicYear = await getAcademicYearWithSemesters(req.tenantId, academicYearId)
    ensureYearEndReady(academicYear)

    const finalSemester = academicYear.semesters[academicYear.semesters.length - 1]
    if (!finalSemester) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')

    const promotions = await prisma.promotion.findMany({
      where: { tenantId: req.tenantId, semesterId: finalSemester.id },
      include: {
        student: true,
        class: { include: { grade: true } }
      }
    })
    if (promotions.length === 0) {
      throw new AppError('Chưa có dữ liệu xét lên lớp. Hãy chạy xét trước.', 400, 'PROMOTION_NOT_EVALUATED')
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const maxGrade = settings?.maxGradeLevel ?? 12

    const passMap = new Map(passAssignments.map((item) => [item.studentId, item.toClassId]))
    const failMap = new Map(failAssignments.map((item) => [item.studentId, item.toClassId]))

    const allTargetClassIds = [...new Set([...passMap.values(), ...failMap.values()].filter(Boolean))]
    const classes = await prisma.class.findMany({
      where: { tenantId: req.tenantId, id: { in: allTargetClassIds } },
      include: { _count: { select: { students: true } } }
    })
    const classCapacityMap = new Map(classes.map((item) => [item.id, { capacity: item.capacity, current: item._count.students }]))

    const promoted = []
    const archived = []
    const failedAssigned = []
    const unresolved = []

    await prisma.$transaction(async (tx) => {
      for (const promotion of promotions) {
        const sourceClassId = promotion.classId
        const gradeLevel = promotion.class?.grade?.level || 0
        const isGraduating = gradeLevel >= maxGrade && promotion.result === 'PASS'

        if (isGraduating) {
          await tx.student.update({
            where: { id: promotion.studentId },
            data: { classId: null, isActive: false }
          })

          await tx.graduationArchive.upsert({
            where: {
              tenantId_studentId_academicYearId: {
                tenantId: req.tenantId,
                studentId: promotion.studentId,
                academicYearId
              }
            },
            create: {
              tenantId: req.tenantId,
              studentId: promotion.studentId,
              sourceClassId,
              academicYearId,
              note: 'Tốt nghiệp lớp cuối cấp',
              createdBy: req.user.id
            },
            update: {
              sourceClassId,
              note: 'Tốt nghiệp lớp cuối cấp',
              createdBy: req.user.id
            }
          })

          archived.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, className: promotion.class.name })
          continue
        }

        const targetClassId = promotion.result === 'PASS' ? passMap.get(promotion.studentId) : failMap.get(promotion.studentId)
        if (!targetClassId) {
          unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result })
          continue
        }

        const capacityState = classCapacityMap.get(targetClassId)
        if (!capacityState) {
          unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Lớp đích không tồn tại' })
          continue
        }
        if (capacityState.current >= capacityState.capacity) {
          unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Lớp đích đã đủ sĩ số' })
          continue
        }

        capacityState.current += 1

        await tx.student.update({
          where: { id: promotion.studentId },
          data: { classId: targetClassId, isActive: true }
        })

        await tx.transferHistory.create({
          data: {
            tenantId: req.tenantId,
            studentId: promotion.studentId,
            fromClassId: sourceClassId,
            toClassId: targetClassId,
            semesterId: finalSemester.id,
            reason: promotion.result === 'PASS' ? 'Lên lớp - xét cuối năm' : 'Sắp lớp lại sau xét cuối năm',
            transferredBy: req.user.id
          }
        })

        if (promotion.result === 'PASS') {
          promoted.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, fromClassId: sourceClassId, toClassId: targetClassId })
        } else {
          failedAssigned.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, fromClassId: sourceClassId, toClassId: targetClassId })
        }
      }
    })

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'YEAR_END_PROMOTION_SYNC',
        entity: 'Promotion',
        details: JSON.stringify({
          academicYearId,
          semesterId: finalSemester.id,
          promoted: promoted.length,
          archived: archived.length,
          failedAssigned: failedAssigned.length,
          unresolved: unresolved.length
        })
      }
    })

    res.json({
      data: {
        promoted,
        archived,
        failedAssigned,
        unresolved,
        summary: {
          promoted: promoted.length,
          archived: archived.length,
          failedAssigned: failedAssigned.length,
          unresolved: unresolved.length
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
