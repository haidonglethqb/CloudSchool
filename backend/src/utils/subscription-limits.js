const { AppError } = require('../middleware/errorHandler')

const buildAcademicYearLabel = (academicYear) => `${academicYear.startYear}-${academicYear.endYear}`

const buildAcademicYearClassWhere = (tenantId, academicYear) => {
  const label = typeof academicYear === 'string'
    ? academicYear
    : academicYear
      ? buildAcademicYearLabel(academicYear)
      : null

  if (!academicYear && !label) return { tenantId }
  if (typeof academicYear === 'object' && academicYear?.id) {
    return {
      tenantId,
      OR: [
        { academicYearId: academicYear.id },
        { academicYear: label }
      ]
    }
  }

  return { tenantId, academicYear: label }
}

const getClassCountForAcademicYear = async (prisma, tenantId, academicYear) => prisma.class.count({
  where: buildAcademicYearClassWhere(tenantId, academicYear)
})

const getActiveAcademicYearClassCount = async (prisma, tenantId) => {
  const activeAcademicYear = await prisma.academicYear.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true, startYear: true, endYear: true }
  })

  if (!activeAcademicYear) {
    return prisma.class.count({ where: { tenantId } })
  }

  return getClassCountForAcademicYear(prisma, tenantId, activeAcademicYear)
}

const getMaxClassCountInAcademicYear = async (prisma, tenantId) => {
  const counts = await prisma.class.groupBy({
    by: ['academicYear'],
    where: { tenantId },
    _count: { _all: true }
  })

  return counts.reduce((max, row) => Math.max(max, row._count._all), 0)
}

const getTenantPlanUsage = async (prisma, tenantId) => {
  const [students, classes, staff, teachers] = await Promise.all([
    prisma.student.count({ where: { tenantId, isActive: true } }),
    getActiveAcademicYearClassCount(prisma, tenantId),
    prisma.user.count({ where: { tenantId, role: 'STAFF', isActive: true } }),
    prisma.user.count({ where: { tenantId, role: 'TEACHER', isActive: true } })
  ])

  return { students, classes, staff, teachers }
}

const getTenantPlanLimitValidationUsage = async (prisma, tenantId) => {
  const [usage, maxClassesInAcademicYear] = await Promise.all([
    getTenantPlanUsage(prisma, tenantId),
    getMaxClassCountInAcademicYear(prisma, tenantId)
  ])

  return { ...usage, classes: maxClassesInAcademicYear }
}

const getTenantPlanLimits = async (prisma, tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true }
  })

  if (!tenant?.plan) return null
  return {
    students: tenant.plan.studentLimit,
    classes: tenant.plan.classLimit,
    staff: tenant.plan.staffLimit,
    teachers: tenant.plan.teacherLimit
  }
}

const assertUsageWithinLimits = (usage, limits, code = 'PLAN_LIMIT_EXCEEDED') => {
  if (!limits) return

  const checks = [
    ['students', 'students'],
    ['classes', 'classes'],
    ['staff', 'staff users'],
    ['teachers', 'teachers']
  ]

  for (const [key, label] of checks) {
    if (usage[key] > limits[key]) {
      throw new AppError(
        `Current ${label} (${usage[key]}) exceeds subscription limit (${limits[key]})`,
        400,
        code
      )
    }
  }
}

const assertTenantWithinCurrentPlan = async (prisma, tenantId) => {
  const [usage, limits] = await Promise.all([
    getTenantPlanUsage(prisma, tenantId),
    getTenantPlanLimits(prisma, tenantId)
  ])
  assertUsageWithinLimits(usage, limits)
}

const assertRoleUserLimit = async (prisma, tenantId, role, excludeUserId = null) => {
  if (!['STAFF', 'TEACHER'].includes(role)) return

  const limits = await getTenantPlanLimits(prisma, tenantId)
  if (!limits) return

  const key = role === 'STAFF' ? 'staff' : 'teachers'
  const current = await prisma.user.count({
    where: {
      tenantId,
      role,
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {})
    }
  })

  if (current + 1 > limits[key]) {
    throw new AppError(
      `Cannot exceed subscription ${key} limit (${limits[key]})`,
      400,
      'PLAN_LIMIT_EXCEEDED'
    )
  }
}

module.exports = {
  getTenantPlanUsage,
  getTenantPlanLimitValidationUsage,
  getTenantPlanLimits,
  getClassCountForAcademicYear,
  getMaxClassCountInAcademicYear,
  assertUsageWithinLimits,
  assertTenantWithinCurrentPlan,
  assertRoleUserLimit
}
