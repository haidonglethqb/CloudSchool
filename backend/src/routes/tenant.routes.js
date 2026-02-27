const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')

// Get current tenant info
router.get('/current', authenticate, async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      include: {
        settings: true,
        _count: {
          select: {
            students: true,
            classes: true,
            users: true
          }
        }
      }
    })

    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// Update tenant info (admin only)
router.patch('/current', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, address, phone, email, logo } = req.body

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { name, address, phone, email, logo }
    })

    res.json({ data: tenant })
  } catch (error) {
    next(error)
  }
})

// Get tenant statistics
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [
      totalStudents,
      totalClasses,
      totalTeachers,
      recentStudents
    ] = await Promise.all([
      prisma.student.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.class.count({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.user.count({ where: { tenantId: req.tenantId, role: 'TEACHER', isActive: true } }),
      prisma.student.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: true }
      })
    ])

    res.json({
      data: {
        totalStudents,
        totalClasses,
        totalTeachers,
        recentStudents
      }
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
