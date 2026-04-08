const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize, tenantGuard } = require('../middleware/auth')

// GET /tenants/current - Current tenant info
router.get('/current', authenticate, tenantGuard, async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      include: {
        settings: true,
        plan: true,
        _count: { select: { students: true, classes: true, users: true } }
      }
    })

    if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND')
    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// PUT /tenants/current - Update tenant info
router.put('/current', authenticate, tenantGuard, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, address, phone, email } = req.body

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email })
      }
    })

    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// GET /tenants/stats - Dashboard statistics
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [
      totalStudents,
      totalClasses,
      totalTeachers,
      totalSubjects,
      recentStudents,
      activeSemester,
      gradeDistribution
    ] = await Promise.all([
      prisma.student.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.class.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.user.count({ where: { tenantId: req.tenantId, role: 'TEACHER', isActive: true } }),
      prisma.subject.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.student.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: { include: { grade: true } } }
      }),
      prisma.semester.findFirst({ where: { tenantId: req.tenantId, isActive: true } }),
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
      grade: g.name,
      level: g.level,
      classCount: g.classes.length,
      studentCount: g.classes.reduce((sum, c) => sum + c._count.students, 0)
    }))

    res.json({
      data: {
        stats: { totalStudents, totalClasses, totalTeachers, totalSubjects },
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
