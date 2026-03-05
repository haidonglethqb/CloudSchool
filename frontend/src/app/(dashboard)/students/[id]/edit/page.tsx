'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { studentApi, classApi } from '@/lib/api'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Grade {
  id: string
  name: string
  classes: Array<{ id: string; name: string }>
}

export default function StudentEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [grades, setGrades] = useState<Grade[]>([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    gender: 'MALE',
    dateOfBirth: '',
    parentName: '',
    parentPhone: '',
    address: '',
    classId: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentRes, gradesRes] = await Promise.all([
          studentApi.get(id as string),
          classApi.getGrades(),
        ])

        const student = studentRes.data.data
        const gradesList = gradesRes.data.data

        setGrades(gradesList)

        // Set form data from student
        const dob = student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : ''
        setFormData({
          fullName: student.fullName || '',
          gender: student.gender || 'MALE',
          dateOfBirth: dob,
          parentName: student.parentName || '',
          parentPhone: student.parentPhone || '',
          address: student.address || '',
          classId: student.classId || '',
        })

        // Auto-select grade from student's class
        if (student.class?.grade?.id) {
          setSelectedGrade(student.class.grade.id)
        }
      } catch (error: any) {
        console.error('Failed to fetch student:', error)
        if (error.response?.status === 404) {
          toast.error('Không tìm thấy học sinh')
          router.push('/students')
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id, router])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.fullName.trim()) errs.fullName = 'Họ tên không được để trống'
    if (!formData.dateOfBirth) errs.dateOfBirth = 'Ngày sinh không được để trống'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      setSaving(true)
      await studentApi.update(id as string, {
        fullName: formData.fullName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        parentName: formData.parentName || undefined,
        parentPhone: formData.parentPhone || undefined,
        address: formData.address || undefined,
        classId: formData.classId || undefined,
      })
      toast.success('Cập nhật họ sinh thành công')
      router.push(`/students/${id}`)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Cập nhật thất bại'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const filteredClasses = selectedGrade
    ? grades.find((g) => g.id === selectedGrade)?.classes || []
    : grades.flatMap((g) => g.classes)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/students/${id}`}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chỉnh sửa học sinh</h1>
          <p className="text-gray-500 text-sm mt-1">Cập nhật thông tin học sinh</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="card p-6 space-y-6">
          {/* Full Name */}
          <div>
            <label className="label">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.fullName ? 'border-red-300' : ''}`}
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Gender & DOB */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Giới tính <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
            <div>
              <label className="label">
                Ngày sinh <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={`input ${errors.dateOfBirth ? 'border-red-300' : ''}`}
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
            </div>
          </div>

          {/* Phụ huynh */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tên phụ huynh</label>
              <input
                type="text"
                className="input"
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">SĐT phụ huynh</label>
              <input
                type="tel"
                className="input"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="label">Địa chỉ</label>
            <input
              type="text"
              className="input"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          {/* Grade & Class */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Khối</label>
              <select
                className="input"
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value)
                  setFormData({ ...formData, classId: '' })
                }}
              >
                <option value="">Chọn khối</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lớp</label>
              <select
                className="input"
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              >
                <option value="">Chọn lớp</option>
                {filteredClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Link href={`/students/${id}`} className="btn-outline flex-1 justify-center">
              Hủy
            </Link>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Lưu thay đổi
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
