'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { studentApi, classApi, settingsApi } from '@/lib/api'
import { formatDateInput } from '@/lib/utils'
import { ArrowLeft, Loader2, Save, UserPlus } from 'lucide-react'
import Link from 'next/link'

const studentSchema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'Chọn giới tính' }),
  dateOfBirth: z.string().min(1, 'Chọn ngày sinh'),
  address: z.string().min(5, 'Địa chỉ ít nhất 5 ký tự'),
  parentName: z.string().optional().or(z.literal('')),
  parentPhone: z.string().optional().or(z.literal('')),
  classId: z.string().uuid('Chọn lớp'),
})

type StudentFormData = z.infer<typeof studentSchema>

interface ClassOption {
  id: string
  name: string
  grade: { name: string; level: number }
  _count: { students: number }
}

interface Settings {
  minAge: number
  maxAge: number
  maxClassSize: number
}

export default function NewStudentPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      gender: undefined,
      parentName: '',
      parentPhone: '',
    },
  })

  const selectedClassId = watch('classId')
  const dateOfBirth = watch('dateOfBirth')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, settingsRes] = await Promise.all([
          classApi.list(),
          settingsApi.get(),
        ])
        setClasses(classRes.data.data)
        setSettings(settingsRes.data.data)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast.error('Không thể tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const isClassFull = selectedClass
    ? selectedClass._count.students >= (settings?.maxClassSize || 40)
    : false

  // Calculate age warning
  const calculateAge = (dob: string) => {
    if (!dob) return null
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const age = dateOfBirth ? calculateAge(dateOfBirth) : null
  const ageWarning =
    age !== null && settings
      ? age < settings.minAge || age > settings.maxAge
        ? `Tuổi học sinh (${age}) không nằm trong khoảng ${settings.minAge}-${settings.maxAge}`
        : null
      : null

  const onSubmit = async (data: StudentFormData) => {
    if (isClassFull) {
      toast.error('Lớp đã đầy, không thể thêm học sinh')
      return
    }

    try {
      setSubmitting(true)
      await studentApi.create({
        ...data,
        parentName: data.parentName || undefined,
        parentPhone: data.parentPhone || undefined,
      })
      toast.success('Tiếp nhận học sinh thành công!')
      router.push('/students')
    } catch (error: any) {
      const message =
        error.response?.data?.error?.message || 'Tiếp nhận học sinh thất bại'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/students"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tiếp nhận học sinh</h1>
          <p className="text-gray-600 text-sm mt-1">BM1 - Lập hồ sơ học sinh mới</p>
        </div>
      </div>

      {/* Form */}
      <div className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="label">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.fullName ? 'border-red-500' : ''}`}
              placeholder="Nguyễn Văn A"
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
            )}
          </div>

          {/* Gender & Date of Birth */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Giới tính <span className="text-red-500">*</span>
              </label>
              <select
                className={`input ${errors.gender ? 'border-red-500' : ''}`}
                {...register('gender')}
              >
                <option value="">Chọn giới tính</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
              {errors.gender && (
                <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>
              )}
            </div>

            <div>
              <label className="label">
                Ngày sinh <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={`input ${errors.dateOfBirth ? 'border-red-500' : ''}`}
                {...register('dateOfBirth')}
              />
              {errors.dateOfBirth && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.dateOfBirth.message}
                </p>
              )}
              {ageWarning && (
                <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {ageWarning}
                </p>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="label">
              Địa chỉ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.address ? 'border-red-500' : ''}`}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              {...register('address')}
            />
            {errors.address && (
              <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>
            )}
          </div>

          {/* Phụ huynh */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tên phụ huynh</label>
              <input
                type="text"
                className="input"
                placeholder="Nguyễn Văn B"
                {...register('parentName')}
              />
            </div>
            <div>
              <label className="label">SĐT phụ huynh</label>
              <input
                type="text"
                className="input"
                placeholder="0901234567"
                {...register('parentPhone')}
              />
            </div>
          </div>

          {/* Class Selection */}
          <div>
            <label className="label">
              Lớp <span className="text-red-500">*</span>
            </label>
            <select
              className={`input ${errors.classId ? 'border-red-500' : ''}`}
              {...register('classId')}
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option
                  key={cls.id}
                  value={cls.id}
                  disabled={cls._count.students >= (settings?.maxClassSize || 40)}
                >
                  {cls.name} ({cls.grade.name}) - {cls._count.students}/
                  {settings?.maxClassSize || 40} học sinh
                  {cls._count.students >= (settings?.maxClassSize || 40)
                    ? ' (Đầy)'
                    : ''}
                </option>
              ))}
            </select>
            {errors.classId && (
              <p className="text-red-500 text-xs mt-1">{errors.classId.message}</p>
            )}
            {isClassFull && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">error</span>
                Lớp đã đầy (QD2: Sĩ số tối đa {settings?.maxClassSize})
              </p>
            )}
          </div>

          {/* Age Rules Info */}
          {settings && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">QD1 - Quy định độ tuổi:</span> Học sinh
                phải từ {settings.minAge} đến {settings.maxAge} tuổi.
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <span className="font-medium">QD2 - Sĩ số tối đa:</span>{' '}
                {settings.maxClassSize} học sinh/lớp.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Link href="/students" className="btn-outline flex-1">
              Hủy
            </Link>
            <button
              type="submit"
              disabled={submitting || isClassFull}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Lưu học sinh
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
