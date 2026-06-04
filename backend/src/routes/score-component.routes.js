const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getComponentSetForSubjectSemester } = require('../utils/academic-scope')

const rejectLegacyWrite = () => {
  throw new AppError('Score components must be managed through subject+semester component sets', 410, 'USE_SCORE_COMPONENT_SETS')
}

// GET /score-components
router.get('/', authenticate, authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
  try {
    const { subjectId, semesterId } = req.query

    if (subjectId && semesterId) {
      const context = await getComponentSetForSubjectSemester(prisma, req.tenantId, { subjectId, semesterId })
      return res.json({
        data: context.components,
        componentSet: context.componentSet,
        warning: context.warning
      })
    }

    const where = {
      tenantId: req.tenantId,
      ...(subjectId && { subjectId }),
      scoreComponentSetId: null
    }

    const components = await prisma.scoreComponent.findMany({
      where,
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: [{ subjectId: 'asc' }, { weight: 'desc' }]
    })

    res.json({ data: components })
  } catch (error) {
    next(error)
  }
})

// POST /score-components — DEPRECATED: use PUT /score-component-sets
router.post('/', authenticate, authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    rejectLegacyWrite()
  } catch (error) {
    next(error)
  }
})

// PUT /score-components/:id — DEPRECATED: use PUT /score-component-sets
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    rejectLegacyWrite()
  } catch (error) {
    next(error)
  }
})

// DELETE /score-components/:id — DEPRECATED: use PUT /score-component-sets
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('subjects'), async (req, res, next) => {
  try {
    rejectLegacyWrite()
  } catch (error) {
    next(error)
  }
})

module.exports = router
