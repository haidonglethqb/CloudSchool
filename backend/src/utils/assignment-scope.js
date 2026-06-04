const { AppError } = require('../middleware/errorHandler')

const SCOPED_ASSIGNMENT_ROLES = ['STAFF', 'TEACHER']

const getUserAssignmentScope = async (prisma, req, subjectId = null) => {
  if (!SCOPED_ASSIGNMENT_ROLES.includes(req.user?.role)) return null

  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      tenantId: req.tenantId,
      teacherId: req.user.id,
      ...(subjectId ? { subjectId } : {})
    },
    select: { classId: true, subjectId: true }
  })

  if (req.user.role === 'STAFF' && assignments.length === 0) return null

  const classIds = [...new Set(assignments.map((item) => item.classId))]
  const subjectIds = [...new Set(assignments.map((item) => item.subjectId))]
  const pairSet = new Set(assignments.map((item) => `${item.classId}::${item.subjectId}`))
  return { classIds, subjectIds, pairSet, hasAssignments: assignments.length > 0 }
}

const ensureClassAccess = async (prisma, req, classId) => {
  const scope = await getUserAssignmentScope(prisma, req)
  if (!scope) return
  if (scope.classIds.includes(classId)) return
  throw new AppError('Not assigned to this class', 403, 'FORBIDDEN')
}

const ensureClassSubjectAccess = async (prisma, req, classId, subjectId) => {
  const scope = await getUserAssignmentScope(prisma, req)
  if (!scope) return
  if (scope.pairSet.has(`${classId}::${subjectId}`)) return
  throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
}

module.exports = {
  getUserAssignmentScope,
  ensureClassAccess,
  ensureClassSubjectAccess,
}
