const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')

// POST /promotion/promote - Year-end: Move PASS students to next-grade classes
router.post('/promote', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { semesterId, academicYearId, newAcademicYear } = req.body

    if (!semesterId) {
      throw new AppError('semesterId is required', 400, 'MISSING_PARAMS')
    }

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, tenantId: req.tenantId }
    })
    if (!semester) throw new AppError('Semester not found', 404, 'NOT_FOUND')

    // Get or create next academic year
    let nextAcademicYear = null
    if (academicYearId) {
      nextAcademicYear = await prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId: req.tenantId }
      })
      if (!nextAcademicYear) throw new AppError('Academic year not found', 404, 'NOT_FOUND')
    } else if (newAcademicYear) {
      nextAcademicYear = await prisma.academicYear.findFirst({
        where: { tenantId: req.tenantId, startYear: newAcademicYear, endYear: newAcademicYear + 1 }
      })
      if (!nextAcademicYear) {
        nextAcademicYear = await prisma.academicYear.create({
          data: { tenantId: req.tenantId, startYear: newAcademicYear, endYear: newAcademicYear + 1 }
        })
      }
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const maxGradeLevel = settings.maxGradeLevel

    const [allPromotions, grades] = await Promise.all([
      prisma.promotion.findMany({
        where: { tenantId: req.tenantId, semesterId },
        include: { student: { select: { id: true, fullName: true, studentCode: true, classId: true } }, class: { include: { grade: true } } }
      }),
      prisma.grade.findMany({ where: { tenantId: req.tenantId }, orderBy: { level: 'asc' } })
    ])

    const passPromotions = allPromotions.filter(p => p.result === 'PASS')
    const failPromotions = allPromotions.filter(p => p.result === 'FAIL')

    const gradeByLevel = {}
    for (const g of grades) gradeByLevel[g.level] = g

    const yearStr = nextAcademicYear
      ? `${nextAcademicYear.startYear}-${nextAcademicYear.endYear}`
      : `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    const promoted = []
    const graduated = []
    const retained = []
    const skipped = []
    const classCache = new Map()

    await prisma.$transaction(async (tx) => {
      await processPassStudents(tx, passPromotions, { req, maxGradeLevel, gradeByLevel, yearStr, settings, semesterId, promoted, graduated, retained, skipped, classCache })
      await processFailStudents(tx, failPromotions, { req, gradeByLevel, yearStr, settings, semesterId, retained, classCache })
    })

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId, userId: req.user.id, action: 'YEAR_END_PROMOTE', entity: 'Promotion',
        details: JSON.stringify({ semesterId, promoted: promoted.length, graduated: graduated.length, retained: retained.length, skipped: skipped.length })
      }
    })

    res.json({
      data: {
        promoted, graduated, retained, skipped,
        summary: { totalPromoted: promoted.length, totalGraduated: graduated.length, totalRetained: retained.length, totalSkipped: skipped.length }
      }
    })
  } catch (error) { next(error) }
})

async function processPassStudents(tx, passPromotions, ctx) {
  const { req, maxGradeLevel, gradeByLevel, yearStr, settings, semesterId, promoted, graduated, retained, skipped, classCache } = ctx

  for (const p of passPromotions) {
    const currentLevel = p.class.grade.level

    if (currentLevel >= maxGradeLevel) {
      await tx.student.update({ where: { id: p.studentId }, data: { classId: null, isActive: false } })
      graduated.push({
        student: { id: p.student.id, fullName: p.student.fullName, studentCode: p.student.studentCode },
        fromClass: p.class.name, fromGrade: p.class.grade.name
      })
      continue
    }

    const nextGrade = gradeByLevel[currentLevel + 1]
    if (!nextGrade) {
      skipped.push({
        student: { id: p.student.id, fullName: p.student.fullName, studentCode: p.student.studentCode },
        reason: `No grade found for level ${currentLevel + 1}`
      })
      continue
    }

    const baseName = p.class.name.replace(/-LB$/i, '').trim()
    const nextClassName = baseName.replace(/\d+/, String(currentLevel + 1))
    let targetClass = await findOrCreateClassCached(tx, req.tenantId, nextGrade.id, nextClassName, yearStr, settings.maxClassSize, classCache)

    await tx.student.update({ where: { id: p.studentId }, data: { classId: targetClass.id } })

    if (p.classId) {
      await tx.transferHistory.create({
        data: {
          tenantId: req.tenantId, studentId: p.studentId, fromClassId: p.classId,
          toClassId: targetClass.id, semesterId, reason: 'Lên lớp - xét cuối năm', transferredBy: req.user.id
        }
      })
    }

    promoted.push({
      student: { id: p.student.id, fullName: p.student.fullName, studentCode: p.student.studentCode },
      fromClass: p.class.name, toClass: targetClass.name, fromGrade: p.class.grade.name, toGrade: nextGrade.name
    })
  }
}

async function processFailStudents(tx, failPromotions, ctx) {
  const { req, gradeByLevel, yearStr, settings, semesterId, retained, classCache } = ctx

  for (const p of failPromotions) {
    const currentGrade = gradeByLevel[p.class.grade.level]
    if (!currentGrade) continue

    const retainBaseName = p.class.name.replace(/-LB$/i, '').trim()
    let targetClass = await findOrCreateClassCached(tx, req.tenantId, currentGrade.id, `${retainBaseName}-LB`, yearStr, settings.maxClassSize, classCache)

    await tx.student.update({ where: { id: p.studentId }, data: { classId: targetClass.id } })

    if (p.student.classId && p.student.classId !== targetClass.id) {
      await tx.transferHistory.create({
        data: {
          tenantId: req.tenantId, studentId: p.studentId, fromClassId: p.student.classId,
          toClassId: targetClass.id, semesterId, reason: 'Lưu ban - xét cuối năm', transferredBy: req.user.id
        }
      })
    }

    retained.push({
      student: { id: p.student.id, fullName: p.student.fullName, studentCode: p.student.studentCode },
      fromClass: p.class.name, toClass: targetClass.name, grade: p.class.grade.name
    })
  }
}

async function findOrCreateClassCached(tx, tenantId, gradeId, name, academicYear, capacity, cache) {
  const key = `${tenantId}::${gradeId}::${name}::${academicYear}`
  if (cache.has(key)) return cache.get(key)
  const cls = await findOrCreateClass(tx, tenantId, gradeId, name, academicYear, capacity)
  cache.set(key, cls)
  return cls
}

async function findOrCreateClass(tx, tenantId, gradeId, name, academicYear, capacity) {
  let cls = await tx.class.findFirst({
    where: { tenantId, gradeId, name, academicYear, isActive: true },
    include: { _count: { select: { students: true } } }
  })

  if (cls && cls._count.students >= cls.capacity) cls = null

  if (!cls) {
    let className = name
    let attempts = 0
    while (!cls && attempts < 10) {
      try {
        cls = await tx.class.create({
          data: { tenantId, gradeId, name: className, academicYear, capacity }
        })
      } catch (e) {
        if (e.code === 'P2002') {
          attempts++
          className = attempts === 1 ? `${name}-2` : `${name}-${attempts + 1}`
        } else {
          throw e
        }
      }
    }
    if (!cls) throw new AppError('Failed to create class after multiple attempts', 500, 'CLASS_CREATE_FAILED')
  }

  return cls
}

// POST /promotion/archive-classes - Archive old academic year classes
router.post('/archive-classes', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { academicYear } = req.body
    if (!academicYear) throw new AppError('academicYear is required', 400, 'MISSING_PARAMS')

    const result = await prisma.class.updateMany({
      where: { tenantId: req.tenantId, academicYear, isActive: true },
      data: { isActive: false }
    })

    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId, userId: req.user.id, action: 'ARCHIVE_CLASSES', entity: 'Class',
        details: JSON.stringify({ academicYear, archivedCount: result.count })
      }
    })

    res.json({ data: { message: `Đã lưu trữ ${result.count} lớp học năm ${academicYear}`, archivedCount: result.count } })
  } catch (error) { next(error) }
})

module.exports = router
