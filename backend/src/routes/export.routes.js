const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const prisma = require('../lib/prisma')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const { authenticate, authorize } = require('../middleware/auth')
const { requireFeature, requireAllFeatures, requireRolePermission } = require('../middleware/feature-flags')
const { AppError } = require('../middleware/errorHandler')
const { getUserAssignmentScope, ensureClassSubjectAccess } = require('../utils/assignment-scope')
const { academicYearLabel, resolveScoreEntryContext } = require('../utils/academic-scope')

const PDF_SECTION_KEYS = ['cover', 'filters', 'summary', 'table', 'students', 'signature']
const DEFAULT_COMMON_SECTIONS = ['cover', 'filters', 'summary', 'table', 'signature']
const PDF_COLORS = {
  text: '#111827',
  muted: '#64748B',
  headerBg: '#E2E8F0',
  stripeBg: '#F8FAFC',
  border: '#CBD5E1'
}

const PDF_FONT_REGULAR = path.join(__dirname, '../assets/fonts/NotoSans-Regular.ttf')
const PDF_FONT_BOLD = path.join(__dirname, '../assets/fonts/NotoSans-Bold.ttf')

const isExportDebugEnabled = () => process.env.EXPORT_DEBUG === '1'

const logExportDebug = (message, meta = {}) => {
  if (!isExportDebugEnabled()) return
  console.info(`[export-debug] ${message}`, meta)
}

const normalizeFormat = (format) => {
  if (!format) return 'csv'
  if (format === 'excel') return 'xlsx'
  return String(format).toLowerCase()
}

const parseCsvParam = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

const normalizeSections = (rawSections, allowed, defaults) => {
  const requested = parseCsvParam(rawSections)
  const requestedSet = new Set(requested)
  const selected = (requested.length > 0 ? requested : defaults).filter((key) => allowed.includes(key))
  if (selected.length === 0) throw new AppError('No section selected for export', 400, 'NO_EXPORT_SECTION')
  return { selected, selectedSet: requested.length > 0 ? requestedSet : new Set(selected) }
}

const normalizeColumns = (rawColumns, allColumns) => {
  const keys = parseCsvParam(rawColumns)
  const defaultColumns = allColumns.filter((column) => column.default !== false)
  if (keys.length === 0) return defaultColumns
  const allowedMap = new Map(allColumns.map((column) => [column.key, column]))
  const selected = keys.map((key) => allowedMap.get(key)).filter(Boolean)
  if (selected.length === 0) throw new AppError('No column selected for export', 400, 'NO_EXPORT_COLUMNS')
  return selected
}

const normalizePdfText = (value) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()
  return text.length > 0 ? text : '-'
}

const handleExportRouteError = (req, error, next) => {
  const isPdfRequest = normalizeFormat(req.query.format) === 'pdf'

  if (error instanceof AppError) {
    logExportDebug('route-error-app', {
      path: req.originalUrl,
      format: normalizeFormat(req.query.format),
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    })
    next(error)
    return
  }

  logExportDebug('route-error-raw', {
    path: req.originalUrl,
    format: normalizeFormat(req.query.format),
    name: error?.name,
    code: error?.code,
    message: error?.message
  })

  if (isPdfRequest) {
    next(new AppError('PDF export failed', 500, 'PDF_EXPORT_FAILED'))
    return
  }

  next(error)
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
      width: Math.max(header.length + 4, 14)
    }))
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    for (const row of sheetData.rows) {
      const record = {}
      sheetData.headers.forEach((_, index) => {
        record[`col${index}`] = row[index]
      })
      const added = sheet.addRow(record)
      if (added.number % 2 === 0) {
        added.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

const writeKVRows = (doc, rows, labelWidth) => {
  for (const row of rows) {
    doc.font('VN-Bold').fontSize(10).fillColor(PDF_COLORS.text).text(`${normalizePdfText(row.label)}:`, { continued: true, width: labelWidth })
    doc.font('VN-Regular').fontSize(10).fillColor(PDF_COLORS.text).text(` ${normalizePdfText(row.value)}`)
  }
}

const drawTable = (doc, title, headers, rows) => {
  const safeHeadersRaw = (headers || []).map((header) => normalizePdfText(header))
  const safeHeaders = safeHeadersRaw.length > 0 ? safeHeadersRaw : ['Dữ liệu']
  const safeRows = (rows || []).map((row) => (Array.isArray(row) ? row : []).map((cell) => normalizePdfText(cell)))
  const pageInnerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const left = doc.page.margins.left
  doc.moveDown(0.8)
  doc.font('VN-Bold').fillColor(PDF_COLORS.text).fontSize(12).text(normalizePdfText(title))
  doc.moveDown(0.4)

  const columnCount = Math.max(safeHeaders.length, 1)
  const bodyFontSize = columnCount > 10 ? 7 : columnCount > 7 ? 8 : 9
  const headerFontSize = bodyFontSize
  const rowPadding = 4
  const minColWidth = Math.max(24, Math.floor(pageInnerWidth / Math.max(columnCount, 14)))
  const maxColWidth = 220

  const maxWidths = safeHeaders.map((header, index) => {
    doc.font('VN-Bold').fontSize(headerFontSize)
    let width = doc.widthOfString(header) + rowPadding * 2 + 6
    const rowSample = safeRows.slice(0, 30)
    for (const row of rowSample) {
      const cell = row[index] || ''
      doc.font('VN-Regular').fontSize(bodyFontSize)
      width = Math.max(width, doc.widthOfString(cell.slice(0, 40)) + rowPadding * 2 + 6)
    }
    return Math.min(maxColWidth, Math.max(minColWidth, width))
  })
  const totalRawWidth = maxWidths.reduce((sum, width) => sum + width, 0)
  const scale = totalRawWidth > 0 ? Math.min(1, pageInnerWidth / totalRawWidth) : 1
  const columnWidths = maxWidths.map((width) => Math.max(minColWidth, width * scale))
  const normalizedScale = columnWidths.reduce((sum, width) => sum + width, 0) / pageInnerWidth
  if (normalizedScale > 1.001) {
    const ratio = pageInnerWidth / columnWidths.reduce((sum, width) => sum + width, 0)
    for (let i = 0; i < columnWidths.length; i += 1) {
      columnWidths[i] = Math.max(minColWidth, columnWidths[i] * ratio)
    }
  }
  const normalizedTotal = columnWidths.reduce((sum, width) => sum + width, 0)
  if (normalizedTotal < pageInnerWidth && columnWidths.length > 0) {
    columnWidths[columnWidths.length - 1] += pageInnerWidth - normalizedTotal
  }
  const xOffsets = []
  let cursor = left
  for (const width of columnWidths) {
    xOffsets.push(cursor)
    cursor += width
  }

  const lineGap = 1

  const drawHeader = () => {
    const startY = doc.y
    const headerHeight = Math.max(
      20,
      ...safeHeaders.map((header, index) => doc
        .font('VN-Bold')
        .fontSize(headerFontSize)
        .heightOfString(header, { width: columnWidths[index] - rowPadding * 2, lineGap })
      )
    ) + rowPadding * 2

    doc.rect(left, startY, pageInnerWidth, headerHeight).fill(PDF_COLORS.headerBg)
    safeHeaders.forEach((header, index) => {
      doc
        .fillColor(PDF_COLORS.text)
        .font('VN-Bold')
        .fontSize(headerFontSize)
        .text(header, xOffsets[index] + rowPadding, startY + rowPadding, {
          width: columnWidths[index] - rowPadding * 2,
          align: 'left'
        })
    })
    doc.fillColor(PDF_COLORS.text)
    doc.y = startY + headerHeight
  }

  const ensureSpace = (requiredHeight) => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 28
    if (doc.y + requiredHeight <= bottomLimit) return
    doc.addPage()
    drawHeader()
  }

  drawHeader()
  const tableRows = safeRows.length > 0 ? safeRows : [['Không có dữ liệu']]
  tableRows.forEach((row, rowIndex) => {
    const paddedRow = [...row]
    while (paddedRow.length < columnCount) paddedRow.push('')
    const trimmedRow = paddedRow.slice(0, columnCount)
    const cellHeights = trimmedRow.map((value, index) => doc
      .font('VN-Regular')
      .fontSize(bodyFontSize)
      .heightOfString(value, {
        width: columnWidths[index] - rowPadding * 2,
        align: 'left',
        lineGap
      }))
    const rowHeight = Math.max(16, ...cellHeights) + rowPadding * 2
    ensureSpace(rowHeight)
    const y = doc.y

    if (rowIndex % 2 === 1) {
      doc.rect(left, y, pageInnerWidth, rowHeight).fill(PDF_COLORS.stripeBg)
    }
    doc.strokeColor(PDF_COLORS.border).lineWidth(0.5).rect(left, y, pageInnerWidth, rowHeight).stroke()
    trimmedRow.forEach((value, index) => {
      const x = xOffsets[index]
      doc.strokeColor(PDF_COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + rowHeight).stroke()
      doc
        .fillColor(PDF_COLORS.text)
        .font('VN-Regular')
        .fontSize(bodyFontSize)
        .text(value, x + rowPadding, y + rowPadding, {
          width: columnWidths[index] - rowPadding * 2,
          lineGap,
          ellipsis: true
        })
    })
    doc.strokeColor(PDF_COLORS.border).lineWidth(0.5).moveTo(left + pageInnerWidth, y).lineTo(left + pageInnerWidth, y + rowHeight).stroke()
    doc.y = y + rowHeight
  })
}

const writePageFooters = (doc) => {
  if (typeof doc.bufferedPageRange !== 'function' || typeof doc.switchToPage !== 'function') {
    logExportDebug('footer-skip-buffer-unsupported')
    return
  }

  const range = doc.bufferedPageRange()
  if (!range?.count) {
    logExportDebug('footer-skip-empty-range', { range })
    return
  }

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i)
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const y = doc.page.height - doc.page.margins.bottom - 10
    doc.font('VN-Regular').fontSize(8).fillColor(PDF_COLORS.muted).text(`Trang ${i + 1}/${range.count}`, doc.page.margins.left, y, {
      width,
      align: 'right',
      lineBreak: false
    })
  }
  doc.fillColor(PDF_COLORS.text)
}

async function sendPDF(res, filename, payload) {
  try {
    const tableColumnCount = payload.table?.headers?.length || 0
    const studentsColumnCount = payload.studentsTable?.headers?.length || 0
    const maxColumnCount = Math.max(tableColumnCount, studentsColumnCount)
    const doc = new PDFDocument({
      size: 'A4',
      layout: maxColumnCount >= 8 ? 'landscape' : 'portrait',
      margins: { top: 42, right: 36, bottom: 42, left: 36 },
      bufferPages: true
    })

    const chunks = []
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      try {
        if (fs.existsSync(PDF_FONT_REGULAR) && fs.existsSync(PDF_FONT_BOLD)) {
          doc.registerFont('VN-Regular', PDF_FONT_REGULAR)
          doc.registerFont('VN-Bold', PDF_FONT_BOLD)
        } else {
          doc.registerFont('VN-Regular', 'Helvetica')
          doc.registerFont('VN-Bold', 'Helvetica-Bold')
        }

        if (payload.sections.has('cover')) {
          doc.font('VN-Bold').fillColor(PDF_COLORS.text).fontSize(18).text(normalizePdfText(payload.schoolName || 'CloudSchool'), { align: 'center' })
          doc.moveDown(0.25)
          doc.font('VN-Bold').fillColor(PDF_COLORS.text).fontSize(15).text(normalizePdfText(payload.title), { align: 'center' })
          doc.moveDown(0.25)
          doc.font('VN-Regular').fillColor(PDF_COLORS.muted).fontSize(10).text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, { align: 'center' })
        }

        if (payload.sections.has('filters') && payload.filters.length > 0) {
          doc.moveDown(1)
          doc.font('VN-Bold').fillColor(PDF_COLORS.text).fontSize(11).text('Bộ lọc áp dụng')
          doc.moveDown(0.3)
          writeKVRows(doc, payload.filters, 160)
        }

        if (payload.sections.has('summary') && payload.summary.length > 0) {
          doc.moveDown(0.8)
          doc.font('VN-Bold').fillColor(PDF_COLORS.text).fontSize(11).text('Tổng hợp')
          doc.moveDown(0.3)
          writeKVRows(doc, payload.summary, 160)
        }

        if (payload.sections.has('table') && payload.table) {
          drawTable(doc, payload.table.title, payload.table.headers, payload.table.rows)
        }

        if (payload.sections.has('students') && payload.studentsTable) {
          drawTable(doc, payload.studentsTable.title, payload.studentsTable.headers, payload.studentsTable.rows)
        }

        if (payload.sections.has('signature')) {
          const signatureBlockHeight = 84
          const limit = doc.page.height - doc.page.margins.bottom - signatureBlockHeight
          if (doc.y > limit) doc.addPage()
          doc.y = Math.max(doc.y + 16, doc.page.height - 130)
          doc.font('VN-Regular').fillColor(PDF_COLORS.text).fontSize(10).text(`Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`, { align: 'right' })
          doc.moveDown(0.2)
          doc.font('VN-Bold').fillColor(PDF_COLORS.text).fontSize(10).text('Người lập báo cáo', { align: 'right' })
          doc.moveDown(2.5)
          doc.font('VN-Regular').fillColor(PDF_COLORS.muted).fontSize(10).text('(Ký và ghi rõ họ tên)', { align: 'right' })
        }

        try {
          writePageFooters(doc)
        } catch (footerError) {
          // Keep export successful even if footer rendering fails in a specific runtime.
          logExportDebug('footer-failed-continue', {
            name: footerError?.name,
            message: footerError?.message
          })
        }
        doc.end()
      } catch (error) {
        reject(error)
      }
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(pdfBuffer.length))
    res.send(pdfBuffer)
  } catch (error) {
    console.error('PDF export failed:', error)
    logExportDebug('send-pdf-failed', {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      statusCode: error?.statusCode
    })
    throw new AppError('PDF export failed', 500, 'PDF_EXPORT_FAILED')
  }
}

const mapGenderLabel = (gender) => {
  if (gender === 'MALE') return 'Nam'
  if (gender === 'FEMALE') return 'Nữ'
  return 'Khác'
}

const getTenantDisplayName = async (req) => {
  if (req.user.role === 'PLATFORM_ADMIN') return 'CloudSchool Platform'
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { name: true }
  })
  return tenant?.name || 'CloudSchool'
}

const buildRowsFromColumns = (items, columns) => {
  const headers = columns.map((column) => column.label)
  const rows = items.map((item) => columns.map((column) => column.getValue(item)))
  return { headers, rows }
}

router.use(authenticate, requireFeature('export'), requireRolePermission('export'))

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
    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) {
      where.classId = classId ? { in: scope.classIds.filter((id) => id === classId) } : { in: scope.classIds }
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        class: { include: { grade: true } },
        tenant: { select: { name: true } }
      },
      orderBy: { fullName: 'asc' }
    })

    const columns = [
      { key: 'studentCode', label: 'Mã HS', default: true, getValue: (student) => student.studentCode },
      { key: 'fullName', label: 'Họ tên', default: true, getValue: (student) => student.fullName },
      { key: 'gender', label: 'Giới tính', default: true, getValue: (student) => mapGenderLabel(student.gender) },
      { key: 'dateOfBirth', label: 'Ngày sinh', default: true, getValue: (student) => new Date(student.dateOfBirth).toLocaleDateString('vi-VN') },
      { key: 'className', label: 'Lớp', default: true, getValue: (student) => student.class?.name || '' },
      { key: 'gradeName', label: 'Khối', default: true, getValue: (student) => student.class?.grade?.name || '' },
      { key: 'address', label: 'Địa chỉ', default: true, getValue: (student) => student.address || '' },
      { key: 'phone', label: 'SĐT', default: true, getValue: (student) => student.phone || '' },
      { key: 'parentName', label: 'Tên phụ huynh', default: true, getValue: (student) => student.parentName || '' },
      { key: 'parentPhone', label: 'SĐT PH', default: true, getValue: (student) => student.parentPhone || '' },
      { key: 'status', label: 'Trạng thái', default: true, getValue: (student) => (student.isActive ? 'Đang học' : 'Nghỉ học') }
    ]
    if (req.user.role === 'PLATFORM_ADMIN') {
      columns.push({ key: 'tenantName', label: 'Trường', default: true, getValue: (student) => student.tenant?.name || '' })
    }

    const selectedColumns = normalizeColumns(req.query.columns, columns)
    const { headers, rows } = buildRowsFromColumns(students, selectedColumns)
    const filename = `students_${new Date().toISOString().split('T')[0]}`

    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Danh sách học sinh', headers, rows }])
      return
    }

    if (format === 'pdf') {
      const sections = normalizeSections(req.query.sections, PDF_SECTION_KEYS, DEFAULT_COMMON_SECTIONS).selectedSet
      const schoolName = await getTenantDisplayName(req)
      await sendPDF(res, `${filename}.pdf`, {
        title: 'Danh sách học sinh',
        schoolName,
        sections,
        filters: [
          { label: 'Khối', value: gradeId || 'Tất cả' },
          { label: 'Lớp', value: classId || 'Tất cả' },
          { label: 'Giới tính', value: gender || 'Tất cả' },
          { label: 'Năm sinh', value: birthYear || 'Tất cả' },
          { label: 'Trạng thái', value: status || 'Tất cả' }
        ],
        summary: [{ label: 'Tổng số học sinh', value: students.length }],
        table: { title: 'Danh sách học sinh', headers, rows }
      })
      return
    }

    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    handleExportRouteError(req, error, next)
  }
})

router.get('/classes', authorize('SUPER_ADMIN', 'STAFF', 'PLATFORM_ADMIN'), requireFeature('classes'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)
    const where = {}
    if (req.user.role !== 'PLATFORM_ADMIN') where.tenantId = req.tenantId
    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) where.id = { in: scope.classIds }

    const classes = await prisma.class.findMany({
      where,
      include: {
        grade: true,
        _count: { select: { students: true } },
        tenant: { select: { name: true } }
      },
      orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }]
    })

    const columns = [
      { key: 'name', label: 'Tên lớp', default: true, getValue: (cls) => cls.name },
      { key: 'grade', label: 'Khối', default: true, getValue: (cls) => cls.grade?.name || '' },
      { key: 'academicYear', label: 'Năm học', default: true, getValue: (cls) => cls.academicYear },
      { key: 'size', label: 'Sĩ số', default: true, getValue: (cls) => cls._count.students },
      { key: 'capacity', label: 'Sức chứa', default: true, getValue: (cls) => cls.capacity },
      { key: 'status', label: 'Trạng thái', default: true, getValue: (cls) => (cls.isActive ? 'Hoạt động' : 'Không hoạt động') }
    ]
    if (req.user.role === 'PLATFORM_ADMIN') {
      columns.push({ key: 'tenantName', label: 'Trường', default: true, getValue: (cls) => cls.tenant?.name || '' })
    }

    const selectedColumns = normalizeColumns(req.query.columns, columns)
    const { headers, rows } = buildRowsFromColumns(classes, selectedColumns)
    const filename = `classes_${new Date().toISOString().split('T')[0]}`

    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Danh sách lớp', headers, rows }])
      return
    }

    if (format === 'pdf') {
      const sections = normalizeSections(req.query.sections, PDF_SECTION_KEYS, DEFAULT_COMMON_SECTIONS).selectedSet
      const schoolName = await getTenantDisplayName(req)
      await sendPDF(res, `${filename}.pdf`, {
        title: 'Danh sách lớp',
        schoolName,
        sections,
        filters: [{ label: 'Phạm vi', value: req.user.role === 'PLATFORM_ADMIN' ? 'Toàn hệ thống' : 'Trường hiện tại' }],
        summary: [
          { label: 'Tổng số lớp', value: classes.length },
          { label: 'Tổng sĩ số', value: classes.reduce((total, cls) => total + cls._count.students, 0) }
        ],
        table: { title: 'Danh sách lớp', headers, rows }
      })
      return
    }

    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    handleExportRouteError(req, error, next)
  }
})

router.get('/scores', authorize('SUPER_ADMIN', 'STAFF', 'TEACHER', 'PLATFORM_ADMIN'), requireFeature('scores'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)
    const { classId, subjectId, semesterId } = req.query
    if (!classId || !subjectId || !semesterId) {
      throw new AppError('classId, subjectId, and semesterId are required', 400, 'MISSING_PARAMS')
    }

    await ensureClassSubjectAccess(prisma, req, classId, subjectId)

    const scoreContext = await resolveScoreEntryContext(prisma, req.tenantId, { classId, subjectId, semesterId })
    const scoreComponents = scoreContext.components

    const students = await prisma.student.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true,
        enrollments: { some: { classId, semesterId, tenantId: req.tenantId } }
      },
      orderBy: { fullName: 'asc' }
    })

    const fallbackStudents = students.length ? students : await prisma.student.findMany({
      where: { classId, tenantId: req.tenantId, isActive: true },
      orderBy: { fullName: 'asc' }
    })

    const allScores = fallbackStudents.length
      ? await prisma.score.findMany({
          where: {
            studentId: { in: fallbackStudents.map((student) => student.id) },
            subjectId,
            semesterId,
            tenantId: req.tenantId
          }
        })
      : []

    const scoresByStudent = {}
    for (const score of allScores) {
      if (!scoresByStudent[score.studentId]) scoresByStudent[score.studentId] = []
      scoresByStudent[score.studentId].push(score)
    }

    const rowModels = fallbackStudents.map((student, index) => {
      const scores = scoresByStudent[student.id] || []
      let weightedSum = 0
      let totalWeight = 0
      const componentValues = {}
      for (const component of scoreComponents) {
        const score = scores.find((item) => item.scoreComponentId === component.id)
        if (!score) {
          componentValues[component.id] = ''
          continue
        }
        weightedSum += score.value * component.weight
        totalWeight += component.weight
        componentValues[component.id] = score.value
      }
      return {
        index: index + 1,
        studentCode: student.studentCode,
        fullName: student.fullName,
        componentValues,
        average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : ''
      }
    })

    const columns = [
      { key: 'index', label: 'STT', default: true, getValue: (item) => item.index },
      { key: 'studentCode', label: 'Mã HS', default: true, getValue: (item) => item.studentCode },
      { key: 'fullName', label: 'Họ tên', default: true, getValue: (item) => item.fullName },
      ...scoreComponents.map((component) => ({
        key: `component_${component.id}`,
        label: `${component.name} (${component.weight}%)`,
        default: true,
        getValue: (item) => item.componentValues[component.id]
      })),
      { key: 'average', label: 'ĐTB', default: true, getValue: (item) => item.average }
    ]

    const selectedColumns = normalizeColumns(req.query.columns, columns)
    const { headers, rows } = buildRowsFromColumns(rowModels, selectedColumns)
    const filename = `scores_${new Date().toISOString().split('T')[0]}`

    const [classInfoForExport, subjectInfoForExport, semesterInfoForExport] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, include: { grade: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.tenantId }, select: { name: true } }),
      prisma.semester.findFirst({ where: { id: semesterId, tenantId: req.tenantId }, select: { name: true, year: true } })
    ])

    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Bảng điểm', headers, rows }])
      return
    }

    if (format === 'pdf') {
      const sections = normalizeSections(req.query.sections, PDF_SECTION_KEYS, DEFAULT_COMMON_SECTIONS).selectedSet
      const schoolName = await getTenantDisplayName(req)
      await sendPDF(res, `${filename}.pdf`, {
        title: 'Bảng điểm môn học',
        schoolName,
        sections,
        filters: [
          { label: 'Lớp', value: classInfoForExport?.name || classId },
          { label: 'Khối', value: classInfoForExport?.grade?.name || '' },
          { label: 'Môn', value: subjectInfoForExport?.name || subjectId },
          { label: 'Học kỳ', value: semesterInfoForExport ? `${semesterInfoForExport.name} (${semesterInfoForExport.year || ''})` : semesterId }
        ],
        summary: [{ label: 'Số học sinh', value: fallbackStudents.length }],
        table: { title: 'Bảng điểm chi tiết', headers, rows }
      })
      return
    }

    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    handleExportRouteError(req, error, next)
  }
})

router.get('/reports/:type', authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireAllFeatures(['reports']), async (req, res, next) => {
  try {
    const type = req.params.type
    const format = normalizeFormat(req.query.format)
    const sectionDefaults = type === 'class-promotion-summary'
      ? ['cover', 'filters', 'summary', 'table', 'students', 'signature']
      : DEFAULT_COMMON_SECTIONS
    const sections = normalizeSections(req.query.sections, PDF_SECTION_KEYS, sectionDefaults).selectedSet

    let reportTitle = ''
    let summaryRows = []
    let tableTitle = 'Bảng dữ liệu'
    let tableRows = []
    let tableColumns = []
    let studentsTable = null
    const filters = []

    if (type === 'class-promotion-summary') {
      reportTitle = 'BM2 - Tỷ lệ lên lớp theo lớp'
      const { classId, semesterId } = req.query
      if (!classId || !semesterId) throw new AppError('classId and semesterId are required', 400, 'MISSING_PARAMS')
      filters.push({ label: 'Lớp', value: classId }, { label: 'Học kỳ', value: semesterId })

      const classInfo = await prisma.class.findFirst({ where: { id: classId, tenantId: req.tenantId }, include: { grade: true } })
      const promotions = await prisma.promotion.findMany({
        where: { tenantId: req.tenantId, classId, semesterId },
        include: { student: { select: { studentCode: true, fullName: true } } },
        orderBy: { student: { fullName: 'asc' } }
      })
      const passCount = promotions.filter((item) => item.result === 'PASS').length
      summaryRows = [
        { label: 'Lớp', value: classInfo?.name || '' },
        { label: 'Khối', value: classInfo?.grade?.name || '' },
        { label: 'Sĩ số xét', value: promotions.length },
        { label: 'Số lên lớp', value: passCount },
        { label: 'Tỷ lệ lên lớp', value: promotions.length > 0 ? `${Math.round((passCount / promotions.length) * 10000) / 100}%` : '0%' }
      ]
      tableTitle = 'Tổng hợp kết quả'
      tableRows = [{
        className: classInfo?.name || '',
        gradeName: classInfo?.grade?.name || '',
        total: promotions.length,
        pass: passCount,
        rate: promotions.length > 0 ? `${Math.round((passCount / promotions.length) * 10000) / 100}%` : '0%'
      }]
      tableColumns = [
        { key: 'className', label: 'Lớp', default: true, getValue: (row) => row.className },
        { key: 'gradeName', label: 'Khối', default: true, getValue: (row) => row.gradeName },
        { key: 'total', label: 'Sĩ số xét', default: true, getValue: (row) => row.total },
        { key: 'pass', label: 'Số lên lớp', default: true, getValue: (row) => row.pass },
        { key: 'rate', label: 'Tỷ lệ lên lớp', default: true, getValue: (row) => row.rate }
      ]
      studentsTable = {
        title: 'Danh sách học sinh',
        headers: ['Mã HS', 'Họ tên', 'Điểm TB', 'Kết quả'],
        rows: promotions.map((item) => [item.student.studentCode, item.student.fullName, item.average, item.result === 'PASS' ? 'Lên lớp' : 'Không lên lớp'])
      }
    } else if (type === 'semester-promotion-summary') {
      reportTitle = 'BM3 - Tỷ lệ lên lớp theo học kỳ'
      const { semesterId } = req.query
      if (!semesterId) throw new AppError('semesterId is required', 400, 'MISSING_PARAMS')
      filters.push({ label: 'Học kỳ', value: semesterId })

      const promotions = await prisma.promotion.findMany({
        where: { tenantId: req.tenantId, semesterId },
        include: { class: { include: { grade: true } } }
      })
      const grouped = new Map()
      for (const item of promotions) {
        if (!grouped.has(item.classId)) grouped.set(item.classId, { className: item.class.name, gradeName: item.class.grade.name, total: 0, pass: 0 })
        const bucket = grouped.get(item.classId)
        bucket.total += 1
        if (item.result === 'PASS') bucket.pass += 1
      }
      tableRows = [...grouped.values()].map((item) => ({
        className: item.className,
        gradeName: item.gradeName,
        total: item.total,
        pass: item.pass,
        rate: item.total > 0 ? `${Math.round((item.pass / item.total) * 10000) / 100}%` : '0%'
      }))
      summaryRows = [
        { label: 'Số lớp', value: tableRows.length },
        { label: 'Tổng lượt xét', value: tableRows.reduce((total, item) => total + item.total, 0) }
      ]
      tableTitle = 'Kết quả theo lớp'
      tableColumns = [
        { key: 'className', label: 'Lớp', default: true, getValue: (row) => row.className },
        { key: 'gradeName', label: 'Khối', default: true, getValue: (row) => row.gradeName },
        { key: 'total', label: 'Sĩ số xét', default: true, getValue: (row) => row.total },
        { key: 'pass', label: 'Số lên lớp', default: true, getValue: (row) => row.pass },
        { key: 'rate', label: 'Tỷ lệ lên lớp', default: true, getValue: (row) => row.rate }
      ]
    } else if (type === 'year-promotion-summary') {
      reportTitle = 'BM4 - Tỷ lệ lên lớp theo năm học'
      const { academicYearId } = req.query
      if (!academicYearId) throw new AppError('academicYearId is required', 400, 'MISSING_PARAMS')
      filters.push({ label: 'Năm học', value: academicYearId })

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
        if (!item.class?.grade?.id) continue  // skip orphaned records
        if (!grouped.has(item.class.gradeId)) grouped.set(item.class.gradeId, { gradeName: item.class.grade.name, gradeLevel: item.class.grade.level, total: 0, pass: 0 })
        const bucket = grouped.get(item.class.gradeId)
        bucket.total += 1
        if (item.result === 'PASS') bucket.pass += 1
      }
      tableRows = [...grouped.values()].sort((a, b) => a.gradeLevel - b.gradeLevel).map((item) => ({
        gradeName: item.gradeName,
        total: item.total,
        pass: item.pass,
        rate: item.total > 0 ? `${Math.round((item.pass / item.total) * 10000) / 100}%` : '0%'
      }))
      summaryRows = [
        { label: 'Số khối', value: tableRows.length },
        { label: 'Tổng lượt xét', value: tableRows.reduce((total, item) => total + item.total, 0) }
      ]
      tableTitle = 'Kết quả theo khối'
      tableColumns = [
        { key: 'gradeName', label: 'Khối', default: true, getValue: (row) => row.gradeName },
        { key: 'total', label: 'Sĩ số xét', default: true, getValue: (row) => row.total },
        { key: 'pass', label: 'Số lên lớp', default: true, getValue: (row) => row.pass },
        { key: 'rate', label: 'Tỷ lệ lên lớp', default: true, getValue: (row) => row.rate }
      ]
    } else if (type === 'subject-summary') {
      reportTitle = 'BM1 - Tổng kết môn học'
      const { subjectId, semesterId } = req.query
      if (!subjectId || !semesterId) throw new AppError('subjectId and semesterId are required', 400, 'MISSING_PARAMS')
      filters.push({ label: 'Môn học', value: subjectId }, { label: 'Học kỳ', value: semesterId })

      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
      const semester = await prisma.semester.findFirst({
        where: { id: semesterId, tenantId: req.tenantId },
        include: { academicYear: true }
      })
      if (!semester) throw new AppError('Semester not found', 404, 'NOT_FOUND')
      const classYearFilter = semester.academicYearId
        ? { academicYearId: semester.academicYearId }
        : semester.academicYear
          ? { academicYear: academicYearLabel(semester.academicYear) }
          : {}
      const classes = await prisma.class.findMany({
        where: { tenantId: req.tenantId, isActive: true, ...classYearFilter },
        include: { students: { where: { isActive: true } }, grade: true }
      })
      const classIds = classes.map((cls) => cls.id)
      const enrollments = classIds.length
        ? await prisma.classEnrollment.findMany({
            where: { tenantId: req.tenantId, semesterId, classId: { in: classIds }, student: { isActive: true } },
            select: { classId: true, studentId: true }
          })
        : []
      const enrollmentClassIds = new Set(enrollments.map((item) => item.classId))
      const studentIdsByClass = new Map(classes.map((cls) => [
        cls.id,
        enrollmentClassIds.has(cls.id)
          ? enrollments.filter((item) => item.classId === cls.id).map((item) => item.studentId)
          : cls.students.map((student) => student.id)
      ]))
      const allStudentIds = [...new Set(Array.from(studentIdsByClass.values()).flat())]
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

      tableRows = classes.map((cls) => {
        const studentIds = studentIdsByClass.get(cls.id) || []
        let pass = 0
        for (const studentId of studentIds) {
          const values = scoreMap.get(studentId) || []
          let weightedSum = 0
          let totalWeight = 0
          for (const value of values) {
            if (!value.scoreComponent || value.scoreComponent.isActive === false) continue
            weightedSum += value.value * value.scoreComponent.weight
            totalWeight += value.scoreComponent.weight
          }
          if (totalWeight <= 0) continue
          const average = weightedSum / totalWeight
          if (average >= settings.passScore) pass += 1
        }
        return {
          className: cls.name,
          gradeName: cls.grade?.name || '',
          total: studentIds.length,
          pass,
          rate: studentIds.length > 0 ? `${Math.round((pass / studentIds.length) * 10000) / 100}%` : '0%'
        }
      })
      summaryRows = [
        { label: 'Số lớp', value: tableRows.length },
        { label: 'Tổng sĩ số', value: tableRows.reduce((total, item) => total + item.total, 0) }
      ]
      tableTitle = 'Kết quả theo lớp'
      tableColumns = [
        { key: 'className', label: 'Lớp', default: true, getValue: (row) => row.className },
        { key: 'gradeName', label: 'Khối', default: true, getValue: (row) => row.gradeName },
        { key: 'total', label: 'Sĩ số', default: true, getValue: (row) => row.total },
        { key: 'pass', label: 'Số đạt', default: true, getValue: (row) => row.pass },
        { key: 'rate', label: 'Tỷ lệ đạt', default: true, getValue: (row) => row.rate }
      ]
    } else {
      throw new AppError('Unsupported report type', 400, 'UNSUPPORTED_REPORT_TYPE')
    }

    const selectedColumns = normalizeColumns(req.query.columns, tableColumns)
    const tableData = buildRowsFromColumns(tableRows, selectedColumns)
    const filename = `report_${type}_${new Date().toISOString().split('T')[0]}`

    if (format === 'xlsx') {
      const sheets = [{ name: tableTitle, headers: tableData.headers, rows: tableData.rows }]
      if (sections.has('students') && studentsTable) sheets.push({ name: studentsTable.title, headers: studentsTable.headers, rows: studentsTable.rows })
      await sendExcel(res, `${filename}.xlsx`, sheets)
      return
    }

    if (format === 'pdf') {
      const schoolName = await getTenantDisplayName(req)
      await sendPDF(res, `${filename}.pdf`, {
        title: reportTitle,
        schoolName,
        sections,
        filters,
        summary: summaryRows,
        table: { title: tableTitle, headers: tableData.headers, rows: tableData.rows },
        studentsTable: sections.has('students') ? studentsTable : null
      })
      return
    }

    sendCSV(res, `${filename}.csv`, tableData.headers, tableData.rows)
  } catch (error) {
    handleExportRouteError(req, error, next)
  }
})

router.get('/schools', authorize('PLATFORM_ADMIN'), async (req, res, next) => {
  try {
    const format = normalizeFormat(req.query.format)
    const schools = await prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { users: true, students: true, classes: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const columns = [
      { key: 'name', label: 'Tên trường', default: true, getValue: (school) => school.name },
      { key: 'code', label: 'Mã trường', default: true, getValue: (school) => school.code },
      { key: 'email', label: 'Email', default: true, getValue: (school) => school.email || '' },
      { key: 'phone', label: 'SĐT', default: true, getValue: (school) => school.phone || '' },
      { key: 'address', label: 'Địa chỉ', default: true, getValue: (school) => school.address || '' },
      { key: 'status', label: 'Trạng thái', default: true, getValue: (school) => (school.status === 'ACTIVE' ? 'Hoạt động' : school.status === 'SUSPENDED' ? 'Tạm ngưng' : 'Không hoạt động') },
      { key: 'plan', label: 'Gói DV', default: true, getValue: (school) => school.plan?.name || 'Chưa có' },
      { key: 'users', label: 'Số users', default: true, getValue: (school) => school._count.users },
      { key: 'students', label: 'Số HS', default: true, getValue: (school) => school._count.students },
      { key: 'classes', label: 'Số lớp', default: true, getValue: (school) => school._count.classes },
      { key: 'createdAt', label: 'Ngày tạo', default: true, getValue: (school) => new Date(school.createdAt).toLocaleDateString('vi-VN') }
    ]

    const selectedColumns = normalizeColumns(req.query.columns, columns)
    const { headers, rows } = buildRowsFromColumns(schools, selectedColumns)
    const filename = `schools_${new Date().toISOString().split('T')[0]}`

    if (format === 'xlsx') {
      await sendExcel(res, `${filename}.xlsx`, [{ name: 'Danh sách trường', headers, rows }])
      return
    }
    if (format === 'pdf') {
      const sections = normalizeSections(req.query.sections, PDF_SECTION_KEYS, DEFAULT_COMMON_SECTIONS).selectedSet
      await sendPDF(res, `${filename}.pdf`, {
        title: 'Danh sách trường',
        schoolName: 'CloudSchool Platform',
        sections,
        filters: [{ label: 'Phạm vi', value: 'Toàn hệ thống' }],
        summary: [{ label: 'Tổng số trường', value: schools.length }],
        table: { title: 'Danh sách trường', headers, rows }
      })
      return
    }
    sendCSV(res, `${filename}.csv`, headers, rows)
  } catch (error) {
    handleExportRouteError(req, error, next)
  }
})

module.exports = router
