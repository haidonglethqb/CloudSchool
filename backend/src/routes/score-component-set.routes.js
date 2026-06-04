const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getComponentSetForSubjectSemester } = require('../utils/academic-scope')

router.use(authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'))

const normalizeComponents = (components = []) => components
  .filter((component) => component && component.name && Number(component.weight) > 0)
  .map((component, index) => ({
    id: component.id || null,
    name: String(component.name).trim(),
    weight: Number(component.weight),
    displayOrder: index + 1,
    isActive: component.isActive !== false
  }))

const assertComponentPayload = (components) => {
  if (!Array.isArray(components) || components.length === 0) {
    throw new AppError('Vui lòng cấu hình ít nhất một thành phần điểm', 400, 'EMPTY_COMPONENT_SET')
  }
  const invalid = components.find((component) => component.weight < 1 || component.weight > 100)
  if (invalid) throw new AppError('Trọng số mỗi thành phần phải từ 1 đến 100', 400, 'INVALID_WEIGHT')
  const names = components.map((component) => component.name.toLowerCase())
  if (new Set(names).size !== names.length) {
    throw new AppError('Tên thành phần điểm không được trùng trong cùng học kỳ', 400, 'DUPLICATE_COMPONENT_NAME')
  }

  const activeTotal = components
    .filter((component) => component.isActive)
    .reduce((sum, component) => sum + component.weight, 0)
  if (activeTotal > 100) {
    throw new AppError(`Tổng trọng số là ${activeTotal}%, không được vượt quá 100%.`, 400, 'WEIGHT_EXCEEDED')
  }
  return activeTotal
}

// GET /score-component-sets?subjectId=&semesterId=
router.get('/', async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query
    if (!subjectId || !semesterId) throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')

    const context = await getComponentSetForSubjectSemester(prisma, req.tenantId, { subjectId, semesterId })
    res.json({
      data: context.componentSet
        ? { ...context.componentSet, components: context.components }
        : null,
      warning: context.warning
    })
  } catch (error) {
    next(error)
  }
})

// PUT /score-component-sets
router.put('/', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.body
    const components = normalizeComponents(req.body.components)
    if (!subjectId || !semesterId) throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')

    const activeTotal = assertComponentPayload(components)

    const [subject, semester] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
    ])
    if (!subject) throw new AppError('Subject not found', 404, 'SUBJECT_NOT_FOUND')
    if (!semester) throw new AppError('Semester not found', 404, 'SEMESTER_NOT_FOUND')

    const result = await prisma.$transaction(async (tx) => {
      const set = await tx.scoreComponentSet.upsert({
        where: {
          tenantId_subjectId_semesterId: {
            tenantId: req.tenantId,
            subjectId,
            semesterId
          }
        },
        create: { tenantId: req.tenantId, subjectId, semesterId },
        update: { isActive: true }
      })

      const existing = await tx.scoreComponent.findMany({
        where: { tenantId: req.tenantId, scoreComponentSetId: set.id },
        include: { _count: { select: { scores: true } } }
      })
      const incomingIds = new Set(components.map((component) => component.id).filter(Boolean))
      let removedWithScoresCount = 0

      for (const row of existing) {
        if (!incomingIds.has(row.id)) {
          if (row._count.scores > 0) {
            removedWithScoresCount += 1
            await tx.scoreComponent.update({
              where: { id: row.id },
              data: {
                isActive: false,
                displayOrder: -(existing.length + components.length + removedWithScoresCount)
              }
            })
          } else {
            await tx.scoreComponent.delete({ where: { id: row.id } })
          }
        }
      }

      const existingUpdates = components.filter((component) => component.id)
      for (const component of existingUpdates) {
        if (!existing.some((row) => row.id === component.id)) {
          throw new AppError('Score component not found in this set', 404, 'COMPONENT_NOT_FOUND')
        }
      }
      for (let index = 0; index < existingUpdates.length; index += 1) {
        await tx.scoreComponent.update({
          where: { id: existingUpdates[index].id },
          data: { displayOrder: -(index + 1) }
        })
      }

      for (const component of components) {
        if (component.id) {
          const current = existing.find((row) => row.id === component.id)
          await tx.scoreComponent.update({
            where: { id: component.id },
            data: {
              name: component.name,
              weight: component.weight,
              displayOrder: component.displayOrder,
              isActive: component.isActive,
              subjectId
            }
          })
        } else {
          await tx.scoreComponent.create({
            data: {
              tenantId: req.tenantId,
              subjectId,
              scoreComponentSetId: set.id,
              name: component.name,
              weight: component.weight,
              displayOrder: component.displayOrder,
              isActive: component.isActive
            }
          })
        }
      }

      return tx.scoreComponentSet.findUnique({
        where: { id: set.id },
        include: { components: { orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] } }
      })
    })

    const response = { data: result }
    if (activeTotal !== 100) response.warning = `Tổng trọng số hiện là ${activeTotal}%, chưa đủ 100%.`
    res.json(response)
  } catch (error) {
    next(error)
  }
})

// POST /score-component-sets/clone
router.post('/clone', authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    const { subjectId, sourceSemesterId, targetSemesterId, overwrite = false } = req.body
    if (!subjectId || !sourceSemesterId || !targetSemesterId) {
      throw new AppError('subjectId, sourceSemesterId and targetSemesterId are required', 400, 'MISSING_PARAMS')
    }

    const source = await prisma.scoreComponentSet.findFirst({
      where: { tenantId: req.tenantId, subjectId, semesterId: sourceSemesterId, isActive: true },
      include: { components: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } }
    })
    if (!source) throw new AppError('Không tìm thấy bộ điểm nguồn', 404, 'SOURCE_NOT_FOUND')

    const target = await prisma.scoreComponentSet.findFirst({
      where: { tenantId: req.tenantId, subjectId, semesterId: targetSemesterId },
      include: { components: { include: { _count: { select: { scores: true } } } } }
    })
    if (target?.components?.length && !overwrite) {
      throw new AppError('Học kỳ đích đã có thành phần điểm', 409, 'TARGET_ALREADY_EXISTS')
    }
    if (target?.components?.some((component) => component._count.scores > 0)) {
      throw new AppError('Không thể ghi đè bộ điểm đã có điểm', 400, 'TARGET_HAS_SCORES')
    }

    const cloned = await prisma.$transaction(async (tx) => {
      const set = await tx.scoreComponentSet.upsert({
        where: {
          tenantId_subjectId_semesterId: {
            tenantId: req.tenantId,
            subjectId,
            semesterId: targetSemesterId
          }
        },
        create: { tenantId: req.tenantId, subjectId, semesterId: targetSemesterId },
        update: { isActive: true }
      })
      await tx.scoreComponent.deleteMany({ where: { tenantId: req.tenantId, scoreComponentSetId: set.id } })
      await tx.scoreComponent.createMany({
        data: source.components.map((component) => ({
          tenantId: req.tenantId,
          subjectId,
          scoreComponentSetId: set.id,
          name: component.name,
          weight: component.weight,
          displayOrder: component.displayOrder,
          isActive: true
        }))
      })
      return tx.scoreComponentSet.findUnique({
        where: { id: set.id },
        include: { components: { orderBy: { displayOrder: 'asc' } } }
      })
    })

    res.status(201).json({ data: cloned })
  } catch (error) {
    next(error)
  }
})

module.exports = router
