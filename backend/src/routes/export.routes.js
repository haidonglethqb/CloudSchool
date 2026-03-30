const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')
const ExcelJS = require('exceljs')

// All export routes require authentication
router.use(authenticate)

// Helper: send CSV response
function sendCSV(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  // BOM for Excel UTF-8 compatibility
  let csv = '\uFEFF'
  csv += headers.join(',') + '\n'
  for (const row of rows) {
    csv += row.map(cell => {
      const val = cell === null || cell === undefined ? '' : String(cell)
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }).join(',') + '\n'
  }
  res.send(csv)
}

// Helper: send Excel response
async function sendExcel(res, filename, sheetName, headers, rows) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: `col${i}`,
    width: Math.max(h.length + 5, 15)
  }))

  // Style header row
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const row of rows) {
    const obj = {}
    headers.forEach((_, i) => { obj[`col${i}`] = row[i] })
    sheet.addRow(obj)
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

// ==================== STUDENT EXPORT ====================
// GET /export/students?format=csv|xlsx&classId=xxx
router.get('/students', authorize('SUPER_ADMIN', 'STAFF', 'PLATFORM_ADMIN'), async (req, res, next) => {
  try {
    const { format = 'csv', classId } = req.query

    const where = {}
    // Tenant isolation
    if (req.user.role !== 'PLATFORM_ADMIN') {
      where.tenantId = req.tenantId
    }
    if (classId) where.classId = classId

    const students = await prisma.student.findMany({
      where,
      include: {
        class: { include: { grade: true } },
        tenant: { select: { name: true, code: true } }
      },
      orderBy: { fullName: 'asc' }
    })

    const headers = ['Mã HS', 'Họ tên', 'Giới tính', 'Ngày sinh', 'Lớp', 'Khối', 'Địa chỉ', 'SĐT', 'Tên phụ huynh', 'SĐT PH', 'Trạng thái']
    if (req.user.role === 'PLATFORM_ADMIN') headers.push('Trường')

    const rows = students.map(s => {
      const row = [
        s.studentCode,
        s.fullName,
        s.gender === 'MALE' ? 'Nam' : s.gender === 'FEMALE' ? 'Nữ' : 'Khác',
        new Date(s.dateOfBirth).toLocaleDateString('vi-VN'),
        s.class?.name || '',
        s.class?.grade?.name || '',
        s.address || '',
        s.phone || '',
        s.parentName || '',
        s.parentPhone || '',
        s.isActive ? 'Đang học' : 'Nghỉ học'
      ]
      if (req.user.role === 'PLATFORM_ADMIN') row.push(s.tenant?.name || '')
      return row
    })

    const filename = `students_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, 'Danh sách học sinh', headers, rows)
    } else {
      sendCSV(res, `${filename}.csv`, headers, rows)
    }
  } catch (error) {
    next(error)
  }
})

// ==================== CLASS EXPORT ====================
// GET /export/classes?format=csv|xlsx
router.get('/classes', authorize('SUPER_ADMIN', 'STAFF', 'PLATFORM_ADMIN'), async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query

    const where = {}
    if (req.user.role !== 'PLATFORM_ADMIN') {
      where.tenantId = req.tenantId
    }

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

    const rows = classes.map(c => {
      const row = [
        c.name,
        c.grade?.name || '',
        c.academicYear,
        c._count.students,
        c.capacity,
        c.isActive ? 'Hoạt động' : 'Không hoạt động'
      ]
      if (req.user.role === 'PLATFORM_ADMIN') row.push(c.tenant?.name || '')
      return row
    })

    const filename = `classes_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, 'Danh sách lớp', headers, rows)
    } else {
      sendCSV(res, `${filename}.csv`, headers, rows)
    }
  } catch (error) {
    next(error)
  }
})

// ==================== SCORE EXPORT ====================
// GET /export/scores?format=csv|xlsx&classId=xxx&subjectId=xxx&semesterId=xxx
router.get('/scores', authorize('SUPER_ADMIN', 'STAFF', 'PLATFORM_ADMIN'), async (req, res, next) => {
  try {
    const { format = 'csv', classId, subjectId, semesterId } = req.query

    if (!classId || !subjectId || !semesterId) {
      throw new AppError('classId, subjectId, and semesterId are required', 400, 'MISSING_PARAMS')
    }

    const students = await prisma.student.findMany({
      where: { classId, tenantId: req.tenantId, isActive: true },
      orderBy: { fullName: 'asc' }
    })

    const scoreComponents = await prisma.scoreComponent.findMany({
      where: { subjectId, tenantId: req.tenantId },
      orderBy: { weight: 'desc' }
    })

    const [classInfo, subject, semester] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, include: { grade: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId } })
    ])

    const headers = ['STT', 'Mã HS', 'Họ tên', ...scoreComponents.map(sc => `${sc.name} (${sc.weight}%)`), 'ĐTB']

    // Batch fetch all scores for this class/subject/semester to avoid N+1
    const allScores = await prisma.score.findMany({
      where: {
        studentId: { in: students.map(s => s.id) },
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

    const rows = students.map((student, idx) => {
      const scores = scoresByStudent[student.id] || []

      let weightedSum = 0
      let totalWeight = 0
      const scoreValues = scoreComponents.map(sc => {
        const score = scores.find(s => s.scoreComponentId === sc.id)
        if (score) {
          weightedSum += score.value * sc.weight
          totalWeight += sc.weight
        }
        return score ? score.value : ''
      })

      const avg = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : ''

      return [idx + 1, student.studentCode, student.fullName, ...scoreValues, avg]
    })

    const filename = `scores_${classInfo?.name || 'class'}_${subject?.name || 'subject'}_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, `Điểm ${classInfo?.name} - ${subject?.name}`, headers, rows)
    } else {
      sendCSV(res, `${filename}.csv`, headers, rows)
    }
  } catch (error) {
    next(error)
  }
})

// ==================== SCHOOLS EXPORT (PLATFORM ADMIN) ====================
// GET /export/schools?format=csv|xlsx
router.get('/schools', authorize('PLATFORM_ADMIN'), async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query

    const schools = await prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { users: true, students: true, classes: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const headers = ['Tên trường', 'Mã trường', 'Email', 'SĐT', 'Địa chỉ', 'Trạng thái', 'Gói DV', 'Số users', 'Số HS', 'Số lớp', 'Ngày tạo']
    const rows = schools.map(s => [
      s.name,
      s.code,
      s.email || '',
      s.phone || '',
      s.address || '',
      s.status === 'ACTIVE' ? 'Hoạt động' : s.status === 'SUSPENDED' ? 'Tạm ngưng' : 'Không hoạt động',
      s.plan?.name || 'Chưa có',
      s._count.users,
      s._count.students,
      s._count.classes,
      new Date(s.createdAt).toLocaleDateString('vi-VN')
    ])

    const filename = `schools_${new Date().toISOString().split('T')[0]}`
    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, 'Danh sách trường', headers, rows)
    } else {
      sendCSV(res, `${filename}.csv`, headers, rows)
    }
  } catch (error) {
    next(error)
  }
})

module.exports = router
