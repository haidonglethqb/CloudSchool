const prisma = require('../lib/prisma')
const { AppError } = require('../middleware/errorHandler')
const { academicYearLabel } = require('./academic-scope')

const getActiveSemesterContext = async (tenantId, tx = prisma) => {
  const activeSemester = await tx.semester.findFirst({
    where: { tenantId, isActive: true, academicYearId: { not: null } },
    include: { academicYear: true },
    orderBy: [{ updatedAt: 'desc' }, { semesterNum: 'asc' }]
  })
  if (!activeSemester) throw new AppError('No active semester found', 400, 'NO_ACTIVE_SEMESTER')
  return activeSemester
}

const getAcademicYearContext = async (tenantId, academicYearId, tx = prisma) => {
  if (academicYearId) {
    const year = await tx.academicYear.findFirst({ where: { id: academicYearId, tenantId } })
    if (!year) throw new AppError('Academic year not found', 404, 'ACADEMIC_YEAR_NOT_FOUND')
    return year
  }

  const activeYear = await tx.academicYear.findFirst({ where: { tenantId, isActive: true } })
  if (!activeYear) throw new AppError('No active academic year found', 400, 'NO_ACTIVE_ACADEMIC_YEAR')
  return activeYear
}

const getClassAcademicYearMatch = (academicYear) => ({
  OR: [
    { academicYearId: academicYear.id },
    { academicYear: academicYearLabel(academicYear) }
  ]
})

const getLatestEnrollmentRowsForAcademicYear = async (tx, tenantId, academicYearId, options = {}) => {
  const enrollments = await tx.classEnrollment.findMany({
    where: {
      tenantId,
      academicYearId,
      ...(options.studentIds?.length ? { studentId: { in: options.studentIds } } : {}),
      ...(options.onlyActiveStudents ? { student: { isActive: true } } : {})
    },
    include: {
      class: { include: { grade: true } },
      semester: true,
      student: true
    },
    orderBy: [
      { semester: { semesterNum: 'desc' } },
      { createdAt: 'desc' }
    ]
  })

  const latestByStudent = new Map()
  for (const enrollment of enrollments) {
    if (!latestByStudent.has(enrollment.studentId)) {
      latestByStudent.set(enrollment.studentId, enrollment)
    }
  }
  return [...latestByStudent.values()]
}

const getClassRosterForAcademicYear = async (tx, tenantId, classId, academicYearId, options = {}) => {
  const latestRows = await getLatestEnrollmentRowsForAcademicYear(tx, tenantId, academicYearId, options)
  return latestRows
    .filter((row) => row.classId === classId)
    .map((row) => ({
      ...row.student,
      class: row.class,
      classId: row.classId,
      enrollmentId: row.id,
      enrollmentSemesterId: row.semesterId
    }))
    .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi'))
}

const getClassCountsForAcademicYear = async (tx, tenantId, academicYearId, classIds = [], options = {}) => {
  const latestRows = await getLatestEnrollmentRowsForAcademicYear(tx, tenantId, academicYearId, {
    onlyActiveStudents: options.onlyActiveStudents !== false
  })
  const allowedIds = new Set((classIds || []).filter(Boolean))
  const counts = new Map()
  for (const row of latestRows) {
    if (allowedIds.size > 0 && !allowedIds.has(row.classId)) continue
    counts.set(row.classId, (counts.get(row.classId) || 0) + 1)
  }
  return counts
}

const attachClassCountsForAcademicYear = async (tx, tenantId, classes, academicYearId) => {
  const rows = Array.isArray(classes) ? classes : []
  if (rows.length === 0 || !academicYearId) return rows
  const counts = await getClassCountsForAcademicYear(tx, tenantId, academicYearId, rows.map((item) => item.id))
  return rows.map((item) => ({
    ...item,
    _count: {
      ...(item._count || {}),
      students: counts.get(item.id) || 0
    }
  }))
}

const countActiveEnrollmentInSemester = async (tx, tenantId, classId, semesterId) => {
  return tx.classEnrollment.count({
    where: {
      tenantId,
      classId,
      semesterId,
      student: { isActive: true }
    }
  })
}

const getActiveEnrollmentForStudent = async (tx, tenantId, studentId) => {
  const activeSemester = await getActiveSemesterContext(tenantId, tx)
  const enrollment = await tx.classEnrollment.findFirst({
    where: { tenantId, studentId, semesterId: activeSemester.id },
    include: { class: { include: { grade: true } }, semester: true }
  })
  return { activeSemester, enrollment }
}

module.exports = {
  attachClassCountsForAcademicYear,
  countActiveEnrollmentInSemester,
  getAcademicYearContext,
  getActiveEnrollmentForStudent,
  getActiveSemesterContext,
  getClassAcademicYearMatch,
  getClassCountsForAcademicYear,
  getClassRosterForAcademicYear,
  getLatestEnrollmentRowsForAcademicYear
}
