const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create demo tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Trường THPT Demo',
      code: 'THPT-DEMO',
      isActive: true
    }
  })
  console.log('✅ Created tenant:', tenant.name)

  // Create tenant settings
  const settings = await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      minAge: 15,
      maxAge: 20,
      maxClassSize: 40,
      passScore: 5.0,
      quiz15Weight: 1,
      quiz45Weight: 2,
      finalWeight: 3
    }
  })
  console.log('✅ Created tenant settings')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@demo.school.vn',
      password: hashedPassword,
      fullName: 'Quản trị viên',
      role: 'ADMIN'
    }
  })
  console.log('✅ Created admin user:', admin.email)

  // Create teacher
  const teacherHash = await bcrypt.hash('teacher123', 10)
  const teacher = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'teacher@demo.school.vn',
      password: teacherHash,
      fullName: 'Giáo viên Demo',
      role: 'TEACHER'
    }
  })
  console.log('✅ Created teacher user:', teacher.email)

  // Create grades
  const grades = await Promise.all([
    prisma.grade.create({ data: { tenantId: tenant.id, name: 'Khối 10', level: 10 } }),
    prisma.grade.create({ data: { tenantId: tenant.id, name: 'Khối 11', level: 11 } }),
    prisma.grade.create({ data: { tenantId: tenant.id, name: 'Khối 12', level: 12 } })
  ])
  console.log('✅ Created grades:', grades.map(g => g.name).join(', '))

  // Create classes
  const classes = await Promise.all([
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[0].id, name: '10A1' } }),
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[0].id, name: '10A2' } }),
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[1].id, name: '11A1' } }),
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[2].id, name: '12A1' } })
  ])
  console.log('✅ Created classes:', classes.map(c => c.name).join(', '))

  // Create subjects
  const subjects = await Promise.all([
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Toán', code: 'MATH' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Ngữ văn', code: 'LITERATURE' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Tiếng Anh', code: 'ENGLISH' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Vật lý', code: 'PHYSICS' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Hóa học', code: 'CHEMISTRY' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Sinh học', code: 'BIOLOGY' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Lịch sử', code: 'HISTORY' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Địa lý', code: 'GEOGRAPHY' } })
  ])
  console.log('✅ Created subjects:', subjects.map(s => s.name).join(', '))

  // Create semester
  const semester = await prisma.semester.create({
    data: {
      tenantId: tenant.id,
      name: 'Học kỳ 1 - 2024-2025',
      year: '2024-2025',
      semesterNum: 1,
      isActive: true
    }
  })
  console.log('✅ Created semester:', semester.name)

  // Create sample students
  const studentData = [
    { fullName: 'Nguyễn Văn An', gender: 'MALE', dateOfBirth: new Date('2009-03-15'), address: '123 Đường ABC, Quận 1, HCM' },
    { fullName: 'Trần Thị Bình', gender: 'FEMALE', dateOfBirth: new Date('2009-07-20'), address: '456 Đường XYZ, Quận 2, HCM' },
    { fullName: 'Lê Hoàng Cường', gender: 'MALE', dateOfBirth: new Date('2009-01-10'), address: '789 Đường DEF, Quận 3, HCM' },
    { fullName: 'Phạm Thị Dung', gender: 'FEMALE', dateOfBirth: new Date('2009-05-25'), address: '321 Đường GHI, Quận 4, HCM' },
    { fullName: 'Hoàng Văn Em', gender: 'MALE', dateOfBirth: new Date('2009-09-08'), address: '654 Đường JKL, Quận 5, HCM' }
  ]

  let studentCode = 1
  const students = await Promise.all(
    studentData.map(data =>
      prisma.student.create({
        data: {
          tenantId: tenant.id,
          classId: classes[0].id, // 10A1
          studentCode: `HS${String(studentCode++).padStart(6, '0')}`,
          ...data,
          email: `${data.fullName.toLowerCase().replace(/\s/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@student.demo.school.vn`
        }
      })
    )
  )
  console.log('✅ Created students:', students.length)

  // Create sample scores
  const scoreTypes = ['QUIZ_15', 'QUIZ_45', 'FINAL']
  for (const student of students) {
    for (const subject of subjects.slice(0, 3)) { // First 3 subjects
      for (const scoreType of scoreTypes) {
        await prisma.score.create({
          data: {
            tenantId: tenant.id,
            studentId: student.id,
            subjectId: subject.id,
            semesterId: semester.id,
            scoreType,
            value: Math.round((Math.random() * 4 + 6) * 100) / 100 // Random score 6-10
          }
        })
      }
    }
  }
  console.log('✅ Created sample scores')

  // Create sample parent accounts
  const parentHash = await bcrypt.hash('parent123', 10)
  const parent1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'parent1@demo.school.vn',
      password: parentHash,
      fullName: 'Nguyễn Văn Phụ Huynh',
      phone: '0901234567',
      role: 'PARENT',
      children: {
        create: [
          { studentId: students[0].id, relationship: 'PARENT', isPrimary: true },
          { studentId: students[1].id, relationship: 'GUARDIAN', isPrimary: false }
        ]
      }
    }
  })
  
  const parent2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'parent2@demo.school.vn',
      password: parentHash,
      fullName: 'Lê Thị Mẹ',
      phone: '0909876543',
      role: 'PARENT',
      children: {
        create: [
          { studentId: students[2].id, relationship: 'PARENT', isPrimary: true }
        ]
      }
    }
  })
  console.log('✅ Created parent accounts: parent1@demo.school.vn, parent2@demo.school.vn')

  console.log('\n🎉 Database seed completed!')
  console.log('\n📧 Login credentials:')
  console.log('   Admin: admin@demo.school.vn / admin123')
  console.log('   Teacher: teacher@demo.school.vn / teacher123')
  console.log('   Parent 1: parent1@demo.school.vn / parent123')
  console.log('   Parent 2: parent2@demo.school.vn / parent123')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
