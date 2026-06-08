const { AppError } = require('../middleware/errorHandler')

const SCOPED_ASSIGNMENT_ROLES = ['STAFF', 'TEACHER']

const getUserAssignmentScope = async (prisma, req, options = {}) => {
  if (!SCOPED_ASSIGNMENT_ROLES.includes(req.user?.role)) return null

  const { subjectId = null, semesterId = null } = options
  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      tenantId: req.tenantId,
      teacherId: req.user.id,
      ...(subjectId ? { subjectId } : {}),
      ...(semesterId ? { semesterId } : {})
    },
    select: { classId: true, subjectId: true, semesterId: true }
  })

  if (req.user.role === 'STAFF' && assignments.length === 0) return null

  const classIds = [...new Set(assignments.map((item) => item.classId))]
  const subjectIds = [...new Set(assignments.map((item) => item.subjectId))]
  const semesterIds = [...new Set(assignments.map((item) => item.semesterId))]
  const pairSet = new Set(assignments.map((item) => `${item.classId}::${item.subjectId}`))
  const classSubjectSemesterSet = new Set(assignments.map((item) => `${item.classId}::${item.subjectId}::${item.semesterId}`))

  return {
    classIds,
    subjectIds,
    semesterIds,
    pairSet,
    classSubjectSemesterSet,
    hasAssignments: assignments.length > 0,
  }
}

const ensureClassAccess = async (prisma, req, classId, options = {}) => {
  const scope = await getUserAssignmentScope(prisma, req, options)
  if (!scope) return
  if (scope.classIds.includes(classId)) return
  throw new AppError('Not assigned to this class', 403, 'FORBIDDEN')
}

const ensureClassSubjectAccess = async (prisma, req, classId, subjectId, options = {}) => {
  const scope = await getUserAssignmentScope(prisma, req, { ...options, subjectId })
  if (!scope) return
  if (options.semesterId && scope.classSubjectSemesterSet.has(`${classId}::${subjectId}::${options.semesterId}`)) return
  if (scope.pairSet.has(`${classId}::${subjectId}`)) return
  throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
}

module.exports = {
  getUserAssignmentScope,
  ensureClassAccess,
  ensureClassSubjectAccess,
}
