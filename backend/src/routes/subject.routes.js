const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getUserAssignmentScope } = require('../utils/assignment-scope')
const { getEffectiveSubjectsForClass } = require('../utils/academic-scope')

router.use(authenticate, requireFeature('subjects'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'))

// GET /subjects
router.get('/', async (req, res, next) => {
  try {
    const { includeInactive, academicYearId, classId } = req.query

    if (academicYearId && classId) {
      const effectiveSubjects = await getEffectiveSubjectsForClass(prisma, req.tenantId, { academicYearId, classId })
      const scope = await getUserAssignmentScope(prisma, req)
      const data = scope
        ? effectiveSubjects.filter((subject) => scope.pairSet.has(`${classId}::${subject.id}`))
        : effectiveSubjects
      return res.json({ data })
    }

    const where = { tenantId: req.tenantId }
    if (!includeInactive) where.isActive = true

    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) where.id = { in: scope.subjectIds }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        scoreComponents: {
          where: { scoreComponentSetId: null },
          orderBy: [{ displayOrder: 'asc' }, { weight: 'desc' }]
        },
        subjectVersions: {
          include: {
            academicYear: true,
            gradeScopes: { include: { grade: true } },
            classScopes: { include: { class: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    res.json({ data: subjects })
  } catch (error) {
    next(error)
  }
})

// GET /subjects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const scope = await getUserAssignmentScope(prisma, req)
    if (scope && !scope.subjectIds.includes(req.params.id)) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
    }

    const subject = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        scoreComponents: { where: { scoreComponentSetId: null }, orderBy: { weight: 'desc' } },
        subjectVersions: {
          include: {
            academicYear: true,
            gradeScopes: { include: { grade: true } },
            classScopes: { include: { class: true } }
          }
        }
      }
    })

    if (!subject) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// POST /subjects
router.post('/', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), [
  body('name').notEmpty().withMessage('Subject name is required'),
  body('code').notEmpty().withMessage('Subject code is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { name, code, description } = req.body

    const existing = await prisma.subject.findFirst({
      where: { tenantId: req.tenantId, code: code.toUpperCase() }
    })
    if (existing) throw new AppError('Subject code already exists', 409, 'DUPLICATE')

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const subjectCount = await prisma.subject.count({
      where: { tenantId: req.tenantId, isActive: true }
    })
    if (subjectCount >= settings.maxSubjects) {
      throw new AppError(`Số môn học không được vượt quá ${settings.maxSubjects}`, 400, 'MAX_SUBJECTS_EXCEEDED')
    }

    const subject = await prisma.subject.create({
      data: {
        tenantId: req.tenantId,
        name,
        code: code.toUpperCase(),
        description
      }
    })

    res.status(201).json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// POST /subjects/:subjectId/versions
router.post('/:subjectId/versions', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), [
  body('academicYearId').notEmpty().withMessage('academicYearId is required'),
  body('versionName').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { academicYearId, versionName } = req.body
    const [subject, academicYear] = await Promise.all([
      prisma.subject.findFirst({ where: { id: req.params.subjectId, tenantId: req.tenantId } }),
      prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId: req.tenantId } })
    ])
    if (!subject) throw new AppError('Subject not found', 404, 'SUBJECT_NOT_FOUND')
    if (!academicYear) throw new AppError('Academic year not found', 404, 'ACADEMIC_YEAR_NOT_FOUND')

    const version = await prisma.subjectVersion.upsert({
      where: {
        tenantId_subjectId_academicYearId: {
          tenantId: req.tenantId,
          subjectId: subject.id,
          academicYearId
        }
      },
      update: {
        versionName: versionName?.trim() || `${subject.name} ${academicYear.startYear}-${academicYear.endYear}`,
        isActive: true
      },
      create: {
        tenantId: req.tenantId,
        subjectId: subject.id,
        academicYearId,
        versionName: versionName?.trim() || `${subject.name} ${academicYear.startYear}-${academicYear.endYear}`
      },
      include: {
        subject: true,
        academicYear: true,
        gradeScopes: { include: { grade: true } },
        classScopes: { include: { class: true } }
      }
    })

    res.status(201).json({ data: version })
  } catch (error) {
    next(error)
  }
})

// PUT /subjects/versions/:id/scope
router.put('/versions/:id/scope', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    const gradeIds = Array.isArray(req.body.gradeIds) ? [...new Set(req.body.gradeIds)] : []
    const classIds = Array.isArray(req.body.classIds) ? [...new Set(req.body.classIds)] : []
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true

    if (isActive && gradeIds.length === 0 && classIds.length === 0) {
      throw new AppError('Vui lòng chọn khối hoặc lớp áp dụng', 400, 'EMPTY_SCOPE')
    }

    const version = await prisma.subjectVersion.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { academicYear: true }
    })
    if (!version) throw new AppError('Subject version not found', 404, 'NOT_FOUND')

    const [grades, classes] = await Promise.all([
      gradeIds.length
        ? prisma.grade.findMany({ where: { id: { in: gradeIds }, tenantId: req.tenantId } })
        : Promise.resolve([]),
      classIds.length
        ? prisma.class.findMany({ where: { id: { in: classIds }, tenantId: req.tenantId } })
        : Promise.resolve([])
    ])
    if (grades.length !== gradeIds.length) throw new AppError('Một hoặc nhiều khối không hợp lệ', 400, 'INVALID_GRADES')
    if (classes.length !== classIds.length) throw new AppError('Một hoặc nhiều lớp không hợp lệ', 400, 'INVALID_CLASSES')

    const invalidClass = classes.find((cls) => cls.academicYearId !== version.academicYearId && cls.academicYear !== `${version.academicYear.startYear}-${version.academicYear.endYear}`)
    if (invalidClass) {
      throw new AppError('Lớp áp dụng phải thuộc năm học của version môn', 400, 'CLASS_YEAR_MISMATCH')
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.subjectVersionGrade.deleteMany({ where: { subjectVersionId: version.id } })
      await tx.subjectVersionClass.deleteMany({ where: { subjectVersionId: version.id } })

      if (gradeIds.length > 0) {
        await tx.subjectVersionGrade.createMany({
          data: gradeIds.map((gradeId) => ({ tenantId: req.tenantId, subjectVersionId: version.id, gradeId }))
        })
      }
      if (classIds.length > 0) {
        await tx.subjectVersionClass.createMany({
          data: classIds.map((classId) => ({ tenantId: req.tenantId, subjectVersionId: version.id, classId }))
        })
      }
      return tx.subjectVersion.update({
        where: { id: version.id },
        data: { isActive },
        include: {
          subject: true,
          academicYear: true,
          gradeScopes: { include: { grade: true } },
          classScopes: { include: { class: true } }
        }
      })
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// PUT /subjects/:id
router.put('/:id', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    const { name, code, description, isActive } = req.body

    if (code && code.toUpperCase() !== existing.code.toUpperCase()) {
      const dup = await prisma.subject.findFirst({
        where: { tenantId: req.tenantId, code: code.toUpperCase(), id: { not: req.params.id } }
      })
      if (dup) throw new AppError('Subject code already exists', 409, 'DUPLICATE_CODE')
    }

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: { name, code: code?.toUpperCase(), description, isActive }
    })

    res.json({ data: subject })
  } catch (error) {
    next(error)
  }
})

// DELETE /subjects/:id (soft delete)
router.delete('/:id', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) throw new AppError('Subject not found', 404, 'NOT_FOUND')

    await prisma.subject.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })

    await prisma.scoreComponent.updateMany({
      where: { subjectId: req.params.id },
      data: { isActive: false }
    })
    await prisma.subjectVersion.updateMany({
      where: { subjectId: req.params.id, tenantId: req.tenantId },
      data: { isActive: false }
    })
    await prisma.scoreComponentSet.updateMany({
      where: { subjectId: req.params.id, tenantId: req.tenantId },
      data: { isActive: false }
    })

    res.json({ data: { message: 'Subject deleted' } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
