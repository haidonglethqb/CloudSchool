const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main () {
  console.log('🌱 Starting database seed...')

  // 1. Create Platform Admin
  const platformAdminPassword = await bcrypt.hash('admin123', 10)
  const existingPlatformAdmin = await prisma.user.findFirst({
    where: {
      tenantId: null,
      email: 'admin@cloudschool.vn'
    }
  })

  const platformAdmin = existingPlatformAdmin
    ? await prisma.user.update({
      where: { id: existingPlatformAdmin.id },
      data: {
        password: platformAdminPassword,
        fullName: 'Platform Admin',
        role: 'PLATFORM_ADMIN',
        tenantId: null
      }
    })
    : await prisma.user.create({
      data: {
        email: 'admin@cloudschool.vn',
        password: platformAdminPassword,
        fullName: 'Platform Admin',
        role: 'PLATFORM_ADMIN',
        tenantId: null
      }
    })
  console.log('✅ Created platform admin:', platformAdmin.email)

  // 2. Create subscription plans
  const planData = [
    {
      name: 'Miễn phí',
      price: 0,
      studentLimit: 50,
      teacherLimit: 10,
      classLimit: 5,
      description: 'Dùng thử cho trường nhỏ',
      features: ['Quản lý học sinh', 'Nhập điểm cơ bản', 'Báo cáo tổng hợp']
    },
    {
      name: 'Tiêu chuẩn',
      price: 500000,
      studentLimit: 200,
      teacherLimit: 30,
      classLimit: 15,
      description: 'Phù hợp trường quy mô vừa',
      features: ['Quản lý học sinh', 'Nhập điểm', 'Báo cáo chi tiết', 'Quản lý phụ huynh', 'Xuất Excel']
    },
    {
      name: 'Nâng cao',
      price: 1000000,
      studentLimit: 500,
      teacherLimit: 60,
      classLimit: 30,
      description: 'Đầy đủ tính năng cho trường lớn',
      features: ['Quản lý học sinh', 'Nhập điểm', 'Báo cáo chi tiết', 'Quản lý phụ huynh', 'Xuất Excel', 'Xếp loại tự động', 'Hỗ trợ ưu tiên']
    },
    {
      name: 'Doanh nghiệp',
      price: 2000000,
      studentLimit: 2000,
      teacherLimit: 200,
      classLimit: 100,
      description: 'Không giới hạn, hỗ trợ 24/7',
      features: ['Quản lý học sinh', 'Nhập điểm', 'Báo cáo chi tiết', 'Quản lý phụ huynh', 'Xuất Excel', 'Xếp loại tự động', 'Hỗ trợ 24/7', 'API tích hợp', 'Tùy chỉnh thương hiệu']
    }
  ]

  const plans = await Promise.all(
    planData.map(d => prisma.subscriptionPlan.upsert({
      where: { name: d.name },
      update: d,
      create: d
    }))
  )
  const plan = plans[0] // Free plan for demo tenant

  const existingTenant = await prisma.tenant.findUnique({
    where: { code: 'THPT-DEMO' },
    select: { id: true, code: true }
  })

  if (existingTenant) {
    await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: { planId: plan.id }
    })

    await prisma.subscriptionPlan.deleteMany({
      where: {
        name: 'Basic',
        tenants: { none: {} }
      }
    })

    console.log('ℹ️ Demo tenant already exists, updated plan mapping and skipped duplicate demo data creation')
    return
  }

  console.log('✅ Created subscription plans:', plans.map(p => p.name).join(', '))

  // 3. Create demo tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Trường THPT Demo',
      code: 'THPT-DEMO',
      email: 'contact@demo.school.vn',
      status: 'ACTIVE',
      planId: plan.id
    }
  })
  console.log('✅ Created tenant:', tenant.name)

  // 4. Create tenant settings
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      minAge: 15,
      maxAge: 20,
      maxClassSize: 40,
      passScore: 5.0
    }
  })
  console.log('✅ Created tenant settings')

  // 5. Create school admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@demo.school.vn',
      password: hashedPassword,
      fullName: 'Quản trị viên',
      role: 'SUPER_ADMIN'
    }
  })
  console.log('✅ Created admin user:', admin.email)

  // 6. Create staff user
  const staffHash = await bcrypt.hash('staff123', 10)
  const staff = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'staff@demo.school.vn',
      password: staffHash,
      fullName: 'Nhân viên Giáo vụ',
      role: 'STAFF',
      department: 'Giáo vụ'
    }
  })
  console.log('✅ Created staff user:', staff.email)

  // 7. Create teacher
  const teacherHash = await bcrypt.hash('teacher123', 10)
  const teacher = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'teacher@demo.school.vn',
      password: teacherHash,
      fullName: 'Nguyễn Văn Thầy',
      role: 'TEACHER',
      department: 'Toán'
    }
  })
  console.log('✅ Created teacher user:', teacher.email)

  // 8. Create grades
  const grades = await Promise.all([
    prisma.grade.create({ data: { tenantId: tenant.id, name: 'Khối 10', level: 10 } }),
    prisma.grade.create({ data: { tenantId: tenant.id, name: 'Khối 11', level: 11 } }),
    prisma.grade.create({ data: { tenantId: tenant.id, name: 'Khối 12', level: 12 } })
  ])
  console.log('✅ Created grades:', grades.map(g => g.name).join(', '))

  // 9. Create classes
  const classes = await Promise.all([
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[0].id, name: '10A1', academicYear: '2024-2025', capacity: 40 } }),
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[0].id, name: '10A2', academicYear: '2024-2025', capacity: 40 } }),
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[1].id, name: '11A1', academicYear: '2024-2025', capacity: 40 } }),
    prisma.class.create({ data: { tenantId: tenant.id, gradeId: grades[2].id, name: '12A1', academicYear: '2024-2025', capacity: 40 } })
  ])
  console.log('✅ Created classes:', classes.map(c => c.name).join(', '))

  // 10. Create subjects
  const subjects = await Promise.all([
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Toán', code: 'MATH', description: 'Môn Toán học' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Ngữ văn', code: 'LITERATURE', description: 'Môn Ngữ văn' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Tiếng Anh', code: 'ENGLISH', description: 'Môn Tiếng Anh' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Vật lý', code: 'PHYSICS', description: 'Môn Vật lý' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Hóa học', code: 'CHEMISTRY', description: 'Môn Hóa học' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Sinh học', code: 'BIOLOGY', description: 'Môn Sinh học' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Lịch sử', code: 'HISTORY', description: 'Môn Lịch sử' } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Địa lý', code: 'GEOGRAPHY', description: 'Môn Địa lý' } })
  ])
  console.log('✅ Created subjects:', subjects.map(s => s.name).join(', '))

  // 11. Create score components for each subject
  const scoreComponentConfig = [
    { name: 'Kiểm tra miệng', weight: 10 },
    { name: 'Kiểm tra 15 phút', weight: 20 },
    { name: 'Kiểm tra 1 tiết', weight: 30 },
    { name: 'Thi cuối kỳ', weight: 40 }
  ]

  const scoreComponents = {}
  for (const subject of subjects) {
    scoreComponents[subject.id] = await Promise.all(
      scoreComponentConfig.map(sc =>
        prisma.scoreComponent.create({
          data: { tenantId: tenant.id, subjectId: subject.id, name: sc.name, weight: sc.weight }
        })
      )
    )
  }
  console.log('✅ Created score components for all subjects')

  // 12. Create teacher assignments
  await prisma.teacherAssignment.create({
    data: {
      tenantId: tenant.id,
      teacherId: teacher.id,
      classId: classes[0].id,
      subjectId: subjects[0].id,
      isHomeroom: true
    }
  })
  await prisma.teacherAssignment.create({
    data: {
      tenantId: tenant.id,
      teacherId: teacher.id,
      classId: classes[1].id,
      subjectId: subjects[0].id,
      isHomeroom: false
    }
  })
  console.log('✅ Created teacher assignments')

  // 13. Create semester
  const semester = await prisma.semester.create({
    data: {
      tenantId: tenant.id,
      name: 'Học kỳ 1',
      year: '2024-2025',
      semesterNum: 1,
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-01-15'),
      isActive: true
    }
  })
  console.log('✅ Created semester:', semester.name)

  // 14. Create sample students
  const studentData = [
    { fullName: 'Nguyễn Văn An', gender: 'MALE', dateOfBirth: new Date('2009-03-15'), address: '123 Đường ABC, Quận 1, HCM', parentName: 'Nguyễn Văn Phụ Huynh', parentPhone: '0901234567' },
    { fullName: 'Trần Thị Bình', gender: 'FEMALE', dateOfBirth: new Date('2009-07-20'), address: '456 Đường XYZ, Quận 2, HCM', parentName: 'Trần Văn Ba', parentPhone: '0912345678' },
    { fullName: 'Lê Hoàng Cường', gender: 'MALE', dateOfBirth: new Date('2009-01-10'), address: '789 Đường DEF, Quận 3, HCM', parentName: 'Lê Thị Mẹ', parentPhone: '0909876543' },
    { fullName: 'Phạm Thị Dung', gender: 'FEMALE', dateOfBirth: new Date('2009-05-25'), address: '321 Đường GHI, Quận 4, HCM', parentName: 'Phạm Văn Cha', parentPhone: '0923456789' },
    { fullName: 'Hoàng Văn Em', gender: 'MALE', dateOfBirth: new Date('2009-09-08'), address: '654 Đường JKL, Quận 5, HCM', parentName: 'Hoàng Thị Mẹ', parentPhone: '0987654321' }
  ]

  let codeNum = 1
  const students = await Promise.all(
    studentData.map(data =>
      prisma.student.create({
        data: {
          tenantId: tenant.id,
          classId: classes[0].id,
          studentCode: `HS24${String(codeNum++).padStart(4, '0')}`,
          fullName: data.fullName,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          address: data.address,
          parentName: data.parentName,
          parentPhone: data.parentPhone
        }
      })
    )
  )
  console.log('✅ Created students:', students.length)

  // 15. Create sample scores for first 3 subjects
  for (const student of students) {
    for (const subject of subjects.slice(0, 3)) {
      const components = scoreComponents[subject.id]
      for (const sc of components) {
        await prisma.score.create({
          data: {
            tenantId: tenant.id,
            studentId: student.id,
            subjectId: subject.id,
            semesterId: semester.id,
            scoreComponentId: sc.id,
            value: Math.round((Math.random() * 4 + 6) * 100) / 100
          }
        })
      }
    }
  }
  console.log('✅ Created sample scores')

  // 16. Create parent accounts
  const parentHash = await bcrypt.hash('parent123', 10)
  await prisma.user.create({
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

  await prisma.user.create({
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
  console.log('✅ Created parent accounts')

  console.log('\n🎉 Database seed completed!')
  console.log('\n📧 Login credentials:')
  console.log('   ── Platform Admin ──')
  console.log('   Email: admin@cloudschool.vn / Password: admin123')
  console.log('')
  console.log('   ── Demo School (Mã trường: THPT-DEMO) ──')
  console.log('   Admin:   admin@demo.school.vn / admin123')
  console.log('   Staff:   staff@demo.school.vn / staff123')
  console.log('   Teacher: teacher@demo.school.vn / teacher123')
  console.log('   Parent1: parent1@demo.school.vn / parent123')
  console.log('   Parent2: parent2@demo.school.vn / parent123')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
