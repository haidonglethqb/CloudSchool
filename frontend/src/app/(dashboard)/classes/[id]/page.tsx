'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { classApi, settingsApi, exportApi, downloadBlob } from '@/lib/api'
import { formatDate, getGenderLabel } from '@/lib/utils'
import {
  ArrowLeft,
  Save,
  Loader2,
  Users,
  Trash2,
  Edit2,
  Eye,
  UserPlus,
  Download,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ClassDetail {
  id: string
  name: string
  capacity: number
  academicYear: string | null
  isActive: boolean
  grade: { id: string; name: string; level: number }
  teacherAssignments: Array<{
    id: string
    isHomeroom: boolean
    teacher: { id: string; fullName: string }
    subject: { id: string; name: string } | null
  }>
  students: Array<{
    id: string
    studentCode: string
    fullName: string
    gender: string
    dateOfBirth: string
    parentName: string | null
  }>
  _count: { students: number }
}

export default function ClassDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [classData, setClassData] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [maxClassSize, setMaxClassSize] = useState(40)
  const [formData, setFormData] = useState({
    name: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, settingsRes] = await Promise.all([
          classApi.get(id as string),
          settingsApi.get(),
        ])
        const data = classRes.data.data
        setClassData(data)
        setFormData({
          name: data.name || '',
        })
        setMaxClassSize(settingsRes.data.data.maxClassSize || 40)
      } catch (error: any) {
        console.error('Failed to fetch class:', error)
        if (error.response?.status === 404) {
          toast.error('Không tìm thấy lớp')
          router.push('/classes')
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id, router])

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Tên lớp không được để trống')
      return
    }
    try {
      setSaving(true)
      await classApi.update(id as string, {
        name: formData.name,
      })
      toast.success('Cập nhật lớp thành công')
      setEditing(false)
      // Refresh data
      const res = await classApi.get(id as string)
      setClassData(res.data.data)
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Cập nhật thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!classData) return null

  const studentCount = classData.students?.length || classData._count?.students || 0
  const capacityPercent = Math.min((studentCount / maxClassSize) * 100, 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/classes"
            className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            {editing ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  className="input text-2xl font-bold py-1 w-48"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
                <button onClick={handleSave} disabled={saving} className="btn-primary py-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditing(false)} className="btn-outline py-1.5">
                  Hủy
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">
                  Lớp {classData.name}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  {classData.grade.name}
                  {classData.teacherAssignments?.find(a => a.isHomeroom)
                    ? ` - GVCN: ${classData.teacherAssignments.find(a => a.isHomeroom)?.teacher.fullName}`
                    : ' - Chưa có GVCN'}
                </p>
              </>
            )}
          </div>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await exportApi.classes({ format: 'excel' })
                  downloadBlob(res.data, `lop-${classData?.name || 'danh-sach'}.xlsx`)
                  toast.success('Xuất file thành công')
                } catch { toast.error('Xuất file thất bại') }
              }}
              className="btn-outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Xuất Excel
            </button>
            <button onClick={() => setEditing(true)} className="btn-outline">
              <Edit2 className="w-4 h-4 mr-2" />
              Chỉnh sửa
            </button>
            <Link href="/students/new" className="btn-primary">
              <UserPlus className="w-4 h-4 mr-2" />
              Thêm HS
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Sĩ số</p>
          <p className="text-2xl font-bold text-primary">
            {studentCount}/{maxClassSize}
          </p>
          <div className="mt-2 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                capacityPercent >= 100
                  ? 'bg-red-500'
                  : capacityPercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Khối</p>
          <p className="text-2xl font-bold text-gray-900">{classData.grade.name}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Trạng thái</p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            classData.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {classData.isActive ? 'Hoạt động' : 'Vô hiệu'}
          </span>
        </div>
      </div>

      {/* Students Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Danh sách học sinh ({studentCount})
          </h3>
        </div>

        {!classData.students || classData.students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Chưa có học sinh trong lớp này</p>
            <Link href="/students/new" className="inline-block mt-4 btn-primary">
              <UserPlus className="w-4 h-4 mr-2" />
              Thêm học sinh
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">STT</th>
                  <th className="table-header">Mã HS</th>
                  <th className="table-header">Họ và tên</th>
                  <th className="table-header">Giới tính</th>
                  <th className="table-header">Ngày sinh</th>
                  <th className="table-header">Phụ huynh</th>
                  <th className="table-header text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classData.students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="table-cell text-center text-gray-500">{index + 1}</td>
                    <td className="table-cell font-mono text-xs">{student.studentCode}</td>
                    <td className="table-cell font-medium">{student.fullName}</td>
                    <td className="table-cell">{getGenderLabel(student.gender)}</td>
                    <td className="table-cell">{formatDate(student.dateOfBirth)}</td>
                    <td className="table-cell text-gray-500">{student.parentName || '-'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/students/${student.id}`}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/students/${student.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {classData.students && classData.students.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            Hiển thị {classData.students.length} học sinh
          </div>
        )}
      </div>
    </div>
  )
}
