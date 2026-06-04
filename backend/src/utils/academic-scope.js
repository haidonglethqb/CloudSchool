const { AppError } = require('../middleware/errorHandler')

const academicYearLabel = (year) => `${year.startYear}-${year.endYear}`

const semesterDisplayName = (semester) => {
  const label = semester.academicYear
    ? academicYearLabel(semester.academicYear)
    : semester.year
  return `${semester.name} (${label})`
}

const decorateSemester = (semester) => {
  const label = semester.academicYear
    ? academicYearLabel(semester.academicYear)
    : semester.year
  return {
    ...semester,
    academicYearLabel: label,
    displayName: `${semester.name} (${label})`,
    isCurrent: semester.isActive
  }
}

const getClassYearFilter = (academicYear) => ({
  OR: [
    { academicYearId: academicYear.id },
    { academicYear: academicYearLabel(academicYear) }
  ]
})

const versionAppliesToClass = (version, classInfo) => {
  const hasClassScopes = (version.classScopes || []).length > 0
  const hasGradeScopes = (version.gradeScopes || []).length > 0
  const classMatch = (version.classScopes || []).some((scope) => scope.classId === classInfo.id)
  if (classMatch) return { applies: true, scopeType: 'CLASS' }

  const gradeMatch = (version.gradeScopes || []).some((scope) => scope.gradeId === classInfo.gradeId)
  if (gradeMatch) return { applies: true, scopeType: 'GRADE' }

  if (hasClassScopes || hasGradeScopes) return { applies: false, scopeType: null }
  return { applies: false, scopeType: null }
}

const getSubjectVersionForClass = async (prisma, tenantId, { classId, subjectId, academicYearId }) => {
  const classInfo = await prisma.class.findFirst({
    where: { id: classId, tenantId },
    include: { grade: true }
  })
  if (!classInfo) throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, tenantId }
  })
  if (!academicYear) throw new AppError('Academic year not found', 404, 'ACADEMIC_YEAR_NOT_FOUND')

  const classInYear = classInfo.academicYearId === academicYear.id || classInfo.academicYear === academicYearLabel(academicYear)
  if (!classInYear) {
    throw new AppError('Lớp không thuộc năm học đã chọn', 400, 'CLASS_YEAR_MISMATCH')
  }

  const version = await prisma.subjectVersion.findFirst({
    where: { tenantId, subjectId, academicYearId, isActive: true },
    include: {
      subject: true,
      gradeScopes: true,
      classScopes: true
    }
  })
  if (!version) throw new AppError('Môn học chưa được áp dụng cho năm học này', 400, 'SUBJECT_NOT_IN_YEAR')

  const match = versionAppliesToClass(version, classInfo)
  if (!match.applies) {
    throw new AppError('Môn học không áp dụng cho lớp này trong năm học đã chọn', 400, 'SUBJECT_NOT_APPLIED_TO_CLASS')
  }

  return { version, classInfo, academicYear, scopeType: match.scopeType }
}

const getEffectiveSubjectsForClass = async (prisma, tenantId, { classId, academicYearId }) => {
  const classInfo = await prisma.class.findFirst({
    where: { id: classId, tenantId },
    include: { grade: true }
  })
  if (!classInfo) throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, tenantId }
  })
  if (!academicYear) throw new AppError('Academic year not found', 404, 'ACADEMIC_YEAR_NOT_FOUND')

  const classInYear = classInfo.academicYearId === academicYear.id || classInfo.academicYear === academicYearLabel(academicYear)
  if (!classInYear) {
    throw new AppError('Lớp không thuộc năm học đã chọn', 400, 'CLASS_YEAR_MISMATCH')
  }

  const versions = await prisma.subjectVersion.findMany({
    where: { tenantId, academicYearId, isActive: true, subject: { isActive: true } },
    include: {
      subject: true,
      gradeScopes: true,
      classScopes: true
    },
    orderBy: { subject: { name: 'asc' } }
  })

  return versions
    .map((version) => {
      const match = versionAppliesToClass(version, classInfo)
      if (!match.applies) return null
      return {
        ...version.subject,
        subjectVersionId: version.id,
        versionName: version.versionName,
        academicYearId: version.academicYearId,
        scopeType: match.scopeType
      }
    })
    .filter(Boolean)
}

const getComponentSetForSubjectSemester = async (prisma, tenantId, { subjectId, semesterId }) => {
  const componentSet = await prisma.scoreComponentSet.findFirst({
    where: { tenantId, subjectId, semesterId, isActive: true },
    include: {
      components: {
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { weight: 'desc' }, { name: 'asc' }]
      }
    }
  })
  if (!componentSet) {
    return { componentSet: null, components: [], warning: 'Chưa cấu hình thành phần điểm cho môn học trong học kỳ này' }
  }
  return { componentSet, components: componentSet.components, warning: null }
}

const resolveScoreEntryContext = async (prisma, tenantId, { classId, subjectId, semesterId }) => {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, tenantId },
    include: { academicYear: true }
  })
  if (!semester) throw new AppError('Semester not found', 404, 'SEMESTER_NOT_FOUND')
  if (!semester.academicYearId) throw new AppError('Học kỳ chưa gắn năm học', 400, 'SEMESTER_YEAR_MISSING')

  const subjectContext = await getSubjectVersionForClass(prisma, tenantId, {
    classId,
    subjectId,
    academicYearId: semester.academicYearId
  })
  const componentContext = await getComponentSetForSubjectSemester(prisma, tenantId, { subjectId, semesterId })

  return {
    ...subjectContext,
    semester,
    componentSet: componentContext.componentSet,
    components: componentContext.components,
    componentWarning: componentContext.warning
  }
}

module.exports = {
  academicYearLabel,
  semesterDisplayName,
  decorateSemester,
  getClassYearFilter,
  getEffectiveSubjectsForClass,
  getSubjectVersionForClass,
  getComponentSetForSubjectSemester,
  resolveScoreEntryContext
}
