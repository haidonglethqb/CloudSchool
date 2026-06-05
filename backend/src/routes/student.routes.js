const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const ExcelJS = require('exceljs')
const prisma = require('../lib/prisma')
const { authenticate, authorize } = require('../middleware/auth')
const { AppError } = require('../middleware/errorHandler')
const { requireFeature, requireRolePermission } = require('../middleware/feature-flags')
const { getTenantPlanUsage, getTenantPlanLimits } = require('../utils/subscription-limits')
const { getUserAssignmentScope, ensureClassAccess } = require('../utils/assignment-scope')
const { academicYearLabel } = require('../utils/academic-scope')

const REQUIRED_IMPORT_HEADERS = ['fullName', 'gender', 'dateOfBirth', 'address']
const IMPORT_TEMPLATE_HEADERS = REQUIRED_IMPORT_HEADERS.join(',')
const IMPORT_TEMPLATE_SAMPLE = 'Nguyễn Văn A,Nam,2010-08-15,"88 Võ Văn Tần, Quận 3, TP.HCM"'

// Generate student code
const generateStudentCode = async (tenantId, tx) => {
  const client = tx || prisma
  const count = await client.student.count({ where: { tenantId } })
  const year = new Date().getFullYear().toString().slice(-2)
  return `HS${year}${String(count + 1).padStart(4, '0')}`
}

const normalizeText = (value) => String(value || '').trim()

const normalizeHeader = (value) => normalizeText(value).replace(/^\uFEFF/, '')

const normalizeGender = (value) => {
  const raw = normalizeText(value).toUpperCase()
  const withoutMarks = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (['MALE', 'NAM'].includes(withoutMarks)) return 'MALE'
  if (['FEMALE', 'NU'].includes(withoutMarks)) return 'FEMALE'
  if (['OTHER', 'KHAC'].includes(withoutMarks)) return 'OTHER'
  return null
}

const parseDateValue = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const text = normalizeText(value)
  const iso = new Date(text)
  if (!Number.isNaN(iso.getTime())) return iso

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

const toDateKey = (date) => {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

const calculateAge = (dateOfBirth, referenceDate = new Date()) => {
  const birth = new Date(dateOfBirth)
  let age = referenceDate.getFullYear() - birth.getFullYear()
  const monthDelta = referenceDate.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && referenceDate.getDate() < birth.getDate())) age--
  return age
}

const getCellText = (cellValue) => {
  if (cellValue === null || cellValue === undefined) return ''
  if (cellValue instanceof Date) return cellValue
  if (typeof cellValue === 'object') {
    if (cellValue.text) return cellValue.text
    if (cellValue.result) return cellValue.result
    if (Array.isArray(cellValue.richText)) return cellValue.richText.map((item) => item.text || '').join('')
  }
  return cellValue
}

const parseCsvLine = (line) => {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

const parseCsvRows = (buffer) => {
  const content = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = content.split('\n').filter((line) => line.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line)
    const row = { rowNumber: index + 2 }
    headers.forEach((header, cellIndex) => {
      row[header] = normalizeText(cells[cellIndex])
    })
    return row
  })
}

const parseXlsxRows = async (buffer) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []
  const headers = []
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeHeader(getCellText(cell.value))
  })
  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const parsed = { rowNumber }
    let hasValue = false
    headers.forEach((header, colNumber) => {
      if (!header) return
      const value = getCellText(row.getCell(colNumber).value)
      parsed[header] = value
      if (normalizeText(value)) hasValue = true
    })
    if (hasValue) rows.push(parsed)
  })
  return rows
}

const validateImportRows = async (tenantId, rawRows) => {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } })
  if (!settings) throw new AppError('Tenant settings not configured', 404, 'SETTINGS_NOT_FOUND')

  const existingStudents = await prisma.student.findMany({
    where: { tenantId },
    select: { fullName: true, dateOfBirth: true }
  })
  const duplicateSet = new Set(existingStudents.map((student) => `${normalizeText(student.fullName).toLowerCase()}::${toDateKey(student.dateOfBirth)}`))
  const seenInFile = new Set()

  return rawRows.map((row) => {
    const fullName = normalizeText(row.fullName)
    const gender = normalizeGender(row.gender)
    const dateOfBirth = parseDateValue(row.dateOfBirth)
    const address = normalizeText(row.address)
    const errors = []

    if (!fullName) errors.push('Thiếu tên học sinh')
    if (!gender) errors.push('Giới tính không hợp lệ')
    if (!dateOfBirth) errors.push('Ngày sinh không hợp lệ')
    if (!address) errors.push('Thiếu địa chỉ')

    if (dateOfBirth) {
      const age = calculateAge(dateOfBirth)
      if (age < settings.minAge || age > settings.maxAge) {
        errors.push(`Tuổi (${age}) không nằm trong khoảng ${settings.minAge}-${settings.maxAge}`)
      }
    }

    if (fullName && dateOfBirth) {
      const duplicateKey = `${fullName.toLowerCase()}::${toDateKey(dateOfBirth)}`
      if (seenInFile.has(duplicateKey)) {
        errors.push('Trung hoc sinh trong file import')
      }
      seenInFile.add(duplicateKey)
    }

    if (fullName && dateOfBirth && duplicateSet.has(`${fullName.toLowerCase()}::${toDateKey(dateOfBirth)}`)) {
      errors.push('Trùng học sinh theo tên và ngày sinh')
    }

    return {
      tenantId,
      rowNumber: row.rowNumber,
      fullName: fullName || null,
      gender,
      dateOfBirth,
      address: address || null,
      status: errors.length > 0 ? 'INVALID' : 'VALID',
      errorMessage: errors.length > 0 ? errors.join('; ') : null
    }
  })
}

const refreshImportBatchStats = async (batchId, tx = prisma) => {
  const [totalRows, validRows, invalidRows, createdRows] = await Promise.all([
    tx.studentImportRow.count({ where: { batchId } }),
    tx.studentImportRow.count({ where: { batchId, status: 'VALID' } }),
    tx.studentImportRow.count({ where: { batchId, status: 'INVALID' } }),
    tx.studentImportRow.count({ where: { batchId, status: 'IMPORTED' } })
  ])

  const status = createdRows > 0
    ? (invalidRows > 0 || validRows > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED')
    : 'DRAFT'

  return tx.studentImportBatch.update({
    where: { id: batchId },
    data: { totalRows, validRows, invalidRows, createdRows, status }
  })
}

const validateSingleImportRow = async (tenantId, batchId, rowId, input, tx = prisma) => {
  const settings = await tx.tenantSettings.findUnique({ where: { tenantId } })
  if (!settings) throw new AppError('Tenant settings not configured', 404, 'SETTINGS_NOT_FOUND')

  const fullName = normalizeText(input.fullName)
  const gender = normalizeGender(input.gender)
  const dateOfBirth = parseDateValue(input.dateOfBirth)
  const address = normalizeText(input.address)
  const classId = normalizeText(input.classId)
  const errors = []

  if (!fullName) errors.push('Thiáº¿u tÃªn há»c sinh')
  if (!gender) errors.push('Giá»›i tÃ­nh khÃ´ng há»£p lá»‡')
  if (!dateOfBirth) errors.push('NgÃ y sinh khÃ´ng há»£p lá»‡')
  if (!address) errors.push('Thiáº¿u Ä‘á»‹a chá»‰')

  if (dateOfBirth) {
    const age = calculateAge(dateOfBirth)
    if (age < settings.minAge || age > settings.maxAge) {
      errors.push(`Tuá»•i (${age}) khÃ´ng náº±m trong khoáº£ng ${settings.minAge}-${settings.maxAge}`)
    }
  }

  if (fullName && dateOfBirth) {
    const existingStudent = await tx.student.findFirst({
      where: {
        tenantId,
        fullName: { equals: fullName, mode: 'insensitive' },
        dateOfBirth
      },
      select: { id: true }
    })
    if (existingStudent) errors.push('TrÃ¹ng há»c sinh theo tÃªn vÃ  ngÃ y sinh')

    const duplicateRow = await tx.studentImportRow.findFirst({
      where: {
        tenantId,
        batchId,
        id: { not: rowId },
        fullName: { equals: fullName, mode: 'insensitive' },
        dateOfBirth,
        status: { not: 'IMPORTED' }
      },
      select: { id: true }
    })
    if (duplicateRow) errors.push('TrÃ¹ng há»c sinh trong file import')
  }

  if (classId) {
    const activeSemester = await getActiveSemesterContext(tenantId, tx)
    const cls = await tx.class.findFirst({ where: { id: classId, tenantId } })
    if (!cls) {
      errors.push('Lá»›p khÃ´ng tá»“n táº¡i')
    } else {
      const activeYearLabel = activeSemester.academicYear ? academicYearLabel(activeSemester.academicYear) : null
      const classInActiveYear = cls.academicYearId === activeSemester.academicYearId
        || (activeYearLabel && cls.academicYear === activeYearLabel)
      if (!classInActiveYear) {
        errors.push('Lá»›p nháº­p há»c pháº£i thuá»™c nÄƒm há»c cá»§a há»c ká»³ Ä‘ang hoáº¡t Ä‘á»™ng')
      }
    }
  }

  return {
    fullName: fullName || null,
    gender,
    dateOfBirth,
    address: address || null,
    classId: classId || null,
    status: errors.length > 0 ? 'INVALID' : 'VALID',
    errorMessage: errors.length > 0 ? errors.join('; ') : null
  }
}

const getActiveSemesterContext = async (tenantId, tx = prisma) => {
  const activeSemester = await tx.semester.findFirst({
    where: { tenantId, isActive: true, academicYearId: { not: null } },
    include: { academicYear: true },
    orderBy: [{ updatedAt: 'desc' }, { semesterNum: 'asc' }]
  })
  if (!activeSemester) throw new AppError('No active semester found', 400, 'NO_ACTIVE_SEMESTER')
  return activeSemester
}

// GET /students
router.get('/', authenticate, requireFeature('student-lookup'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('student-lookup'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, classId, gradeId, status, address, gender, birthYear } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentCode: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(classId && { classId }),
      ...(gradeId && { class: { gradeId } }),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'inactive' && { isActive: false }),
      ...(address && { address: { contains: String(address), mode: 'insensitive' } }),
      ...(gender && { gender: String(gender) }),
      ...(birthYear && Number.isInteger(Number(birthYear)) && {
        dateOfBirth: {
          gte: new Date(`${birthYear}-01-01T00:00:00.000Z`),
          lte: new Date(`${birthYear}-12-31T23:59:59.999Z`)
        }
      })
    }

    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) {
      if (classId) {
        where.classId = { in: scope.classIds.filter((id) => id === classId) }
      } else {
        where.classId = { in: scope.classIds }
      }
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { class: { include: { grade: true } } },
        orderBy: { fullName: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.student.count({ where })
    ])

    res.json({
      data: students,
      meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    })
  } catch (error) {
    next(error)
  }
})

// GET /students/transfers/history - all transfer history for current tenant
router.get('/transfers/history', authenticate, requireFeature('class-transfer'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('class-transfer'), async (req, res, next) => {
  try {
    const history = await prisma.transferHistory.findMany({
      where: { tenantId: req.tenantId },
      include: {
        student: { select: { id: true, studentCode: true, fullName: true } },
        fromClass: { include: { grade: true } },
        toClass: { include: { grade: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const userIds = [...new Set(history.map((item) => item.transferredBy).filter(Boolean))]
    const users = userIds.length > 0
      ? await prisma.user.findMany({
        where: { id: { in: userIds }, tenantId: req.tenantId },
        select: { id: true, fullName: true, email: true }
      })
      : []
    const userMap = new Map(users.map((user) => [user.id, user]))

    res.json({
      data: history.map((item) => ({
        ...item,
        transferredByUser: userMap.get(item.transferredBy) || null
      }))
    })
  } catch (error) {
    next(error)
  }
})

// GET /students/import-template - Download CSV import template
router.get('/import-template', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase()
    if (format !== 'csv') throw new AppError('Only CSV template is supported', 400, 'UNSUPPORTED_FORMAT')

    const content = `\uFEFF${IMPORT_TEMPLATE_HEADERS}\n${IMPORT_TEMPLATE_SAMPLE}\n`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.csv"')
    res.send(content)
  } catch (error) {
    next(error)
  }
})

// GET /students/import-batches - Import history
router.get('/import-batches', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const batches = await prisma.studentImportBatch.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    res.json({ data: batches })
  } catch (error) {
    next(error)
  }
})

// POST /students/import-batches - Parse CSV/XLSX into draft rows
router.post('/import-batches', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const { fileName, fileType, contentBase64 } = req.body
    if (!fileName || !fileType || !contentBase64) {
      throw new AppError('fileName, fileType and contentBase64 are required', 400, 'MISSING_PARAMS')
    }

    const normalizedType = String(fileType).toLowerCase()
    const buffer = Buffer.from(String(contentBase64), 'base64')
    const rawRows = normalizedType.includes('sheet') || String(fileName).toLowerCase().endsWith('.xlsx')
      ? await parseXlsxRows(buffer)
      : parseCsvRows(buffer)

    const rows = await validateImportRows(req.tenantId, rawRows)
    const validRows = rows.filter((row) => row.status === 'VALID').length
    const invalidRows = rows.length - validRows

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.studentImportBatch.create({
        data: {
          tenantId: req.tenantId,
          fileName: String(fileName),
          importedBy: req.user?.fullName || req.user?.email || req.user?.id || null,
          totalRows: rows.length,
          validRows,
          invalidRows,
          createdRows: 0,
          status: 'DRAFT'
        }
      })

      if (rows.length > 0) {
        await tx.studentImportRow.createMany({
          data: rows.map((row) => ({
            ...row,
            batchId: createdBatch.id
          }))
        })
      }

      return tx.studentImportBatch.findUnique({
        where: { id: createdBatch.id },
        include: { rows: { orderBy: { rowNumber: 'asc' } } }
      })
    })

    res.status(201).json({ data: batch })
  } catch (error) {
    next(error)
  }
})

// GET /students/import-batches/:id/rows - Draft rows for assignment
router.get('/import-batches/:id/rows', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const batch = await prisma.studentImportBatch.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!batch) throw new AppError('Import batch not found', 404, 'NOT_FOUND')

    const rows = await prisma.studentImportRow.findMany({
      where: { batchId: batch.id, tenantId: req.tenantId },
      orderBy: { rowNumber: 'asc' }
    })
    res.json({ data: rows })
  } catch (error) {
    next(error)
  }
})

// PATCH /students/import-batches/:id/rows/:rowId - Update draft import row
router.patch('/import-batches/:id/rows/:rowId', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.studentImportRow.findFirst({
        where: { id: req.params.rowId, batchId: req.params.id, tenantId: req.tenantId }
      })
      if (!row) throw new AppError('Import row not found', 404, 'NOT_FOUND')
      if (row.status === 'IMPORTED') throw new AppError('Row already imported', 400, 'ROW_IMPORTED')

      const merged = {
        fullName: Object.prototype.hasOwnProperty.call(req.body, 'fullName') ? req.body.fullName : row.fullName,
        gender: Object.prototype.hasOwnProperty.call(req.body, 'gender') ? req.body.gender : row.gender,
        dateOfBirth: Object.prototype.hasOwnProperty.call(req.body, 'dateOfBirth') ? req.body.dateOfBirth : row.dateOfBirth,
        address: Object.prototype.hasOwnProperty.call(req.body, 'address') ? req.body.address : row.address,
        classId: Object.prototype.hasOwnProperty.call(req.body, 'classId') ? req.body.classId : row.classId
      }
      const data = await validateSingleImportRow(req.tenantId, req.params.id, row.id, merged, tx)
      const saved = await tx.studentImportRow.update({
        where: { id: row.id },
        data
      })
      await refreshImportBatchStats(req.params.id, tx)
      return saved
    })
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})


// POST /students/import-batches/:id/commit - Create students from valid assigned rows
router.post('/import-batches/:id/commit', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const batch = await prisma.studentImportBatch.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!batch) throw new AppError('Import batch not found', 404, 'NOT_FOUND')

    const rows = await prisma.studentImportRow.findMany({
      where: { batchId: batch.id, tenantId: req.tenantId, status: 'VALID' },
      orderBy: { rowNumber: 'asc' }
    })
    const [usage, limits] = await Promise.all([
      getTenantPlanUsage(prisma, req.tenantId),
      getTenantPlanLimits(prisma, req.tenantId)
    ])

    let createdThisRun = 0
    let failedThisRun = 0
    await prisma.$transaction(async (tx) => {
      const activeSemester = await getActiveSemesterContext(req.tenantId, tx)
      for (const row of rows) {
        const failRow = async (message) => {
          failedThisRun++
          await tx.studentImportRow.update({
            where: { id: row.id },
            data: { status: 'INVALID', errorMessage: message }
          })
        }

        if (!row.classId) {
          await failRow('Chua chon lop')
          continue
        }

        if (limits && usage.students + createdThisRun + 1 > limits.students) {
          await failRow(`Vuot gioi han hoc sinh cua goi (${limits.students})`)
          continue
        }

        const cls = await tx.class.findFirst({
          where: { id: row.classId, tenantId: req.tenantId },
          include: { _count: { select: { students: true } } }
        })
        if (!cls) {
          await failRow('Lop khong ton tai')
          continue
        }

        const activeYearLabel = activeSemester.academicYear ? academicYearLabel(activeSemester.academicYear) : null
        const classInActiveYear = cls.academicYearId === activeSemester.academicYearId
          || (activeYearLabel && cls.academicYear === activeYearLabel)
        if (!classInActiveYear) {
          await failRow('Lop khong thuoc nam hoc hien tai')
          continue
        }
        if (cls._count.students >= cls.capacity) {
          await failRow(`Lop ${cls.name} da day`)
          continue
        }

        const duplicate = await tx.student.findFirst({
          where: {
            tenantId: req.tenantId,
            fullName: { equals: row.fullName || '', mode: 'insensitive' },
            dateOfBirth: row.dateOfBirth
          },
          select: { id: true }
        })
        if (duplicate) {
          await failRow('Trung hoc sinh theo ten va ngay sinh')
          continue
        }

        const studentCode = await generateStudentCode(req.tenantId, tx)
        const student = await tx.student.create({
          data: {
            tenantId: req.tenantId,
            studentCode,
            fullName: row.fullName || '',
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            address: row.address,
            admissionDate: new Date(),
            classId: row.classId
          }
        })
        await tx.classEnrollment.create({
          data: {
            tenantId: req.tenantId,
            studentId: student.id,
            classId: row.classId,
            semesterId: activeSemester.id,
            academicYearId: activeSemester.academicYearId
          }
        })
        await tx.studentImportRow.update({
          where: { id: row.id },
          data: { status: 'IMPORTED', studentId: student.id, errorMessage: null }
        })
        createdThisRun++
      }

      await refreshImportBatchStats(batch.id, tx)
    })

    const updatedBatch = await prisma.studentImportBatch.findUnique({
      where: { id: batch.id },
      include: { rows: { orderBy: { rowNumber: 'asc' } } }
    })
    const summary = {
      createdThisRun,
      failedThisRun,
      totalImported: updatedBatch?.createdRows || 0,
      remainingInvalid: updatedBatch?.invalidRows || 0,
      remainingValid: updatedBatch?.validRows || 0
    }
    res.json({ data: updatedBatch, summary })
  } catch (error) {
    next(error)
  }
})

// DELETE /students/import-batches/:id/rows/:rowId - Remove draft import row
router.delete('/import-batches/:id/rows/:rowId', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.studentImportRow.findFirst({
        where: { id: req.params.rowId, batchId: req.params.id, tenantId: req.tenantId }
      })
      if (!row) throw new AppError('Import row not found', 404, 'NOT_FOUND')
      if (row.status === 'IMPORTED') throw new AppError('KhÃ´ng thá»ƒ xÃ³a dÃ²ng Ä‘Ã£ táº¡o há»c sinh', 400, 'ROW_IMPORTED')

      await tx.studentImportRow.delete({ where: { id: row.id } })
      const batch = await refreshImportBatchStats(req.params.id, tx)
      return { batch }
    })

    res.json({ data: result })
  } catch (error) {
    next(error)
  }
})

// GET /students/:id
router.get('/:id', authenticate, requireFeature('student-lookup'), authorize('SUPER_ADMIN', 'STAFF', 'TEACHER'), requireRolePermission('student-lookup'), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        class: { include: { grade: true } },
        enrollments: {
          include: {
            class: { include: { grade: true } },
            semester: true
          },
          orderBy: [
            { semester: { year: 'desc' } },
            { semester: { semesterNum: 'asc' } }
          ]
        },
        scores: {
          where: { ...(req.query.semesterId && { semesterId: req.query.semesterId }) },
          include: { subject: true, semester: true, scoreComponent: true }
        }
      }
    })

    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')

    const scope = await getUserAssignmentScope(prisma, req)
    if (scope) {
      if (!student.classId) throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
      if (!scope.classIds.includes(student.classId)) throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
    }

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// POST /students
router.post('/', authenticate, requireFeature('student-admission'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-admission'), [
  body('fullName').notEmpty().withMessage('Name is required'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Invalid gender'),
  body('dateOfBirth').isISO8601().withMessage('Invalid date'),
  body('admissionDate').optional().isISO8601().withMessage('Invalid date format'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } })
    }

    const { fullName, gender, dateOfBirth, address, phone, parentName, parentPhone, classId, email, admissionDate } = req.body

    // Validate age
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.tenantId } })
    const [usage, limits] = await Promise.all([
      getTenantPlanUsage(prisma, req.tenantId),
      getTenantPlanLimits(prisma, req.tenantId)
    ])
    if (limits && usage.students + 1 > limits.students) {
      throw new AppError(`Cannot exceed subscription student limit (${limits.students})`, 400, 'PLAN_LIMIT_EXCEEDED')
    }

    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--

    if (age < settings.minAge || age > settings.maxAge) {
      throw new AppError(`Student age (${age}) must be between ${settings.minAge}-${settings.maxAge}`, 400, 'INVALID_AGE')
    }

    // Use transaction to prevent race conditions
    const student = await prisma.$transaction(async (tx) => {
      // Check class capacity inside transaction
      let activeSemester = null
      if (classId) {
        activeSemester = await tx.semester.findFirst({
          where: { tenantId: req.tenantId, isActive: true, academicYearId: { not: null } },
          include: { academicYear: true },
          orderBy: [{ updatedAt: 'desc' }, { semesterNum: 'asc' }]
        })
        if (!activeSemester) {
          throw new AppError('No active semester found', 400, 'NO_ACTIVE_SEMESTER')
        }

        const cls = await tx.class.findFirst({
          where: { id: classId, tenantId: req.tenantId },
          include: { _count: { select: { students: true } } }
        })
        if (!cls) throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND')
        const activeYearLabel = activeSemester.academicYear ? academicYearLabel(activeSemester.academicYear) : null
        const classInActiveYear = cls.academicYearId === activeSemester.academicYearId
          || (activeYearLabel && cls.academicYear === activeYearLabel)
        if (!classInActiveYear) {
          throw new AppError('Lớp nhập học phải thuộc năm học của học kỳ đang hoạt động', 400, 'TARGET_CLASS_YEAR_MISMATCH')
        }
        if (cls._count.students >= cls.capacity) {
          throw new AppError(`Class ${cls.name} is full (max: ${cls.capacity})`, 400, 'CLASS_FULL')
        }
      }

      const studentCode = await generateStudentCode(req.tenantId, tx)

      const newStudent = await tx.student.create({
        data: {
          tenantId: req.tenantId,
          studentCode,
          fullName,
          gender,
          dateOfBirth: new Date(dateOfBirth),
          email: email || null,
          address,
          phone,
          parentName,
          parentPhone,
          admissionDate: (admissionDate && admissionDate.trim()) ? new Date(admissionDate) : new Date(),
          classId
        },
        include: { class: { include: { grade: true } } }
      })

      // Create enrollment if student is assigned to a class
      if (classId) {
        await tx.classEnrollment.create({
          data: {
            tenantId: req.tenantId,
            studentId: newStudent.id,
            classId,
            semesterId: activeSemester.id,
            academicYearId: activeSemester.academicYearId
          }
        })
      }

      return newStudent
    })

    res.status(201).json({ data: student })
  } catch (error) {
    next(error)
  }
})

// PUT /students/:id
router.put('/:id', authenticate, requireFeature('student-lookup'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('student-lookup'), async (req, res, next) => {
  try {
    const { fullName, gender, dateOfBirth, address, phone, parentName, parentPhone, classId, isActive, email, admissionDate } = req.body

    const updateData = {}
    if (fullName) updateData.fullName = fullName
    if (gender) updateData.gender = gender
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth)
    if (address !== undefined) updateData.address = address
    if (phone !== undefined) updateData.phone = phone
    if (parentName !== undefined) updateData.parentName = parentName
    if (parentPhone !== undefined) updateData.parentPhone = parentPhone
    if (classId !== undefined) updateData.classId = classId
    if (isActive !== undefined) updateData.isActive = isActive
    if (email !== undefined) updateData.email = email
    if (admissionDate) updateData.admissionDate = new Date(admissionDate)

    const existingStudent = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    // Prevent classId change via PUT - must use transfer endpoint
    if (classId !== undefined && classId !== existingStudent.classId) {
      throw new AppError('Không thể đổi lớp qua API này. Hãy sử dụng chức năng chuyển lớp.', 400, 'USE_TRANSFER')
    }
    delete updateData.classId

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: updateData,
      include: { class: { include: { grade: true } } }
    })

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// DELETE /students/:id
router.delete('/:id', authenticate, requireFeature('student-lookup'), authorize('SUPER_ADMIN'), requireRolePermission('student-lookup'), async (req, res, next) => {
  try {
    const existingStudent = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existingStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    const [scoreCount, promotionCount, transferCount, parentCount, enrollmentCount] = await Promise.all([
      prisma.score.count({ where: { studentId: req.params.id } }),
      prisma.promotion.count({ where: { studentId: req.params.id } }),
      prisma.transferHistory.count({ where: { studentId: req.params.id } }),
      prisma.parentStudent.count({ where: { studentId: req.params.id } }),
      prisma.classEnrollment.count({ where: { studentId: req.params.id } })
    ])
    if (promotionCount > 0 || transferCount > 0 || parentCount > 0 || enrollmentCount > 0) {
      throw new AppError('Cannot delete student with existing records (promotions, transfers, parent links, enrollments)', 400, 'HAS_RECORDS')
    }
    if (scoreCount > 0) {
      throw new AppError('Cannot delete student with score records', 400, 'HAS_SCORES')
    }

    await prisma.student.delete({ where: { id: req.params.id } })
    res.json({ data: { message: 'Student deleted' } })
  } catch (error) {
    next(error)
  }
})

// POST /students/:id/transfer - Transfer class
router.post('/:id/transfer', authenticate, requireFeature('class-transfer'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('class-transfer'), async (req, res, next) => {
  try {
    const classId = req.body.classId || req.body.newClassId
    const reason = String(req.body.reason || '').trim()

    if (!classId) {
      throw new AppError('Target class ID is required', 400, 'MISSING_PARAMS')
    }
    if (!reason) {
      throw new AppError('Transfer reason is required', 400, 'TRANSFER_REASON_REQUIRED')
    }

    // Get current student
    const currentStudent = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!currentStudent) throw new AppError('Student not found', 404, 'NOT_FOUND')

    if (!currentStudent.isActive) {
      throw new AppError('Cannot transfer inactive student', 400, 'STUDENT_INACTIVE')
    }

    const fromClassId = currentStudent.classId
    if (!fromClassId) {
      throw new AppError('Student has no current class to transfer from', 400, 'NO_FROM_CLASS')
    }
    if (fromClassId === classId) {
      throw new AppError('Student is already in this class', 400, 'SAME_CLASS')
    }

    // Check target class
    const cls = await prisma.class.findFirst({
      where: { id: classId, tenantId: req.tenantId },
      include: { _count: { select: { students: true } } }
    })
    if (!cls) throw new AppError('Class not found', 404, 'NOT_FOUND')
    if (cls._count.students >= cls.capacity) {
      throw new AppError('Target class is full', 400, 'CLASS_FULL')
    }

    // Find active semester for enrollment + transfer history
    const activeSemester = await prisma.semester.findFirst({
      where: { tenantId: req.tenantId, isActive: true, academicYearId: { not: null } },
      include: { academicYear: true },
      orderBy: [{ updatedAt: 'desc' }, { semesterNum: 'asc' }]
    })
    if (!activeSemester) throw new AppError('No active semester found', 400, 'NO_ACTIVE_SEMESTER')
    const activeYearLabel = activeSemester.academicYear ? academicYearLabel(activeSemester.academicYear) : null
    const classInActiveYear = cls.academicYearId === activeSemester.academicYearId
      || (activeYearLabel && cls.academicYear === activeYearLabel)
    if (!classInActiveYear) {
      throw new AppError('Lớp đích phải thuộc năm học của học kỳ đang hoạt động', 400, 'TARGET_CLASS_YEAR_MISMATCH')
    }

    await ensureClassAccess(prisma, req, fromClassId)
    await ensureClassAccess(prisma, req, classId)

    // Update student, record transfer, and update enrollment in a single transaction
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: req.params.id },
        data: { classId },
        include: { class: { include: { grade: true } } }
      })

      if (fromClassId) {
        await tx.transferHistory.create({
          data: {
            tenantId: req.tenantId,
            studentId: req.params.id,
            fromClassId,
            toClassId: classId,
            semesterId: activeSemester.id,
            reason,
            transferredBy: req.user.id
          }
        })
      }

      // Create/update enrollment for new class
      await tx.classEnrollment.upsert({
        where: {
          studentId_semesterId: {
            studentId: req.params.id,
            semesterId: activeSemester.id
          }
        },
        create: {
          tenantId: req.tenantId,
          studentId: req.params.id,
          classId,
          semesterId: activeSemester.id,
          academicYearId: activeSemester.academicYearId
        },
        update: {
          classId,
          academicYearId: activeSemester.academicYearId
        }
      })
    })

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { class: { include: { grade: true } } }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'TRANSFER_STUDENT',
        entity: 'Student',
        entityId: req.params.id,
        details: JSON.stringify({ fromClassId, toClassId: classId, reason })
      }
    })

    res.json({ data: student })
  } catch (error) {
    next(error)
  }
})

// GET /students/:id/transfer-history
router.get('/:id/transfer-history', authenticate, requireFeature('class-transfer'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('class-transfer'), async (req, res, next) => {
  try {
    const history = await prisma.transferHistory.findMany({
      where: { studentId: req.params.id, tenantId: req.tenantId },
      include: {
        fromClass: { include: { grade: true } },
        toClass: { include: { grade: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    const actorIds = [...new Set(history.map((item) => item.transferredBy).filter(Boolean))]
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true, email: true, role: true } })
      : []
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]))
    res.json({
      data: history.map((item) => ({
        ...item,
        actor: item.transferredBy ? actorMap.get(item.transferredBy) || null : null,
        actorName: item.transferredBy ? (actorMap.get(item.transferredBy)?.fullName || item.transferredBy) : null
      }))
    })
  } catch (error) {
    next(error)
  }
})

// GET /students/:id/promotion-placement-history
router.get('/:id/promotion-placement-history', authenticate, requireFeature('reports'), authorize('SUPER_ADMIN', 'STAFF'), requireRolePermission('reports'), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } })
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND')

    const history = await prisma.promotionPlacementHistory.findMany({
      where: { studentId: req.params.id, tenantId: req.tenantId },
      include: {
        fromClass: { select: { id: true, name: true } },
        toClass: { select: { id: true, name: true } },
        promotion: { select: { id: true, result: true, average: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ data: history })
  } catch (error) {
    next(error)
  }
})

module.exports = router
