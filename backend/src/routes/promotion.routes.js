const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getClassCountForAcademicYear, getTenantPlanLimits } = require('../utils/subscription-limits')
const { getEffectiveSubjectsForClass, getComponentSetForSubjectSemester } = require('../utils/academic-scope')

const formatDateVi = (dateValue) => {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN', { timeZone: 'UTC' })
}

const createActorSnapshot = (user) => ({
  actorId: user?.id || null,
  actorName: user?.fullName || user?.email || 'Unknown',
  actorRole: String(user?.role || 'UNKNOWN'),
})

const createPlacementHistoryPayload = ({
  tenantId,
  promotionId = null,
  studentId,
  academicYearId,
  action,
  fromClassId = null,
  toClassId = null,
  reason = null,
  actor,
  metadata = null,
}) => ({
  tenantId,
  promotionId,
  studentId,
  academicYearId,
  action,
  fromClassId,
  toClassId,
  reason,
  actorId: actor.actorId,
  actorName: actor.actorName,
  actorRole: actor.actorRole,
  metadata,
})

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
  if (academicYear.semesters.length < 2) {
    throw new AppError('Năm học cần ít nhất 2 học kỳ để xét lên lớp', 400, 'NOT_ENOUGH_SEMESTERS')
  }
  const missingSchedule = academicYear.semesters.find((sem) => !sem.startDate || !sem.endDate)
  if (missingSchedule) {
    throw new AppError(`Học kỳ ${missingSchedule.name} chưa cấu hình đủ ngày bắt đầu/kết thúc`, 400, 'SEMESTER_SCHEDULE_MISSING')
  }
  const semesters = academicYear.semesters
  const notEnded = semesters.find((sem) => sem.endDate >= now)
  if (notEnded) {
    const semesterLabel = `${notEnded.name} (${notEnded.year})`
    const endDateLabel = formatDateVi(notEnded.endDate)
    const reason = `Học kỳ ${semesterLabel} chưa kết thúc${endDateLabel ? ` (kết thúc: ${endDateLabel})` : ''}`
    throw new AppError(
      reason,
      400,
      'SEMESTER_NOT_FINISHED',
      [{
        academicYearId: academicYear.id,
        academicYear: `${academicYear.startYear}-${academicYear.endYear}`,
        semesterId: notEnded.id,
        semesterName: notEnded.name,
        semesterYear: notEnded.year,
        endDate: notEnded.endDate,
        reason
      }]
    )
  }
}

const toAcademicYearLabel = (year) => `${year.startYear}-${year.endYear}`

const getActiveStudentCountsByClass = async (client, tenantId, classIds, semesterId = null) => {
  const ids = [...new Set((classIds || []).filter(Boolean))]
  if (ids.length === 0) return new Map()
  if (semesterId) {
    const counts = await client.classEnrollment.groupBy({
      by: ['classId'],
      where: { tenantId, semesterId, classId: { in: ids }, student: { isActive: true } },
      _count: { _all: true }
    })
    return new Map(counts.map((item) => [item.classId, item._count._all]))
  }
  const counts = await client.student.groupBy({
    by: ['classId'],
    where: { tenantId, isActive: true, classId: { in: ids } },
    _count: { _all: true }
  })
  return new Map(counts.map((item) => [item.classId, item._count._all]))
}

const parseClassSuffix = (className = '') => {
  const trimmed = String(className).trim()
  const match = trimmed.match(/^(\d+)([A-Za-z].*)$/)
  if (!match) return null
  return match[2].toUpperCase()
}

const findNextAcademicYear = async (tenantId, academicYear) => {
  const next = await prisma.academicYear.findFirst({
    where: {
      tenantId,
      startYear: academicYear.startYear + 1,
      endYear: academicYear.endYear + 1
    }
  })
  return next || null
}

const getPlacementStatus = (promotion, latestHistory) => {
  if (promotion.result === 'PASS') {
    if (promotion.class?.grade?.level && promotion.isGraduating) return 'GRADUATED'
    return latestHistory?.action === 'ASSIGNED' ? 'ASSIGNED' : 'PENDING'
  }
  if (!latestHistory) return 'PENDING'
  if (latestHistory.action === 'INACTIVE') return 'INACTIVE'
  if (latestHistory.action === 'ASSIGNED') return 'ASSIGNED'
  if (latestHistory.action === 'DRAFT_TARGET') return 'DRAFTED'
  return 'PENDING'
}

const buildHistoryMaps = async (tenantId, promotionIds) => {
  if (promotionIds.length === 0) return { byPromotionId: new Map(), latestByPromotionId: new Map() }
  const histories = await prisma.promotionPlacementHistory.findMany({
    where: { tenantId, promotionId: { in: promotionIds } },
    include: {
      fromClass: { select: { id: true, name: true } },
      toClass: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  const byPromotionId = new Map()
  const latestByPromotionId = new Map()
  for (const history of histories) {
    if (!byPromotionId.has(history.promotionId)) byPromotionId.set(history.promotionId, [])
    byPromotionId.get(history.promotionId).push(history)
    if (!latestByPromotionId.has(history.promotionId)) latestByPromotionId.set(history.promotionId, history)
  }
  return { byPromotionId, latestByPromotionId }
}

const buildPromotionEvaluation = async (tenantId, academicYear) => {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } })
  if (!settings) throw new AppError('Tenant settings not configured', 400, 'SETTINGS_NOT_FOUND')

  const semesterIds = academicYear.semesters.map((sem) => sem.id)
  const finalSemester = academicYear.semesters[academicYear.semesters.length - 1]
  if (!finalSemester) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')

  const yearLabel = `${academicYear.startYear}-${academicYear.endYear}`
  let enrollments = await prisma.classEnrollment.findMany({
    where: {
      tenantId,
      academicYearId: academicYear.id,
      semesterId: finalSemester.id,
      student: { isActive: true },
      class: { isActive: true }
    },
    include: {
      student: true,
      class: { include: { grade: true } }
    },
    orderBy: [{ class: { name: 'asc' } }, { student: { fullName: 'asc' } }]
  })

  if (enrollments.length === 0) {
    const fallbackEnrollments = await prisma.classEnrollment.findMany({
      where: { tenantId, academicYearId: academicYear.id, student: { isActive: true }, class: { isActive: true } },
      include: { student: true, class: { include: { grade: true } } },
      orderBy: [{ semester: { semesterNum: 'desc' } }, { class: { name: 'asc' } }]
    })
    const byStudent = new Map()
    for (const enrollment of fallbackEnrollments) {
      if (!byStudent.has(enrollment.studentId)) byStudent.set(enrollment.studentId, enrollment)
    }
    enrollments = [...byStudent.values()]
  }

  const allScores = await prisma.score.findMany({
    where: {
      tenantId,
      studentId: { in: enrollments.map((item) => item.studentId) },
      semesterId: { in: semesterIds }
    },
    include: { scoreComponent: true, subject: true, semester: true }
  })
  const scoresByStudent = new Map()
  for (const score of allScores) {
    if (!scoresByStudent.has(score.studentId)) scoresByStudent.set(score.studentId, [])
    scoresByStudent.get(score.studentId).push(score)
  }

  const subjectCache = new Map()
  const componentCache = new Map()
  const missingScores = []
  const evaluations = []

  for (const enrollment of enrollments) {
    const student = enrollment.student
    const classInfo = enrollment.class
    const subjectYearlyAverages = []
    let studentHasMissing = false

    if (!subjectCache.has(classInfo.id)) {
      subjectCache.set(classInfo.id, await getEffectiveSubjectsForClass(prisma, tenantId, {
        classId: classInfo.id,
        academicYearId: academicYear.id
      }))
    }
    const subjects = subjectCache.get(classInfo.id)

    for (const subject of subjects) {
      const semesterAverages = []  // must be inside subject loop to reset per-subject
      for (const semester of academicYear.semesters) {
        const componentKey = `${subject.id}::${semester.id}`
        if (!componentCache.has(componentKey)) {
          componentCache.set(componentKey, await getComponentSetForSubjectSemester(prisma, tenantId, { subjectId: subject.id, semesterId: semester.id }))
        }
        const componentContext = componentCache.get(componentKey)
        const requiredComponents = componentContext.components || []
        if (requiredComponents.length === 0) {
          studentHasMissing = true
          missingScores.push({
            studentId: student.id,
            studentCode: student.studentCode,
            studentName: student.fullName,
            classId: classInfo.id,
            className: classInfo.name,
            subjectName: subject.name,
            semesterName: semester.name,
            missingComponents: ['Chưa cấu hình thành phần điểm']
          })
          continue
        }

        const semesterScores = (scoresByStudent.get(student.id) || []).filter((score) => score.subjectId === subject.id && score.semesterId === semester.id)
        const componentMap = new Map(semesterScores.map((score) => [score.scoreComponentId, score]))
        const missingComponents = requiredComponents
          .filter((component) => !componentMap.has(component.id))
          .map((component) => component.name)

        if (missingComponents.length > 0) {
          studentHasMissing = true
          missingScores.push({
            studentId: student.id,
            studentCode: student.studentCode,
            studentName: student.fullName,
            classId: classInfo.id,
            className: classInfo.name || '',
            subjectName: subject.name,
            semesterName: semester.name,
            missingComponents
          })
          continue
        }

        let weightedSum = 0
        let totalWeight = 0
        for (const component of requiredComponents) {
          const score = componentMap.get(component.id)
          if (!score) continue
          weightedSum += score.value * component.weight
          totalWeight += component.weight
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
      classId: classInfo.id,
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
    if (classId) throw new AppError('Xét lên lớp chỉ hỗ trợ toàn bộ năm học, không lọc theo lớp', 400, 'PROMOTION_ALL_ONLY')

    const academicYear = await getAcademicYearWithSemesters(req.tenantId, academicYearId)
    ensureYearEndReady(academicYear)

    const { missingScores, evaluations, finalSemester } = await buildPromotionEvaluation(req.tenantId, academicYear)

    if (missingScores.length > 0) {
      throw new AppError(
        `Chưa đủ dữ liệu điểm để xét lên lớp (${missingScores.length} bản ghi thiếu)`,
        400,
        'MISSING_SCORES',
        missingScores.slice(0, 200)
      )
    }

    const actor = createActorSnapshot(req.user)
    const promotions = await prisma.$transaction(async (tx) => {
      const rows = []
      for (const evaluation of evaluations) {
        const promotion = await tx.promotion.upsert({
          where: {
            studentId_classId_semesterId: {
              studentId: evaluation.studentId,
              classId: evaluation.classId,
              semesterId: evaluation.semesterId
            }
          },
          create: evaluation,
          update: { average: evaluation.average, result: evaluation.result, note: evaluation.note }
        })
        rows.push(promotion)
      }
      if (rows.length > 0) {
        await tx.promotionPlacementHistory.createMany({
          data: rows.map((promotion) => createPlacementHistoryPayload({
            tenantId: req.tenantId,
            promotionId: promotion.id,
            studentId: promotion.studentId,
            academicYearId,
            action: 'EVALUATED',
            fromClassId: promotion.classId,
            actor,
            metadata: { result: promotion.result, average: promotion.average }
          }))
        })
      }
      return rows
    })

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

// GET /promotion/year-end/results?academicYearId=...
router.get('/year-end/results', async (req, res, next) => {
  try {
    const { academicYearId, classId } = req.query
    if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')
    if (classId) throw new AppError('Xét lên lớp chỉ hỗ trợ toàn bộ năm học, không lọc theo lớp', 400, 'PROMOTION_ALL_ONLY')

    const academicYear = await getAcademicYearWithSemesters(req.tenantId, academicYearId)
    const finalSemester = academicYear.semesters[academicYear.semesters.length - 1]
    if (!finalSemester) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const maxGrade = settings?.maxGradeLevel ?? 12
    const nextAcademicYear = await findNextAcademicYear(req.tenantId, academicYear)
    const targetClasses = nextAcademicYear
      ? await prisma.class.findMany({
          where: { tenantId: req.tenantId, isActive: true, academicYearId: nextAcademicYear.id },
          include: { grade: true }
        })
      : []

    const promotions = await prisma.promotion.findMany({
      where: {
        tenantId: req.tenantId,
        semesterId: finalSemester.id
      },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true, classId: true, gender: true, dateOfBirth: true, isActive: true, inactiveReason: true } },
        class: { select: { id: true, name: true, grade: true } }
      },
      orderBy: [{ result: 'asc' }, { student: { fullName: 'asc' } }]
    })
    const { byPromotionId, latestByPromotionId } = await buildHistoryMaps(req.tenantId, promotions.map((item) => item.id))

    const passStudents = promotions
      .filter((item) => item.result === 'PASS')
      .map((item) => {
        const sourceGrade = item.class?.grade?.level || 0
        const isGraduating = sourceGrade >= maxGrade
        const suffix = parseClassSuffix(item.class?.name || '')
        const autoTargetClass = suffix
          ? targetClasses.find((cls) => cls.grade?.level === sourceGrade + 1 && parseClassSuffix(cls.name) === suffix)
          : null

        const latestHistory = latestByPromotionId.get(item.id) || null
        return {
          ...item,
          isGraduating,
          autoTargetClassId: isGraduating ? null : (autoTargetClass?.id || null),
          autoTargetClassName: isGraduating ? 'Tốt nghiệp' : (autoTargetClass?.name || null),
          placementStatus: isGraduating ? 'GRADUATED' : getPlacementStatus({ ...item, isGraduating }, latestHistory),
          latestPlacementHistory: latestHistory,
          placementHistory: byPromotionId.get(item.id) || [],
          autoAssignmentReason: isGraduating
            ? 'Học sinh lớp cuối cấp, sẽ được lưu vào danh sách tốt nghiệp'
            : (autoTargetClass
            ? null
            : (!nextAcademicYear
              ? 'Chưa có năm học kế tiếp để tự động lên lớp'
              : `Không tìm thấy lớp đích cho quy tắc ${item.class?.name || ''} -> ${sourceGrade + 1}${suffix || ''}`))
        }
      })

    res.json({
      data: {
        semesterId: finalSemester.id,
        nextAcademicYear: nextAcademicYear
          ? { id: nextAcademicYear.id, startYear: nextAcademicYear.startYear, endYear: nextAcademicYear.endYear }
          : null,
        passStudents,
        failStudents: promotions
          .filter((item) => item.result === 'FAIL')
          .map((item) => {
            const latestHistory = latestByPromotionId.get(item.id) || null
            return {
              ...item,
              placementStatus: getPlacementStatus(item, latestHistory),
              latestPlacementHistory: latestHistory,
              placementHistory: byPromotionId.get(item.id) || []
            }
          })
      }
    })
  } catch (error) {
    next(error)
  }
})

// POST /promotion/year-end/execute
router.post('/year-end/execute', async (req, res, next) => {
  try {
    const { academicYearId, failAssignments = [], confirmCreateMissingClasses = false } = req.body
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

    const nextAcademicYear = await findNextAcademicYear(req.tenantId, academicYear)
    if (!nextAcademicYear) {
      throw new AppError('Chưa có năm học kế tiếp để thực thi xét lên lớp', 400, 'NO_NEXT_ACADEMIC_YEAR')
    }
    const nextYearLabel = nextAcademicYear ? toAcademicYearLabel(nextAcademicYear) : null
    const nextSemester = nextAcademicYear
      ? await prisma.semester.findFirst({
          where: { tenantId: req.tenantId, academicYearId: nextAcademicYear.id },
          orderBy: { semesterNum: 'asc' }
        })
      : null
    if (!nextSemester) {
      throw new AppError('Năm học kế tiếp chưa có học kỳ để ghi nhận phân lớp', 400, 'NO_NEXT_SEMESTER')
    }
    const failMap = new Map(failAssignments.map((item) => [item.studentId, item.toClassId]))

    const passPromotions = promotions.filter((promotion) => promotion.result === 'PASS')
    const autoPassTargetByStudentId = new Map()
    const createdClasses = []
    if (nextAcademicYear) {
      const nextYearClasses = await prisma.class.findMany({
        where: { tenantId: req.tenantId, isActive: true, academicYearId: nextAcademicYear.id },
        include: { grade: true }
      })
      const targetGrades = await prisma.grade.findMany({
        where: { tenantId: req.tenantId },
        select: { id: true, name: true, level: true }
      })
      const missingTargetClasses = []

      for (const promotion of passPromotions) {
        const sourceGrade = promotion.class?.grade?.level || 0
        if (sourceGrade >= maxGrade) continue
        const suffix = parseClassSuffix(promotion.class?.name || '')
        if (!suffix) continue
        const targetClass = nextYearClasses.find((cls) => cls.grade?.level === sourceGrade + 1 && parseClassSuffix(cls.name) === suffix)
        if (targetClass) autoPassTargetByStudentId.set(promotion.studentId, targetClass.id)
        else {
          const targetGrade = targetGrades.find((grade) => grade.level === sourceGrade + 1)
          if (targetGrade) {
            const targetName = `${sourceGrade + 1}${suffix}`
            missingTargetClasses.push({
              sourceClassId: promotion.classId,
              sourceClassName: promotion.class?.name,
              targetClassName: targetName,
              targetGradeId: targetGrade.id,
              targetGradeName: targetGrade.name
            })
          }
        }
      }

      const uniqueMissingTargets = [...new Map(missingTargetClasses.map((item) => [item.targetClassName, item])).values()]
      if (uniqueMissingTargets.length > 0 && !confirmCreateMissingClasses) {
        throw new AppError(
          'Cần xác nhận tạo lớp đích còn thiếu trước khi thực thi xét lên lớp.',
          409,
          'MISSING_TARGET_CLASSES',
          uniqueMissingTargets
        )
      }

      if (uniqueMissingTargets.length > 0) {
        const [classCountForNextYear, limits] = await Promise.all([
          getClassCountForAcademicYear(prisma, req.tenantId, nextAcademicYear),
          getTenantPlanLimits(prisma, req.tenantId)
        ])
        if (limits && classCountForNextYear + uniqueMissingTargets.length > limits.classes) {
          throw new AppError(
            `Cannot exceed subscription class limit (${limits.classes}) for academic year ${nextYearLabel}`,
            400,
            'PLAN_LIMIT_EXCEEDED'
          )
        }

        const actor = createActorSnapshot(req.user)
        const newClasses = await prisma.$transaction(async (tx) => {
          const rows = []
          for (const target of uniqueMissingTargets) {
            const created = await tx.class.create({
              data: {
                tenantId: req.tenantId,
                gradeId: target.targetGradeId,
                name: target.targetClassName,
                academicYearId: nextAcademicYear.id,
                academicYear: nextYearLabel,
                capacity: settings?.maxClassSize || 40
              },
              include: { grade: true }
            })
            await tx.promotionPlacementHistory.create({
              data: createPlacementHistoryPayload({
                tenantId: req.tenantId,
                promotionId: null,
                studentId: passPromotions.find((item) => item.classId === target.sourceClassId)?.studentId || passPromotions[0]?.studentId,
                academicYearId,
                action: 'CREATE_TARGET_CLASS',
                fromClassId: target.sourceClassId,
                toClassId: created.id,
                reason: `Tự tạo lớp ${created.name} vì chưa có lớp đích`,
                actor,
                metadata: target
              })
            })
            rows.push(created)
          }
          return rows
        })
        createdClasses.push(...newClasses)
        nextYearClasses.push(...newClasses)
      }

      for (const promotion of passPromotions) {
        const sourceGrade = promotion.class?.grade?.level || 0
        if (sourceGrade >= maxGrade) continue
        const suffix = parseClassSuffix(promotion.class?.name || '')
        if (!suffix) continue
        const targetClass = nextYearClasses.find((cls) => cls.grade?.level === sourceGrade + 1 && parseClassSuffix(cls.name) === suffix)
        if (targetClass) autoPassTargetByStudentId.set(promotion.studentId, targetClass.id)
      }
    }

    const allTargetClassIds = [...new Set([...autoPassTargetByStudentId.values(), ...failMap.values()].filter(Boolean))]
    const classes = await prisma.class.findMany({
      where: { tenantId: req.tenantId, id: { in: allTargetClassIds } },
      include: { grade: true, _count: { select: { students: true } } }
    })
    const activeCountByClass = await getActiveStudentCountsByClass(prisma, req.tenantId, allTargetClassIds, nextSemester.id)
    const classStateMap = new Map(classes.map((item) => [item.id, { classInfo: item, capacity: item.capacity, current: activeCountByClass.get(item.id) || 0 }]))

    const promoted = []
    const archived = []
    const failedAssigned = []
    const unresolved = []

    const actor = createActorSnapshot(req.user)
    await prisma.$transaction(async (tx) => {
      for (const promotion of promotions) {
        const sourceClassId = promotion.classId
        const gradeLevel = promotion.class?.grade?.level || 0
        const isGraduating = gradeLevel >= maxGrade && promotion.result === 'PASS'

        if (isGraduating) {
          await tx.student.update({
            where: { id: promotion.studentId },
            data: {
              classId: null,
              isActive: false,
              inactiveReason: 'Tốt nghiệp lớp cuối cấp',
              inactiveAt: new Date(),
              inactivatedBy: req.user.id,
              inactivatedByName: actor.actorName
            }
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
          await tx.promotionPlacementHistory.create({
            data: createPlacementHistoryPayload({
              tenantId: req.tenantId,
              promotionId: promotion.id,
              studentId: promotion.studentId,
              academicYearId,
              action: 'GRADUATED',
              fromClassId: sourceClassId,
              reason: 'Tốt nghiệp lớp cuối cấp',
              actor,
              metadata: { className: promotion.class.name }
            })
          })
          continue
        }

        const targetClassId = promotion.result === 'PASS' ? autoPassTargetByStudentId.get(promotion.studentId) : failMap.get(promotion.studentId)
        if (!targetClassId) {
          unresolved.push({
            studentId: promotion.studentId,
            studentName: promotion.student.fullName,
            result: promotion.result,
            reason: promotion.result === 'PASS'
              ? (!nextAcademicYear
                ? 'Chưa có năm học kế tiếp để tự động lên lớp'
                : 'Không tìm thấy lớp đích theo quy tắc tự động')
              : 'Chưa chọn lớp đích cho học sinh chưa đạt'
          })
          continue
        }
        if (!nextSemester) {
          unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Năm học kế tiếp chưa có học kỳ để ghi nhận phân lớp' })
          continue
        }

        const capacityState = classStateMap.get(targetClassId)
        if (!capacityState) {
          unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Lớp đích không tồn tại' })
          continue
        }
        if (promotion.result === 'FAIL') {
          const targetGrade = capacityState.classInfo?.grade?.level || 0
          const sourceGrade = promotion.class?.grade?.level || 0
          const isInNextYear = nextAcademicYear
            && (capacityState.classInfo.academicYearId === nextAcademicYear.id || capacityState.classInfo.academicYear === nextYearLabel)
          if (!isInNextYear) {
            unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Lớp đích phải thuộc năm học kế tiếp' })
            continue
          }
          if (targetGrade !== sourceGrade) {
            unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Học sinh chưa đạt chỉ được phân lại trong cùng khối' })
            continue
          }
        }
        if (capacityState.current >= capacityState.capacity) {
          unresolved.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, result: promotion.result, reason: 'Lớp đích đã đủ sĩ số' })
          continue
        }

        capacityState.current += 1

        await tx.student.update({
          where: { id: promotion.studentId },
          data: {
            classId: targetClassId,
            isActive: true,
            inactiveReason: null,
            inactiveAt: null,
            inactivatedBy: null,
            inactivatedByName: null
          }
        })

        await tx.transferHistory.create({
          data: {
            tenantId: req.tenantId,
            studentId: promotion.studentId,
            fromClassId: sourceClassId,
            toClassId: targetClassId,
            semesterId: nextSemester.id,
            reason: promotion.result === 'PASS' ? 'Lên lớp - xét cuối năm' : 'Sắp lớp lại sau xét cuối năm',
            transferredBy: req.user.id
          }
        })

        await tx.classEnrollment.upsert({
          where: {
            studentId_semesterId: {
              studentId: promotion.studentId,
              semesterId: nextSemester.id
            }
          },
          create: {
            tenantId: req.tenantId,
            studentId: promotion.studentId,
            classId: targetClassId,
            semesterId: nextSemester.id,
            academicYearId: nextAcademicYear.id
          },
          update: {
            classId: targetClassId,
            academicYearId: nextAcademicYear.id
          }
        })

        if (promotion.result === 'PASS') {
          promoted.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, fromClassId: sourceClassId, toClassId: targetClassId })
        } else {
          failedAssigned.push({ studentId: promotion.studentId, studentName: promotion.student.fullName, fromClassId: sourceClassId, toClassId: targetClassId })
        }
        await tx.promotionPlacementHistory.create({
          data: createPlacementHistoryPayload({
            tenantId: req.tenantId,
            promotionId: promotion.id,
            studentId: promotion.studentId,
            academicYearId,
            action: 'ASSIGNED',
            fromClassId: sourceClassId,
            toClassId: targetClassId,
            reason: promotion.result === 'PASS' ? 'Lên lớp - xét cuối năm' : 'Sắp lớp lại sau xét cuối năm',
            actor,
            metadata: { result: promotion.result }
          })
        })
      }

      if (unresolved.length === 0) {
        await tx.academicYear.updateMany({
          where: { tenantId: req.tenantId },
          data: { isActive: false }
        })
        await tx.semester.updateMany({
          where: { tenantId: req.tenantId },
          data: { isActive: false }
        })
        await tx.academicYear.update({
          where: { id: nextAcademicYear.id },
          data: { isActive: true }
        })
        await tx.semester.update({
          where: { id: nextSemester.id },
          data: { isActive: true }
        })
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
          createdClasses: createdClasses.length,
          unresolved: unresolved.length
        })
      }
    })

    res.json({
      data: {
        promoted,
        archived,
        failedAssigned,
        createdClasses,
        unresolved,
        summary: {
          promoted: promoted.length,
          archived: archived.length,
          failedAssigned: failedAssigned.length,
          createdClasses: createdClasses.length,
          unresolved: unresolved.length
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /promotion/year-end/failed/:promotionId
router.patch('/year-end/failed/:promotionId', async (req, res, next) => {
  try {
    const { action, toClassId, reason } = req.body
    if (!['draft', 'assign', 'inactive'].includes(action)) {
      throw new AppError('Invalid action', 400, 'INVALID_ACTION')
    }

    const promotion = await prisma.promotion.findFirst({
      where: { id: req.params.promotionId, tenantId: req.tenantId, result: 'FAIL' },
      include: {
        student: true,
        class: { include: { grade: true } },
        semester: { include: { academicYear: true } }
      }
    })
    if (!promotion) throw new AppError('Promotion fail row not found', 404, 'NOT_FOUND')
    if (!promotion.semester?.academicYear) throw new AppError('Promotion has no academic year context', 400, 'NO_ACADEMIC_YEAR')

    const academicYear = promotion.semester.academicYear
    const nextAcademicYear = await findNextAcademicYear(req.tenantId, academicYear)
    if (!nextAcademicYear && action !== 'inactive') {
      throw new AppError('Chưa có năm học kế tiếp để phân lớp', 400, 'NO_NEXT_ACADEMIC_YEAR')
    }
    const nextSemester = nextAcademicYear
      ? await prisma.semester.findFirst({
          where: { tenantId: req.tenantId, academicYearId: nextAcademicYear.id },
          orderBy: { semesterNum: 'asc' }
        })
      : null

    const actor = createActorSnapshot(req.user)
    const sourceClassId = promotion.classId

    if (action === 'draft') {
      if (!toClassId) throw new AppError('toClassId is required', 400, 'MISSING_PARAMS')
      const targetClass = await prisma.class.findFirst({ where: { id: toClassId, tenantId: req.tenantId }, include: { grade: true } })
      if (!targetClass) throw new AppError('Target class not found', 404, 'NOT_FOUND')
      const isInNextYear = targetClass.academicYearId === nextAcademicYear.id || targetClass.academicYear === toAcademicYearLabel(nextAcademicYear)
      if (!isInNextYear) throw new AppError('Lá»›p Ä‘Ã­ch pháº£i thuá»™c nÄƒm há»c káº¿ tiáº¿p', 400, 'INVALID_TARGET_YEAR')
      if ((targetClass.grade?.level || 0) !== (promotion.class?.grade?.level || 0)) {
        throw new AppError('Học sinh chưa đạt chỉ được phân lại trong cùng khối', 400, 'INVALID_TARGET_GRADE')
      }
      await prisma.promotionPlacementHistory.create({
        data: createPlacementHistoryPayload({
          tenantId: req.tenantId,
          promotionId: promotion.id,
          studentId: promotion.studentId,
          academicYearId: academicYear.id,
          action: 'DRAFT_TARGET',
          fromClassId: sourceClassId,
          toClassId,
          reason: reason || 'Chọn lớp dự kiến cho học sinh chưa đạt',
          actor
        })
      })
      return res.json({ data: { message: 'Draft saved' } })
    }

    if (action === 'inactive') {
      const inactiveReason = String(reason || '').trim()
      if (!inactiveReason) throw new AppError('Inactive reason is required', 400, 'INACTIVE_REASON_REQUIRED')
      const updated = await prisma.$transaction(async (tx) => {
        const student = await tx.student.update({
          where: { id: promotion.studentId },
          data: {
            isActive: false,
            inactiveReason,
            inactiveAt: new Date(),
            inactivatedBy: req.user.id,
            inactivatedByName: actor.actorName
          }
        })
        await tx.promotionPlacementHistory.create({
          data: createPlacementHistoryPayload({
            tenantId: req.tenantId,
            promotionId: promotion.id,
            studentId: promotion.studentId,
            academicYearId: academicYear.id,
            action: 'INACTIVE',
            fromClassId: sourceClassId,
            reason: inactiveReason,
            actor
          })
        })
        return student
      })
      return res.json({ data: updated })
    }

    if (!toClassId) throw new AppError('toClassId is required', 400, 'MISSING_PARAMS')
    if (!nextSemester) throw new AppError('Năm học kế tiếp chưa có học kỳ để ghi nhận phân lớp', 400, 'NO_NEXT_SEMESTER')
    const targetClass = await prisma.class.findFirst({
      where: { id: toClassId, tenantId: req.tenantId },
      include: { grade: true, _count: { select: { students: true } } }
    })
    if (!targetClass) throw new AppError('Target class not found', 404, 'NOT_FOUND')
    const targetActiveCount = (await getActiveStudentCountsByClass(prisma, req.tenantId, [targetClass.id], nextSemester.id)).get(targetClass.id) || 0
    if (targetActiveCount >= targetClass.capacity) throw new AppError('Target class is full', 400, 'CLASS_FULL')
    const isInNextYear = targetClass.academicYearId === nextAcademicYear.id || targetClass.academicYear === toAcademicYearLabel(nextAcademicYear)
    if (!isInNextYear) throw new AppError('Lớp đích phải thuộc năm học kế tiếp', 400, 'INVALID_TARGET_YEAR')
    if ((targetClass.grade?.level || 0) !== (promotion.class?.grade?.level || 0)) {
      throw new AppError('Học sinh chưa đạt chỉ được phân lại trong cùng khối', 400, 'INVALID_TARGET_GRADE')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const student = await tx.student.update({
        where: { id: promotion.studentId },
        data: {
          classId: toClassId,
          isActive: true,
          inactiveReason: null,
          inactiveAt: null,
          inactivatedBy: null,
          inactivatedByName: null
        }
      })
      await tx.transferHistory.create({
        data: {
          tenantId: req.tenantId,
          studentId: promotion.studentId,
          fromClassId: sourceClassId,
          toClassId,
          semesterId: nextSemester.id,
          reason: reason || 'Sắp lớp lại sau xét cuối năm',
          transferredBy: req.user.id
        }
      })
      await tx.classEnrollment.upsert({
        where: {
          studentId_semesterId: {
            studentId: promotion.studentId,
            semesterId: nextSemester.id
          }
        },
        create: {
          tenantId: req.tenantId,
          studentId: promotion.studentId,
          classId: toClassId,
          semesterId: nextSemester.id,
          academicYearId: nextAcademicYear.id
        },
        update: {
          classId: toClassId,
          academicYearId: nextAcademicYear.id
        }
      })
      await tx.promotionPlacementHistory.create({
        data: createPlacementHistoryPayload({
          tenantId: req.tenantId,
          promotionId: promotion.id,
          studentId: promotion.studentId,
          academicYearId: academicYear.id,
          action: 'ASSIGNED',
          fromClassId: sourceClassId,
          toClassId,
          reason: reason || 'Sắp lớp lại sau xét cuối năm',
          actor
        })
      })
      return student
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

module.exports = router
