const express = require('express')
const router = express.Router()
const os = require('os')
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

    // School growth over last 12 months (single query instead of 12)
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [schoolGrowthRaw, studentGrowthRaw] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
               count(*)::int as count
        FROM tenants
        WHERE "createdAt" >= ${twelveMonthsAgo}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY date_trunc('month', "createdAt")
      `,
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
               count(*)::int as count
        FROM students
        WHERE "createdAt" >= ${twelveMonthsAgo}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY date_trunc('month', "createdAt")
      `
    ])

    // Build full 12-month arrays with zero-fills
    const schoolGrowthMap = new Map(schoolGrowthRaw.map(r => [r.month, r.count]))
    const studentGrowthMap = new Map(studentGrowthRaw.map(r => [r.month, r.count]))
    const schoolGrowth = []
    const studentGrowth = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `T${d.getMonth() + 1}/${d.getFullYear() % 100}`
      schoolGrowth.push({ month: key, label, count: schoolGrowthMap.get(key) || 0 })
      studentGrowth.push({ month: key, label, count: studentGrowthMap.get(key) || 0 })
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

    // Real system health metrics
    const dbStart = Date.now()
    let dbStatus = 'healthy'
    let dbVersion = ''
    let dbTableCount = 0
    let dbActiveConnections = 0
    try {
      const versionResult = await prisma.$queryRaw`SELECT version()`
      dbVersion = versionResult[0]?.version || ''
      const tableCountResult = await prisma.$queryRaw`SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
      const activeConnResult = await prisma.$queryRaw`SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'`
      dbTableCount = Number(tableCountResult[0]?.count || 0)
      dbActiveConnections = Number(activeConnResult[0]?.count || 0)
    } catch {
      dbStatus = 'unhealthy'
    }
    const dbLatency = Date.now() - dbStart

    // OS-level metrics
    const cpus = os.cpus()
    const cpuCount = cpus.length
    const cpuModel = cpus[0]?.model || 'Unknown'
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const loadAvg = os.loadavg()

    // Node.js process metrics
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()
    const nodeVersion = process.version
    const platform = `${os.type()} ${os.release()}`
    const hostname = os.hostname()

    // CPU usage percentage (average across all cores from last sample)
    const cpuUsagePercent = Math.round((loadAvg[0] / cpuCount) * 100 * 10) / 10

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
          server: {
            status: 'healthy',
            uptime,
            nodeVersion,
            platform,
            hostname,
            pid: process.pid,
          },
          cpu: {
            model: cpuModel,
            cores: cpuCount,
            usagePercent: cpuUsagePercent,
            loadAvg: {
              '1m': Math.round(loadAvg[0] * 100) / 100,
              '5m': Math.round(loadAvg[1] * 100) / 100,
              '15m': Math.round(loadAvg[2] * 100) / 100,
            },
          },
          memory: {
            system: {
              total: totalMem,
              used: usedMem,
              free: freeMem,
              usagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
            },
            process: {
              rss: memUsage.rss,
              heapUsed: memUsage.heapUsed,
              heapTotal: memUsage.heapTotal,
              external: memUsage.external,
            },
          },
          database: {
            status: dbStatus,
            latencyMs: dbLatency,
            version: 'PostgreSQL',
            tables: dbTableCount,
            activeConnections: dbActiveConnections,
          },
          timestamp: new Date().toISOString(),
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
