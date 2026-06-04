const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { DEFAULT_ENABLED_MODULES } = require('../src/constants/module-registry')

const prisma = new PrismaClient()

const TENANT_CODE = 'THPT-DEMO'
const STUDENTS_PER_CLASS = 8
const ACTIVE_YEAR_LABEL = '2025-2026'
const ACTIVE_SEMESTER_NUM = 2

const ACADEMIC_YEARS = [
  {
    startYear: 2024,
    endYear: 2025,
    startDate: new Date('2024-09-01'),
    endDate: new Date('2025-08-31')
  },
  {
    startYear: 2025,
    endYear: 2026,
    startDate: new Date('2025-09-01'),
    endDate: new Date('2026-08-31')
  },
  {
    startYear: 2026,
    endYear: 2027,
    startDate: new Date('2026-09-01'),
    endDate: new Date('2027-08-31')
  }
]

const GRADE_CONFIG = [
  { level: 10, name: 'Khá»‘i 10' },
  { level: 11, name: 'Khá»‘i 11' },
  { level: 12, name: 'Khá»‘i 12' }
]

const SUBJECT_CONFIG = [
  { name: 'ToÃ¡n', code: 'MATH', description: 'MÃ´n ToÃ¡n há»c' },
  { name: 'Ngá»¯ vÄƒn', code: 'LITERATURE', description: 'MÃ´n Ngá»¯ vÄƒn' },
  { name: 'Tiáº¿ng Anh', code: 'ENGLISH', description: 'MÃ´n Tiáº¿ng Anh' },
  { name: 'Váº­t lÃ½', code: 'PHYSICS', description: 'MÃ´n Váº­t lÃ½' },
  { name: 'HÃ³a há»c', code: 'CHEMISTRY', description: 'MÃ´n HÃ³a há»c' },
  { name: 'Sinh há»c', code: 'BIOLOGY', description: 'MÃ´n Sinh há»c' },
  { name: 'Lá»‹ch sá»­', code: 'HISTORY', description: 'MÃ´n Lá»‹ch sá»­' },
  { name: 'Äá»‹a lÃ½', code: 'GEOGRAPHY', description: 'MÃ´n Äá»‹a lÃ½' }
]

const SCORE_COMPONENT_CONFIG = [
  { name: 'Kiá»ƒm tra miá»‡ng', weight: 10 },
  { name: 'Kiá»ƒm tra 15 phÃºt', weight: 20 },
  { name: 'Kiá»ƒm tra 1 tiáº¿t', weight: 30 },
  { name: 'Thi cuá»‘i ká»³', weight: 40 }
]

const TEACHER_CONFIG = [
  { email: 'teacher@demo.school.vn', password: 'teacher123', fullName: 'Nguyá»…n VÄƒn Tháº§y', department: 'ToÃ¡n', subjectCode: 'MATH' },
  { email: 'teacher.literature@demo.school.vn', password: 'teacher123', fullName: 'Tráº§n Thá»‹ VÃ¢n', department: 'Ngá»¯ vÄƒn', subjectCode: 'LITERATURE' },
  { email: 'teacher.english@demo.school.vn', password: 'teacher123', fullName: 'LÃª HoÃ ng Anh', department: 'Tiáº¿ng Anh', subjectCode: 'ENGLISH' },
  { email: 'teacher.physics@demo.school.vn', password: 'teacher123', fullName: 'Pháº¡m Quá»‘c LÃ½', department: 'Váº­t lÃ½', subjectCode: 'PHYSICS' },
  { email: 'teacher.chemistry@demo.school.vn', password: 'teacher123', fullName: 'Äá»— Thanh HÃ³a', department: 'HÃ³a há»c', subjectCode: 'CHEMISTRY' },
  { email: 'teacher.biology@demo.school.vn', password: 'teacher123', fullName: 'BÃ¹i Minh Sinh', department: 'Sinh há»c', subjectCode: 'BIOLOGY' },
  { email: 'teacher.history@demo.school.vn', password: 'teacher123', fullName: 'Nguyá»…n Thá»‹ Sá»­', department: 'Lá»‹ch sá»­', subjectCode: 'HISTORY' },
  { email: 'teacher.geography@demo.school.vn', password: 'teacher123', fullName: 'Äáº·ng Thanh Äá»‹a', department: 'Äá»‹a lÃ½', subjectCode: 'GEOGRAPHY' }
]

const LAST_NAMES = ['Nguyá»…n', 'Tráº§n', 'LÃª', 'Pháº¡m', 'HoÃ ng', 'VÃµ', 'Äáº·ng', 'BÃ¹i', 'Äá»—', 'LÃ½']
const MIDDLE_NAMES = ['VÄƒn', 'Thá»‹', 'Há»¯u', 'Minh', 'Quá»‘c', 'Thanh', 'Ngá»c', 'Gia']
const FIRST_NAMES = ['An', 'BÃ¬nh', 'CÆ°á»ng', 'Dung', 'Em', 'Giang', 'Háº¡nh', 'Khanh', 'Long', 'My', 'Nam', 'Oanh']
const ADDRESS_POOL = [
  '123 Tráº§n HÆ°ng Äáº¡o, Quáº­n 1, TP.HCM',
  '45 Nguyá»…n TrÃ£i, Quáº­n 5, TP.HCM',
  '88 VÃµ VÄƒn Táº§n, Quáº­n 3, TP.HCM',
  '22 LÃª VÄƒn Sá»¹, Quáº­n PhÃº Nhuáº­n, TP.HCM',
  '300 Phan XÃ­ch Long, Quáº­n PhÃº Nhuáº­n, TP.HCM'
]

const getYearLabel = (startYear, endYear) => `${startYear}-${endYear}`

const chunkArray = (items, chunkSize) => {
  const chunks = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

const round2 = (value) => Math.round(value * 100) / 100

const getSemesterWindows = (yearRange) => {
  const label = getYearLabel(yearRange.startYear, yearRange.endYear)
  return [
    {
      semesterNum: 1,
      name: 'Há»c ká»³ 1',
      startDate: new Date(`${yearRange.startYear}-09-01`),
      endDate: new Date(`${yearRange.endYear}-01-31`),
      year: label
    },
    {
      semesterNum: 2,
      name: 'Há»c ká»³ 2',
      startDate: new Date(`${yearRange.endYear}-02-01`),
      endDate: new Date(`${yearRange.endYear}-06-30`),
      year: label
    }
  ]
}

const buildDeterministicScore = ({ studentOrdinal, subjectIndex, semesterNum, componentIndex }) => {
  const seed = (studentOrdinal * 13) + (subjectIndex * 7) + (semesterNum * 5) + (componentIndex * 3)
  if (studentOrdinal % 11 === 0) {
    return round2(4.6 + ((seed % 8) / 10))
  }
  if (studentOrdinal % 5 === 0) {
    return round2(3.2 + ((seed % 17) / 10))
  }
  if (studentOrdinal % 7 === 0) {
    return round2(5.0 + ((seed % 16) / 10))
  }
  return round2(6 + ((seed % 35) / 10))
}

async function ensurePlatformAdmin (passwordHash) {
  const existingPlatformAdmin = await prisma.user.findFirst({
    where: { tenantId: null, email: 'admin@cloudschool.vn' }
  })

  if (existingPlatformAdmin) {
    return prisma.user.update({
      where: { id: existingPlatformAdmin.id },
      data: {
        password: passwordHash,
        fullName: 'Platform Admin',
        role: 'PLATFORM_ADMIN',
        tenantId: null,
        isActive: true
      }
    })
  }

  return prisma.user.create({
    data: {
      email: 'admin@cloudschool.vn',
      password: passwordHash,
      fullName: 'Platform Admin',
      role: 'PLATFORM_ADMIN',
      tenantId: null
    }
  })
}

async function ensurePlans () {
  const planData = [
    {
      name: 'Mien phi',
      price: 0,
      studentLimit: 50,
      staffLimit: 5,
      teacherLimit: 10,
      classLimit: 5,
      description: 'Dung thu cho truong nho',
      features: ['Quan ly hoc sinh', 'Nhap diem co ban', 'Bao cao tong hop']
    },
    {
      name: 'Tieu chuan',
      price: 500000,
      studentLimit: 200,
      staffLimit: 10,
      teacherLimit: 30,
      classLimit: 15,
      description: 'Phu hop truong quy mo vua',
      features: ['Quan ly hoc sinh', 'Nhap diem', 'Bao cao chi tiet', 'Quan ly phu huynh', 'Xuat Excel']
    },
    {
      name: 'Nang cao',
      price: 1000000,
      studentLimit: 500,
      staffLimit: 20,
      teacherLimit: 60,
      classLimit: 30,
      description: 'Day du tinh nang cho truong lon',
      features: ['Quan ly hoc sinh', 'Nhap diem', 'Bao cao chi tiet', 'Quan ly phu huynh', 'Xuat Excel', 'Xep loai tu dong', 'Ho tro uu tien']
    },
    {
      name: 'Doanh nghiep',
      price: 2000000,
      studentLimit: 2000,
      staffLimit: 50,
      teacherLimit: 200,
      classLimit: 100,
      description: 'Khong gioi han, ho tro 24/7',
      features: ['Quan ly hoc sinh', 'Nhap diem', 'Bao cao chi tiet', 'Quan ly phu huynh', 'Xuat Excel', 'Xep loai tu dong', 'Ho tro 24/7', 'API tich hop', 'Tuy chinh thuong hieu']
    }
  ]

  const plans = await Promise.all(
    planData.map((data) => prisma.subscriptionPlan.upsert({
      where: { name: data.name },
      update: data,
      create: data
    }))
  )

  await prisma.subscriptionPlan.deleteMany({
    where: {
      name: 'Basic',
      tenants: { none: {} }
    }
  })

  return plans[0]
}

async function main () {
  console.log('Starting database seed...')

  const hashedPasswords = {
    admin: await bcrypt.hash('admin123', 10),
    staff: await bcrypt.hash('staff123', 10),
    teacher: await bcrypt.hash('teacher123', 10),
    parent: await bcrypt.hash('parent123', 10),
    platform: await bcrypt.hash('admin123', 10)
  }

  const platformAdmin = await ensurePlatformAdmin(hashedPasswords.platform)
  console.log('Platform admin ready:', platformAdmin.email)

  const freePlan = await ensurePlans()
  console.log('Subscription plans ready')

  const tenant = await prisma.tenant.upsert({
    where: { code: TENANT_CODE },
    update: {
      name: 'Truong THPT Demo',
      email: 'contact@demo.school.vn',
      status: 'ACTIVE',
      planId: freePlan.id
    },
    create: {
      name: 'Truong THPT Demo',
      code: TENANT_CODE,
      email: 'contact@demo.school.vn',
      status: 'ACTIVE',
      planId: freePlan.id
    }
  })
  console.log('Tenant ready:', tenant.code)

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      minAge: 15,
      maxAge: 20,
      maxClassSize: 40,
      passScore: 5,
      enabledModules: DEFAULT_ENABLED_MODULES
    },
    create: {
      tenantId: tenant.id,
      minAge: 15,
      maxAge: 20,
      maxClassSize: 40,
      passScore: 5,
      enabledModules: DEFAULT_ENABLED_MODULES
    }
  })
  console.log('Tenant settings ready')

  const demoUsers = [
    { email: 'admin@demo.school.vn', fullName: 'Quan tri vien', role: 'SUPER_ADMIN', password: hashedPasswords.admin },
    { email: 'staff@demo.school.vn', fullName: 'Nhan vien Giao vu', role: 'STAFF', department: 'Giao vu', password: hashedPasswords.staff },
    { email: 'teacher@demo.school.vn', fullName: 'Nguyen Van Thay', role: 'TEACHER', department: 'Toan', password: hashedPasswords.teacher }
  ]

  for (const userData of demoUsers) {
    await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: userData.email
        }
      },
      update: {
        password: userData.password,
        fullName: userData.fullName,
        role: userData.role,
        department: userData.department || null,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
        role: userData.role,
        department: userData.department || null
      }
    })
  }
  console.log('Core demo users ready')

  const gradeByLevel = {}
  for (const gradeData of GRADE_CONFIG) {
    const grade = await prisma.grade.upsert({
      where: {
        tenantId_level: {
          tenantId: tenant.id,
          level: gradeData.level
        }
      },
      update: { name: gradeData.name },
      create: {
        tenantId: tenant.id,
        level: gradeData.level,
        name: gradeData.name
      }
    })
    gradeByLevel[grade.level] = grade
  }
  console.log('Grades ready:', Object.keys(gradeByLevel).join(', '))

  await prisma.academicYear.updateMany({
    where: { tenantId: tenant.id },
    data: { isActive: false }
  })

  const academicYearByLabel = {}
  for (const ayData of ACADEMIC_YEARS) {
    const label = getYearLabel(ayData.startYear, ayData.endYear)
    const year = await prisma.academicYear.upsert({
      where: {
        tenantId_startYear_endYear: {
          tenantId: tenant.id,
          startYear: ayData.startYear,
          endYear: ayData.endYear
        }
      },
      update: {
        startDate: ayData.startDate,
        endDate: ayData.endDate,
        isActive: label === ACTIVE_YEAR_LABEL
      },
      create: {
        tenantId: tenant.id,
        startYear: ayData.startYear,
        endYear: ayData.endYear,
        startDate: ayData.startDate,
        endDate: ayData.endDate,
        isActive: label === ACTIVE_YEAR_LABEL
      }
    })
    academicYearByLabel[label] = year
  }
  console.log('Academic years ready:', Object.keys(academicYearByLabel).join(', '))

  await prisma.semester.updateMany({
    where: { tenantId: tenant.id },
    data: { isActive: false }
  })

  const semesterByKey = {}
  for (const ayData of ACADEMIC_YEARS) {
    const windows = getSemesterWindows(ayData)
    for (const semesterConfig of windows) {
      const key = `${semesterConfig.year}-${semesterConfig.semesterNum}`
      const semester = await prisma.semester.upsert({
        where: {
          tenantId_year_semesterNum: {
            tenantId: tenant.id,
            year: semesterConfig.year,
            semesterNum: semesterConfig.semesterNum
          }
        },
        update: {
          name: semesterConfig.name,
          startDate: semesterConfig.startDate,
          endDate: semesterConfig.endDate,
          isActive: semesterConfig.year === ACTIVE_YEAR_LABEL && semesterConfig.semesterNum === ACTIVE_SEMESTER_NUM,
          academicYearId: academicYearByLabel[semesterConfig.year].id
        },
        create: {
          tenantId: tenant.id,
          name: semesterConfig.name,
          year: semesterConfig.year,
          semesterNum: semesterConfig.semesterNum,
          startDate: semesterConfig.startDate,
          endDate: semesterConfig.endDate,
          isActive: semesterConfig.year === ACTIVE_YEAR_LABEL && semesterConfig.semesterNum === ACTIVE_SEMESTER_NUM,
          academicYearId: academicYearByLabel[semesterConfig.year].id
        }
      })
      semesterByKey[key] = semester
    }
  }
  console.log('Semesters ready:', Object.keys(semesterByKey).length)

  const subjectByCode = {}
  for (const subjectData of SUBJECT_CONFIG) {
    const subject = await prisma.subject.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: subjectData.code
        }
      },
      update: {
        name: subjectData.name,
        description: subjectData.description,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        name: subjectData.name,
        code: subjectData.code,
        description: subjectData.description
      }
    })
    subjectByCode[subject.code] = subject

    for (const component of SCORE_COMPONENT_CONFIG) {
      await prisma.scoreComponent.upsert({
        where: {
          tenantId_subjectId_name: {
            tenantId: tenant.id,
            subjectId: subject.id,
            name: component.name
          }
        },
        update: {
          weight: component.weight,
          isActive: true
        },
        create: {
          tenantId: tenant.id,
          subjectId: subject.id,
          name: component.name,
          weight: component.weight
        }
      })
    }
  }
  console.log('Subjects and score components ready')

  const teacherBySubjectCode = {}
  for (const teacherData of TEACHER_CONFIG) {
    const passwordHash = teacherData.email === 'teacher@demo.school.vn' ? hashedPasswords.teacher : await bcrypt.hash(teacherData.password, 10)
    const teacher = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: teacherData.email
        }
      },
      update: {
        password: passwordHash,
        fullName: teacherData.fullName,
        role: 'TEACHER',
        department: teacherData.department,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        email: teacherData.email,
        password: passwordHash,
        fullName: teacherData.fullName,
        role: 'TEACHER',
        department: teacherData.department
      }
    })
    teacherBySubjectCode[teacherData.subjectCode] = teacher
  }
  console.log('Subject teachers ready:', Object.keys(teacherBySubjectCode).length)

  const classContexts = []
  for (const ayData of ACADEMIC_YEARS) {
    const academicYearLabel = getYearLabel(ayData.startYear, ayData.endYear)
    for (const gradeData of GRADE_CONFIG) {
      for (let classIndex = 1; classIndex <= 3; classIndex += 1) {
        const className = `${gradeData.level}A${classIndex}`
        const classItem = await prisma.class.upsert({
          where: {
            tenantId_name_academicYear: {
              tenantId: tenant.id,
              name: className,
              academicYear: academicYearLabel
            }
          },
          update: {
            gradeId: gradeByLevel[gradeData.level].id,
            academicYearId: academicYearByLabel[academicYearLabel].id,
            capacity: 40,
            isActive: true
          },
          create: {
            tenantId: tenant.id,
            gradeId: gradeByLevel[gradeData.level].id,
            name: className,
            academicYear: academicYearLabel,
            academicYearId: academicYearByLabel[academicYearLabel].id,
            capacity: 40,
            isActive: true
          }
        })

        classContexts.push({
          class: classItem,
          classIndex,
          gradeLevel: gradeData.level,
          academicYearLabel,
          startYear: ayData.startYear
        })
      }
    }
  }
  console.log('Classes ready:', classContexts.length)

  const subjectCodes = SUBJECT_CONFIG.map((item) => item.code)
  for (const classContext of classContexts) {
    await prisma.teacherAssignment.updateMany({
      where: { tenantId: tenant.id, classId: classContext.class.id },
      data: { isHomeroom: false }
    })

    const homeroomSubjectCode = subjectCodes[(classContext.classIndex - 1) % subjectCodes.length]
    for (const subjectCode of subjectCodes) {
      const teacher = teacherBySubjectCode[subjectCode]
      const subject = subjectByCode[subjectCode]
      await prisma.teacherAssignment.upsert({
        where: {
          teacherId_classId_subjectId: {
            teacherId: teacher.id,
            classId: classContext.class.id,
            subjectId: subject.id
          }
        },
        update: {
          tenantId: tenant.id,
          isHomeroom: subjectCode === homeroomSubjectCode
        },
        create: {
          tenantId: tenant.id,
          teacherId: teacher.id,
          classId: classContext.class.id,
          subjectId: subject.id,
          isHomeroom: subjectCode === homeroomSubjectCode
        }
      })
    }
  }
  console.log('Teacher assignments ready')

  const studentsByClassId = {}
  let studentOrdinal = 0

  for (const classContext of classContexts) {
    studentsByClassId[classContext.class.id] = []

    for (let studentIndex = 1; studentIndex <= STUDENTS_PER_CLASS; studentIndex += 1) {
      studentOrdinal += 1
      const lastName = LAST_NAMES[(studentOrdinal + classContext.gradeLevel) % LAST_NAMES.length]
      const middleName = MIDDLE_NAMES[(studentOrdinal + classContext.classIndex) % MIDDLE_NAMES.length]
      const firstName = FIRST_NAMES[(studentOrdinal + studentIndex) % FIRST_NAMES.length]
      const gender = studentOrdinal % 2 === 0 ? 'MALE' : 'FEMALE'
      const classTag = classContext.class.name.replace('A', '')
      const studentCode = `HS${String(classContext.startYear).slice(-2)}${classTag}${String(studentIndex).padStart(2, '0')}`
      const birthYear = classContext.startYear - (classContext.gradeLevel + 5)
      const birthMonth = (studentIndex % 12) + 1
      const birthDay = ((studentOrdinal % 27) + 1)

      const student = await prisma.student.upsert({
        where: {
          tenantId_studentCode: {
            tenantId: tenant.id,
            studentCode
          }
        },
        update: {
          classId: classContext.class.id,
          fullName: `${lastName} ${middleName} ${firstName}`,
          gender,
          dateOfBirth: new Date(Date.UTC(birthYear, birthMonth - 1, birthDay)),
          address: ADDRESS_POOL[studentOrdinal % ADDRESS_POOL.length],
          parentName: `${lastName} ${middleName} Parent`,
          parentPhone: `09${String(10000000 + studentOrdinal).slice(-8)}`,
          isActive: true
        },
        create: {
          tenantId: tenant.id,
          classId: classContext.class.id,
          studentCode,
          fullName: `${lastName} ${middleName} ${firstName}`,
          gender,
          dateOfBirth: new Date(Date.UTC(birthYear, birthMonth - 1, birthDay)),
          address: ADDRESS_POOL[studentOrdinal % ADDRESS_POOL.length],
          parentName: `${lastName} ${middleName} Parent`,
          parentPhone: `09${String(10000000 + studentOrdinal).slice(-8)}`,
          admissionDate: new Date(Date.UTC(classContext.startYear, 8, 1))
        }
      })

      studentsByClassId[classContext.class.id].push({
        ...student,
        ordinal: studentOrdinal,
        yearLabel: classContext.academicYearLabel
      })
    }
  }
  console.log('Students ready:', studentOrdinal)

  for (const classContext of classContexts) {
    const sem1 = semesterByKey[`${classContext.academicYearLabel}-1`]
    const sem2 = semesterByKey[`${classContext.academicYearLabel}-2`]
    const classStudents = studentsByClassId[classContext.class.id] || []

    for (const student of classStudents) {
      await prisma.classEnrollment.upsert({
        where: {
          studentId_semesterId: {
            studentId: student.id,
            semesterId: sem1.id
          }
        },
        update: {
          tenantId: tenant.id,
          classId: classContext.class.id,
          academicYearId: academicYearByLabel[classContext.academicYearLabel].id
        },
        create: {
          tenantId: tenant.id,
          studentId: student.id,
          classId: classContext.class.id,
          semesterId: sem1.id,
          academicYearId: academicYearByLabel[classContext.academicYearLabel].id
        }
      })

      await prisma.classEnrollment.upsert({
        where: {
          studentId_semesterId: {
            studentId: student.id,
            semesterId: sem2.id
          }
        },
        update: {
          tenantId: tenant.id,
          classId: classContext.class.id,
          academicYearId: academicYearByLabel[classContext.academicYearLabel].id
        },
        create: {
          tenantId: tenant.id,
          studentId: student.id,
          classId: classContext.class.id,
          semesterId: sem2.id,
          academicYearId: academicYearByLabel[classContext.academicYearLabel].id
        }
      })
    }
  }
  console.log('Class enrollments ready')

  const parent1 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'parent1@demo.school.vn'
      }
    },
    update: {
      password: hashedPasswords.parent,
      fullName: 'Nguyen Van Phu Huynh',
      phone: '0901234567',
      role: 'PARENT',
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: 'parent1@demo.school.vn',
      password: hashedPasswords.parent,
      fullName: 'Nguyen Van Phu Huynh',
      phone: '0901234567',
      role: 'PARENT'
    }
  })

  const parent2 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'parent2@demo.school.vn'
      }
    },
    update: {
      password: hashedPasswords.parent,
      fullName: 'Le Thi Me',
      phone: '0909876543',
      role: 'PARENT',
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: 'parent2@demo.school.vn',
      password: hashedPasswords.parent,
      fullName: 'Le Thi Me',
      phone: '0909876543',
      role: 'PARENT'
    }
  })

  const activeYearStudents = classContexts
    .filter((context) => context.academicYearLabel === ACTIVE_YEAR_LABEL)
    .flatMap((context) => studentsByClassId[context.class.id] || [])
    .sort((left, right) => left.studentCode.localeCompare(right.studentCode))

  if (activeYearStudents[0]) {
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent1.id, studentId: activeYearStudents[0].id } },
      update: { relationship: 'PARENT', isPrimary: true },
      create: { parentId: parent1.id, studentId: activeYearStudents[0].id, relationship: 'PARENT', isPrimary: true }
    })
  }

  if (activeYearStudents[1]) {
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent1.id, studentId: activeYearStudents[1].id } },
      update: { relationship: 'GUARDIAN', isPrimary: false },
      create: { parentId: parent1.id, studentId: activeYearStudents[1].id, relationship: 'GUARDIAN', isPrimary: false }
    })
  }

  if (activeYearStudents[2]) {
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent2.id, studentId: activeYearStudents[2].id } },
      update: { relationship: 'PARENT', isPrimary: true },
      create: { parentId: parent2.id, studentId: activeYearStudents[2].id, relationship: 'PARENT', isPrimary: true }
    })
  }

  for (const student of activeYearStudents.slice(3, 24)) {
    const parentEmail = `parent.${student.studentCode.toLowerCase()}@demo.school.vn`
    const generatedParent = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: parentEmail
        }
      },
      update: {
        password: hashedPasswords.parent,
        fullName: `Phu huynh ${student.fullName}`,
        phone: `09${String(20000000 + student.ordinal).slice(-8)}`,
        role: 'PARENT',
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        email: parentEmail,
        password: hashedPasswords.parent,
        fullName: `Phu huynh ${student.fullName}`,
        phone: `09${String(20000000 + student.ordinal).slice(-8)}`,
        role: 'PARENT'
      }
    })

    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: generatedParent.id,
          studentId: student.id
        }
      },
      update: {
        relationship: 'PARENT',
        isPrimary: true
      },
      create: {
        parentId: generatedParent.id,
        studentId: student.id,
        relationship: 'PARENT',
        isPrimary: true
      }
    })
  }
  console.log('Parent accounts and links ready')

  const scoreComponentRows = await prisma.scoreComponent.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, subjectId: true, name: true, weight: true }
  })

  const componentBySubjectId = {}
  for (const row of scoreComponentRows) {
    if (!componentBySubjectId[row.subjectId]) componentBySubjectId[row.subjectId] = []
    componentBySubjectId[row.subjectId].push(row)
  }
  for (const subjectId of Object.keys(componentBySubjectId)) {
    componentBySubjectId[subjectId].sort((a, b) => a.name.localeCompare(b.name))
  }

  const scoreRows = []
  for (const classContext of classContexts) {
    const classStudents = studentsByClassId[classContext.class.id] || []
    const sem1 = semesterByKey[`${classContext.academicYearLabel}-1`]
    const sem2 = semesterByKey[`${classContext.academicYearLabel}-2`]
    const semesters = [sem1, sem2]

    for (const student of classStudents) {
      SUBJECT_CONFIG.forEach((subject, subjectIndex) => {
        const subjectRow = subjectByCode[subject.code]
        const components = componentBySubjectId[subjectRow.id] || []

        semesters.forEach((semester) => {
          components.forEach((component, componentIndex) => {
            const value = buildDeterministicScore({
              studentOrdinal: student.ordinal,
              subjectIndex,
              semesterNum: semester.semesterNum,
              componentIndex
            })

            scoreRows.push({
              tenantId: tenant.id,
              studentId: student.id,
              subjectId: subjectRow.id,
              semesterId: semester.id,
              scoreComponentId: component.id,
              value
            })
          })
        })
      })
    }
  }

  for (const chunk of chunkArray(scoreRows, 1500)) {
    await prisma.score.createMany({
      data: chunk,
      skipDuplicates: true
    })
  }
  console.log('Scores ready:', scoreRows.length)

  for (const classContext of classContexts) {
    const classStudents = studentsByClassId[classContext.class.id] || []
    const semesters = [
      semesterByKey[`${classContext.academicYearLabel}-1`],
      semesterByKey[`${classContext.academicYearLabel}-2`]
    ].filter(Boolean)

    for (const semester of semesters) {
      for (const student of classStudents) {
        const baseAverage = student.ordinal % 5 === 0
          ? 4.2
          : student.ordinal % 11 === 0
            ? 4.8
            : round2(5.6 + ((student.ordinal + semester.semesterNum + classContext.classIndex) % 34) / 10)
        const result = baseAverage >= 5 ? 'PASS' : baseAverage >= 4.5 ? 'RETAKE' : 'FAIL'

        await prisma.promotion.upsert({
          where: {
            studentId_classId_semesterId: {
              studentId: student.id,
              classId: classContext.class.id,
              semesterId: semester.id
            }
          },
          update: {
            tenantId: tenant.id,
            average: baseAverage,
            result,
            note: result === 'PASS' ? 'Äá»§ Ä‘iá»u kiá»‡n lÃªn lá»›p' : result === 'RETAKE' ? 'Cáº§n thi láº¡i Ä‘á»ƒ xÃ©t lÃªn lá»›p' : 'ChÆ°a Ä‘á»§ Ä‘iá»u kiá»‡n lÃªn lá»›p'
          },
          create: {
            tenantId: tenant.id,
            studentId: student.id,
            classId: classContext.class.id,
            semesterId: semester.id,
            average: baseAverage,
            result,
            note: result === 'PASS' ? 'Äá»§ Ä‘iá»u kiá»‡n lÃªn lá»›p' : result === 'RETAKE' ? 'Cáº§n thi láº¡i Ä‘á»ƒ xÃ©t lÃªn lá»›p' : 'ChÆ°a Ä‘á»§ Ä‘iá»u kiá»‡n lÃªn lá»›p'
          }
        })
      }
    }
  }
  console.log('Promotion scenarios ready')

  await prisma.transferHistory.deleteMany({
    where: {
      tenantId: tenant.id,
      reason: { startsWith: '[seed]' }
    }
  })

  const transferPairs = [
    { from: '10A1', to: '10A2', studentIndex: 0, reason: '[seed] Chuyá»ƒn lá»›p theo nguyá»‡n vá»ng gia Ä‘Ã¬nh' },
    { from: '11A2', to: '11A3', studentIndex: 1, reason: '[seed] Äiá»u chá»‰nh sÄ© sá»‘ giá»¯a cÃ¡c lá»›p' }
  ]
  for (const item of transferPairs) {
    const fromClass = classContexts.find((context) => context.academicYearLabel === ACTIVE_YEAR_LABEL && context.class.name === item.from)
    const toClass = classContexts.find((context) => context.academicYearLabel === ACTIVE_YEAR_LABEL && context.class.name === item.to)
    const student = fromClass ? studentsByClassId[fromClass.class.id]?.[item.studentIndex] : null
    if (!fromClass || !toClass || !student || !activeSemester) continue
    await prisma.transferHistory.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        fromClassId: fromClass.class.id,
        toClassId: toClass.class.id,
        semesterId: activeSemester.id,
        reason: item.reason,
        transferredBy: 'seed'
      }
    })
  }
  console.log('Transfer scenarios ready')

  const graduationYear = academicYearByLabel['2024-2025']
  const graduationStudents = classContexts
    .filter((context) => context.academicYearLabel === '2024-2025' && context.gradeLevel === 12)
    .flatMap((context) => (studentsByClassId[context.class.id] || []).map((student) => ({ student, classItem: context.class })))
    .slice(0, 6)

  for (const item of graduationStudents) {
    await prisma.graduationArchive.upsert({
      where: {
        tenantId_studentId_academicYearId: {
          tenantId: tenant.id,
          studentId: item.student.id,
          academicYearId: graduationYear.id
        }
      },
      update: {
        sourceClassId: item.classItem.id,
        note: 'Tá»‘t nghiá»‡p trong dá»¯ liá»‡u máº«u',
        createdBy: 'seed'
      },
      create: {
        tenantId: tenant.id,
        studentId: item.student.id,
        sourceClassId: item.classItem.id,
        academicYearId: graduationYear.id,
        note: 'Tá»‘t nghiá»‡p trong dá»¯ liá»‡u máº«u',
        createdBy: 'seed'
      }
    })
  }
  console.log('Graduation archive scenarios ready')

  console.log('\nDatabase seed completed.')
  console.log('\nLogin credentials:')
  console.log('  Platform Admin: admin@cloudschool.vn / admin123')
  console.log('  Demo School (Tenant code: THPT-DEMO)')
  console.log('  Admin:   admin@demo.school.vn / admin123')
  console.log('  Staff:   staff@demo.school.vn / staff123')
  console.log('  Teacher: teacher@demo.school.vn / teacher123')
  console.log('  Parent1: parent1@demo.school.vn / parent123')
  console.log('  Parent2: parent2@demo.school.vn / parent123')
}

main()
  .catch((error) => {
    console.error('Seed error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
