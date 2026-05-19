const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature, requireAllFeatures } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')

const normalizeFormat = (format) => {
  if (!format) return 'csv'
  if (format === 'excel') return 'xlsx'
  return format
}

function sendCSV(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('X-Content-Type-Options', 'nosniff')

  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (/^[=+\-@]/.test(str)) return `'${str}`
    return str
  }

  let csv = '\uFEFF'
  csv += headers.join(',') + '\n'
  for (const row of rows) {
    csv += row.map((cell) => {
      const escaped = escapeCsvValue(cell)
      return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
        ? `"${escaped.replace(/"/g, '""')}"`
        : escaped
    }).join(',') + '\n'
  }
  res.send(csv)
}

async function sendExcel(res, filename, sheets) {
  const workbook = new ExcelJS.Workbook()

  for (const sheetData of sheets) {
    const sheet = workbook.addWorksheet(sheetData.name.slice(0, 31))
    sheet.columns = sheetData.headers.map((header, index) => ({
      header,
      key: `col${index}`,
      width: Math.max(header.length + 6, 16)
    }))
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } }
    for (const row of sheetData.rows) {
      const record = {}
      sheetData.headers.forEach((_, index) => {
        record[`col${index}`] = row[index]
      })
      sheet.addRow(record)
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

function sendPDF(res, filename, sheets) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  const doc = new PDFDocument({ size: 'A4', margin: 32 })
  doc.pipe(res)

  const drawSheet = (sheet, index) => {
    if (index > 0) doc.addPage()
    doc.fontSize(14).text(sheet.name)
    doc.moveDown(0.5)
    doc.fontSize(9).text(sheet.headers.join(' | '))
    doc.moveDown(0.2)
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 32, doc.y).stroke()
    doc.moveDown(0.4)
    for (const row of sheet.rows) {
      const line = row.map((cell) => String(cell ?? '')).join(' | ')
      if (doc.y > doc.page.height - 40) {
        doc.addPage()
        doc.fontSize(9).text(sheet.headers.join(' | '))
        doc.moveDown(0.2)
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 32, doc.y).stroke()
        doc.moveDown(0.4)
      }
      doc.fontSize(8).text(line, { width: doc.page.width - 64 })
    }
  }

  sheets.forEach(drawSheet)
  doc.end()
}

const mapGenderLabel = (gender) => {
  if (gender === 'MALE') return 'Nam'
  if (gender === 'FEMALE') return 'Nữ'
  return 'Khác'
}

const parseDynamicSections = (rawSections) => {
  if (!rawSections) return []
  if (Array.isArray(rawSections)) return rawSections.flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean)
  return String(rawSections).split(',').map((value) => value.trim()).filter(Boolean)
}

router.use(authenticate, requireFeature('export'))

// GET /export/students
router.get('/students', authorize('SUPER_ADMIN', 'STAFF', 'PLATFORM_ADMIN'), requireFeature('student-lookup'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)

    const { classId, gradeId, search, address, gender, birthYear, status } = req.query
    const where = {}
    if (req.user.role !== 'PLATFORM_ADMIN') where.tenantId = req.tenantId
    if (classId) where.classId = classId
    if (gradeId) where.class = { gradeId }
    if (search) {
      where.OR = [
        { fullName: { contains: String(search), mode: 'insensitive' } },
        { studentCode: { contains: String(search), mode: 'insensitive' } }
      ]
    }
    if (address) where.address = { contains: String(address), mode: 'insensitive' }
    if (gender) where.gender = String(gender)
    if (status === 'active') where.isActive = true
    if (status === 'inactive') where.isActive = false
    if (birthYear && Number.isInteger(Number(birthYear))) {
      where.dateOfBirth = {
        gte: new Date(`${birthYear}-01-01T00:00:00.000Z`),
        lte: new Date(`${birthYear}-12-31T23:59:59.999Z`)
      }
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        class: { include: { grade: true } },
        tenant: { select: { name: true } }
      },
      orderBy: { fullName: 'asc' }
    })

    const headers = ['Mã HS', 'Họ tên', 'Giới tính', 'Ngày sinh', 'Lớp', 'Khối', 'Địa chỉ', 'SĐT', 'Tên phụ huynh', 'SĐT PH', 'Trạng thái']
    if (req.user.role === 'PLATFORM_ADMIN') headers.push('Trường')

    const rows = students.map((student) => {
      const row = [
        student.studentCode,
        student.fullName,
        mapGenderLabel(student.gender),
        new Date(student.dateOfBirth).toLocaleDateString('vi-VN'),
        student.class?.name || '',
        student.class?.grade?.name || '',
        student.address || '',
        student.phone || '',
        student.parentName || '',
        student.parentPhone || '',
        student.isActive ? 'Đang học' : 'Nghỉ học'
      ]
      if (req.user.role === 'PLATFORM_ADMIN') row.push(student.tenant?.name || '')
      return row
    })

    const filename = `students_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Danh sach hoc sinh', headers, rows }])
      return
    }
    if (format === 'pdf') {
      sendPDF(res, `${filename}.pdf`, [{ name: 'Danh sach hoc sinh', headers, rows }])
      return
    }
    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    next(error)
  }
})

// GET /export/classes
router.get('/classes', authorize('SUPER_ADMIN', 'STAFF', 'PLATFORM_ADMIN'), requireFeature('classes'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)
    if (format === 'pdf') throw new AppError('PDF export is not configured in this environment', 400, 'UNSUPPORTED_FORMAT')

    const where = {}
    if (req.user.role !== 'PLATFORM_ADMIN') where.tenantId = req.tenantId

    const classes = await prisma.class.findMany({
      where,
      include: {
        grade: true,
        _count: { select: { students: true } },
        tenant: { select: { name: true } }
      },
      orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }]
    })

    const headers = ['Tên lớp', 'Khối', 'Năm học', 'Sĩ số', 'Sức chứa', 'Trạng thái']
    if (req.user.role === 'PLATFORM_ADMIN') headers.push('Trường')

    const rows = classes.map((cls) => {
      const row = [
        cls.name,
        cls.grade?.name || '',
        cls.academicYear,
        cls._count.students,
        cls.capacity,
        cls.isActive ? 'Hoạt động' : 'Không hoạt động'
      ]
      if (req.user.role === 'PLATFORM_ADMIN') row.push(cls.tenant?.name || '')
      return row
    })

    const filename = `classes_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Danh sach lop', headers, rows }])
      return
    }
    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    next(error)
  }
})

// GET /export/scores
router.get('/scores', authorize('SUPER_ADMIN', 'STAFF', 'TEACHER', 'PLATFORM_ADMIN'), requireFeature('scores'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)
    if (format === 'pdf') throw new AppError('PDF export is not configured in this environment', 400, 'UNSUPPORTED_FORMAT')

    const { classId, subjectId, semesterId } = req.query
    if (!classId || !subjectId || !semesterId) {
      throw new AppError('classId, subjectId, and semesterId are required', 400, 'MISSING_PARAMS')
    }

    if (req.user.role === 'TEACHER') {
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { teacherId: req.user.id, classId, subjectId, tenantId: req.tenantId }
      })
      if (!assignment) throw new AppError('Not assigned to this class/subject', 403, 'FORBIDDEN')
    }

    const students = await prisma.student.findMany({
      where: { classId, tenantId: req.tenantId, isActive: true },
      orderBy: { fullName: 'asc' }
    })
    const scoreComponents = await prisma.scoreComponent.findMany({
      where: { subjectId, tenantId: req.tenantId },
      orderBy: { weight: 'desc' }
    })
    const allScores = await prisma.score.findMany({
      where: {
        studentId: { in: students.map((student) => student.id) },
        subjectId,
        semesterId,
        tenantId: req.tenantId
      }
    })

    const scoresByStudent = {}
    for (const score of allScores) {
      if (!scoresByStudent[score.studentId]) scoresByStudent[score.studentId] = []
      scoresByStudent[score.studentId].push(score)
    }

    const headers = ['STT', 'Mã HS', 'Họ tên', ...scoreComponents.map((component) => `${component.name} (${component.weight}%)`), 'ĐTB']
    const rows = students.map((student, index) => {
      const scores = scoresByStudent[student.id] || []
      let weightedSum = 0
      let totalWeight = 0
      const scoreValues = scoreComponents.map((component) => {
        const score = scores.find((item) => item.scoreComponentId === component.id)
        if (!score) return ''
        weightedSum += score.value * component.weight
        totalWeight += component.weight
        return score.value
      })
      const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : ''
      return [index + 1, student.studentCode, student.fullName, ...scoreValues, average]
    })

    const filename = `scores_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Bang diem', headers, rows }])
      return
    }
    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    next(error)
  }
})

// GET /export/reports/:type?format=csv|xlsx&sections=summary,details
router.get('/reports/:type', authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireAllFeatures(['reports']), async (req, res, next) => {
  try {
    const type = req.params.type
    const format = normalizeFormat(req.query.format)

    const sections = parseDynamicSections(req.query.sections)
    const requested = sections.length > 0 ? new Set(sections) : null
    const sheets = []
    const wantsSummary = !requested || requested.has('summary')
    const wantsStudents = !requested || requested.has('students')

    if (type === 'class-promotion-summary') {
      const { classId, semesterId } = req.query
      if (!classId || !semesterId) throw new AppError('classId and semesterId are required', 400, 'MISSING_PARAMS')

      const classInfo = await prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, include: { grade: true } })
      const promotions = await prisma.promotion.findMany({
        where: { tenantId: req.tenantId, classId, semesterId },
        include: { student: { select: { studentCode: true, fullName: true } } },
        orderBy: { student: { fullName: 'asc' } }
      })
      const passCount = promotions.filter((item) => item.result === 'PASS').length

      if (wantsSummary) {
        sheets.push({
          name: 'Tong hop',
          headers: ['Lớp', 'Khối', 'Sĩ số xét', 'Số lên lớp', 'Tỷ lệ lên lớp'],
          rows: [[
            classInfo?.name || '',
            classInfo?.grade?.name || '',
            promotions.length,
            passCount,
            promotions.length > 0 ? `${Math.round((passCount / promotions.length) * 10000) / 100}%` : '0%'
          ]]
        })
      }
      if (wantsStudents) {
        sheets.push({
          name: 'Danh sach hoc sinh',
          headers: ['Mã HS', 'Họ tên', 'Điểm TB', 'Kết quả'],
          rows: promotions.map((item) => [item.student.studentCode, item.student.fullName, item.average, item.result === 'PASS' ? 'Lên lớp' : 'Không lên lớp'])
        })
      }
    } else if (type === 'semester-promotion-summary') {
      const { semesterId } = req.query
      if (!semesterId) throw new AppError('semesterId is required', 400, 'MISSING_PARAMS')

      const promotions = await prisma.promotion.findMany({
        where: { tenantId: req.tenantId, semesterId },
        include: { class: { include: { grade: true } } }
      })
      const grouped = new Map()
      for (const item of promotions) {
        if (!grouped.has(item.classId)) {
          grouped.set(item.classId, { className: item.class.name, gradeName: item.class.grade.name, total: 0, pass: 0 })
        }
        const bucket = grouped.get(item.classId)
        bucket.total += 1
        if (item.result === 'PASS') bucket.pass += 1
      }
      const rows = [...grouped.values()].map((item) => [
        item.className,
        item.gradeName,
        item.total,
        item.pass,
        item.total > 0 ? `${Math.round((item.pass / item.total) * 10000) / 100}%` : '0%'
      ])
      if (wantsSummary) {
        sheets.push({ name: 'Theo lop', headers: ['Lớp', 'Khối', 'Sĩ số xét', 'Số lên lớp', 'Tỷ lệ lên lớp'], rows })
      }
    } else if (type === 'year-promotion-summary') {
      const { academicYearId } = req.query
      if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')

      const year = await prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId: req.tenantId },
        include: { semesters: { orderBy: { semesterNum: 'asc' } } }
      })
      if (!year || year.semesters.length === 0) throw new AppError('Academic year has no semesters', 400, 'NO_SEMESTERS')
      const finalSemester = year.semesters[year.semesters.length - 1]

      const promotions = await prisma.promotion.findMany({
        where: { tenantId: req.tenantId, semesterId: finalSemester.id },
        include: { class: { include: { grade: true } } }
      })
      const grouped = new Map()
      for (const item of promotions) {
        if (!grouped.has(item.class.gradeId)) {
          grouped.set(item.class.gradeId, { gradeName: item.class.grade.name, gradeLevel: item.class.grade.level, total: 0, pass: 0 })
        }
        const bucket = grouped.get(item.class.gradeId)
        bucket.total += 1
        if (item.result === 'PASS') bucket.pass += 1
      }
      const rows = [...grouped.values()]
        .sort((a, b) => a.gradeLevel - b.gradeLevel)
        .map((item) => [
          item.gradeName,
          item.total,
          item.pass,
          item.total > 0 ? `${Math.round((item.pass / item.total) * 10000) / 100}%` : '0%'
        ])
      if (wantsSummary) {
        sheets.push({ name: 'Theo khoi', headers: ['Khối', 'Sĩ số xét', 'Số lên lớp', 'Tỷ lệ lên lớp'], rows })
      }
    } else if (type === 'subject-summary') {
      const { subjectId, semesterId } = req.query
      if (!subjectId || !semesterId) throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')

      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
      const classes = await prisma.class.findMany({
        where: { tenantId: req.tenantId, isActive: true },
        include: { students: { where: { isActive: true } }, grade: true }
      })
      const allStudentIds = classes.flatMap((cls) => cls.students.map((student) => student.id))
      const scores = allStudentIds.length
        ? await prisma.score.findMany({
            where: { tenantId: req.tenantId, subjectId, semesterId, studentId: { in: allStudentIds } },
            include: { scoreComponent: true }
          })
        : []
      const scoreMap = new Map()
      for (const score of scores) {
        if (!scoreMap.has(score.studentId)) scoreMap.set(score.studentId, [])
        scoreMap.get(score.studentId).push(score)
      }

      const rows = classes.map((cls) => {
        let pass = 0
        let withScores = 0
        for (const student of cls.students) {
          const values = scoreMap.get(student.id) || []
          let weightedSum = 0
          let totalWeight = 0
          for (const value of values) {
            weightedSum += value.value * value.scoreComponent.weight
            totalWeight += value.scoreComponent.weight
          }
          if (totalWeight <= 0) continue
          withScores += 1
          const average = weightedSum / totalWeight
          if (average >= settings.passScore) pass += 1
        }
        return [
          cls.name,
          cls.grade?.name || '',
          cls.students.length,
          pass,
          cls.students.length > 0 ? `${Math.round((pass / cls.students.length) * 10000) / 100}%` : '0%'
        ]
      })
      if (wantsSummary) {
        sheets.push({ name: 'Theo lop', headers: ['Lớp', 'Khối', 'Sĩ số', 'Số đạt', 'Tỷ lệ đạt'], rows })
      }
    } else {
      throw new AppError('Unsupported report type', 400, 'UNSUPPORTED_REPORT_TYPE')
    }

    if (sheets.length === 0) throw new AppError('No section selected for export', 400, 'NO_EXPORT_SECTION')
    const filename = `report_${type}_${new Date().toISOString().split('T')[0]}`

    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, sheets)
      return
    }
    if (format === 'pdf') {
      sendPDF(res, `${filename}.pdf`, sheets)
      return
    }

    const csvHeaders = sheets[0].headers
    const csvRows = sheets[0].rows
    sendCSV(res, `${filename}.csv`, csvHeaders, csvRows)
  } catch (error) {
    next(error)
  }
})

// GET /export/schools
router.get('/schools', authorize('PLATFORM_ADMIN'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)
    if (format === 'pdf') throw new AppError('PDF export is not configured in this environment', 400, 'UNSUPPORTED_FORMAT')

    const schools = await prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { users: true, students: true, classes: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const headers = ['Tên trường', 'Mã trường', 'Email', 'SĐT', 'Địa chỉ', 'Trạng thái', 'Gói DV', 'Số users', 'Số HS', 'Số lớp', 'Ngày tạo']
    const rows = schools.map((school) => [
      school.name,
      school.code,
      school.email || '',
      school.phone || '',
      school.address || '',
      school.status === 'ACTIVE' ? 'Hoạt động' : school.status === 'SUSPENDED' ? 'Tạm ngưng' : 'Không hoạt động',
      school.plan?.name || 'Chưa có',
      school._count.users,
      school._count.students,
      school._count.classes,
      new Date(school.createdAt).toLocaleDateString('vi-VN')
    ])

    const filename = `schools_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Danh sach truong', headers, rows }])
      return
    }
    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    next(error)
  }
})

module.exports = router
