import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(process.cwd(), 'src')

const FILE_EXTENSIONS = new Set(['.ts', '.tsx'])

const BANNED_PHRASES = [
  ['Khong the', 'Không thể'],
  ['Vui long', 'Vui lòng'],
  ['Chon', 'Chọn'],
  ['Tat ca', 'Tất cả'],
  ['Luu', 'Lưu'],
  ['Xoa', 'Xóa'],
  ['Them', 'Thêm'],
  ['Huy', 'Hủy'],
  ['Thao tac', 'Thao tác'],
  ['Bao cao', 'Báo cáo'],
  ['Hoc ky', 'Học kỳ'],
  ['Nam hoc', 'Năm học'],
  ['Phan quyen', 'Phân quyền'],
  ['Quy dinh', 'Quy định'],
  ['Xet len lop', 'Xét lên lớp'],
  ['Tot nghiep', 'Tốt nghiệp'],
  ['Danh sach', 'Danh sách'],
  ['Ho ten', 'Họ tên'],
  ['Chua co', 'Chưa có'],
  ['Can bo tri', 'Cần bố trí'],
]

function walkDir(dirPath) {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath))
      continue
    }

    if (entry.isFile() && FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function hasStringLiteral(line) {
  return line.includes("'") || line.includes('"') || line.includes('`')
}

function findViolations(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const violations = []

  lines.forEach((line, index) => {
    if (!hasStringLiteral(line)) return

    for (const [badPhrase, goodPhrase] of BANNED_PHRASES) {
      if (line.includes(badPhrase)) {
        violations.push({
          filePath,
          lineNumber: index + 1,
          badPhrase,
          goodPhrase,
          line: line.trim(),
        })
      }
    }
  })

  return violations
}

function main() {
  const files = walkDir(ROOT_DIR)
  const violations = files.flatMap((filePath) => findViolations(filePath))

  if (violations.length === 0) {
    console.log('✅ check:vi-text passed. Không tìm thấy chuỗi UI tiếng Việt không dấu.')
    process.exit(0)
  }

  console.error('❌ check:vi-text failed. Phát hiện chuỗi tiếng Việt không dấu trong UI:')
  for (const violation of violations) {
    const relativePath = path.relative(process.cwd(), violation.filePath).replace(/\\/g, '/')
    console.error(`- ${relativePath}:${violation.lineNumber} -> "${violation.badPhrase}" (gợi ý: "${violation.goodPhrase}")`)
    console.error(`  ${violation.line}`)
  }

  process.exit(1)
}

main()
