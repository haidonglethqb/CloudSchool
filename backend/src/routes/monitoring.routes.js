const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')

// All routes require PLATFORM_ADMIN
router.use(authenticate, authorize('PLATFORM_ADMIN'))

// GET /monitoring/system-stats — System-level metrics
router.get('/system-stats', async (req, res, next) => {
  try {
    const [
      totalSchools,
      activeSchools,
      inactiveSchools,
      suspendedSchools,
      totalUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      totalStaff
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'INACTIVE' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { role: { not: 'PLATFORM_ADMIN' } } }),
      prisma.student.count(),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.class.count(),
      prisma.user.count({ where: { role: 'STAFF' } })
    ])

    // School growth over last 12 months
    const now = new Date()
    const schoolGrowth = []
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = await prisma.tenant.count({
        where: { createdAt: { gte: start, lt: end } }
      })
      schoolGrowth.push({
        month: start.toISOString().slice(0, 7),
        label: start.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
        count
      })
    }

    // Student growth over last 12 months
    const studentGrowth = []
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = await prisma.student.count({
        where: { createdAt: { gte: start, lt: end } }
      })
      studentGrowth.push({
        month: start.toISOString().slice(0, 7),
        label: start.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
        count
      })
    }

    // Top schools by student count
    const topSchools = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: { select: { students: true, users: true, classes: true } },
        plan: { select: { name: true } }
      },
      orderBy: { students: { _count: 'desc' } },
      take: 10
    })

    // System health (basic — real monitoring would use Redis/external tools)
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStart

    res.json({
      data: {
        overview: {
          totalSchools,
          activeSchools,
          inactiveSchools,
          suspendedSchools,
          totalUsers,
          totalStudents,
          totalTeachers,
          totalClasses,
          totalStaff
        },
        charts: {
          schoolGrowth,
          studentGrowth
        },
        topSchools: topSchools.map(s => ({
          id: s.id,
          name: s.name,
          code: s.code,
          status: s.status,
          plan: s.plan?.name,
          students: s._count.students,
          users: s._count.users,
          classes: s._count.classes
        })),
        health: {
          database: { status: 'healthy', latencyMs: dbLatency },
          server: { status: 'healthy', uptime: process.uptime(), memoryUsage: process.memoryUsage() },
          timestamp: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /monitoring/activity-logs — System activity logs
router.get('/activity-logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, entity, tenantId: filterTenantId } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(entity && { entity: { contains: entity, mode: 'insensitive' } }),
      ...(filterTenantId && { tenantId: filterTenantId })
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          tenant: { select: { name: true, code: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.activityLog.count({ where })
    ])

    res.json({
      data: logs,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /monitoring/school-stats/:schoolId — Stats for a specific school
router.get('/school-stats/:schoolId', async (req, res, next) => {
  try {
    const { schoolId } = req.params

    const tenant = await prisma.tenant.findUnique({
      where: { id: schoolId },
      include: {
        plan: true,
        settings: true,
        _count: { select: { users: true, students: true, classes: true, subjects: true, scores: true } }
      }
    })

    if (!tenant) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'School not found' } })
    }

    // User breakdown
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      where: { tenantId: schoolId },
      _count: true
    })

    // Grade/class distribution
    const grades = await prisma.grade.findMany({
      where: { tenantId: schoolId },
      include: {
        classes: {
          include: { _count: { select: { students: true } } }
        }
      },
      orderBy: { level: 'asc' }
    })

    // Recent activity
    const recentLogs = await prisma.activityLog.findMany({
      where: { tenantId: schoolId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Score stats
    const scoreStats = await prisma.score.aggregate({
      where: { tenantId: schoolId },
      _avg: { value: true },
      _min: { value: true },
      _max: { value: true },
      _count: true
    })

    res.json({
      data: {
        tenant,
        usersByRole,
        grades,
        recentLogs,
        scoreStats
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
