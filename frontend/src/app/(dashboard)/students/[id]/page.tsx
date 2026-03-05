'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { studentApi } from '@/lib/api'
import { formatDate, getGenderLabel } from '@/lib/utils'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  GraduationCap,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Student {
  id: string
  studentCode: string
  fullName: string
  gender: string
  dateOfBirth: string
  address: string | null
  parentName: string | null
  parentPhone: string | null
  class: {
    id: string
    name: string
    grade: { id: string; name: string }
  } | null
  scores: Array<{
    id: string
    value: number
    scoreComponent: { name: string }
    subject: { name: string }
    semester: { name: string; year: number }
  }>
  createdAt: string
}

export default function StudentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await studentApi.get(id as string)
        setStudent(response.data.data)
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
    if (id) fetchStudent()
  }, [id, router])

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc muốn xóa học sinh này?')) return
    try {
      setDeleting(true)
      await studentApi.delete(id as string)
      toast.success('Xóa học sinh thành công')
      router.push('/students')
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xóa học sinh thất bại')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!student) return null

  // Group scores by subject
  const scoresBySubject = student.scores.reduce(
    (acc, score) => {
      const key = score.subject.name
      if (!acc[key]) acc[key] = []
      acc[key].push(score)
      return acc
    },
    {} as Record<string, typeof student.scores>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/students"
            className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.fullName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Mã HS: {student.studentCode}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/students/${student.id}/edit`}
            className="btn-outline"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Chỉnh sửa
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Xóa
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Student Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{student.fullName}</h2>
              <p className="text-sm text-gray-500 font-mono">{student.studentCode}</p>
              {student.class && (
                <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                  {student.class.name} - {student.class.grade.name}
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Giới tính</p>
                  <p className="text-sm font-medium">{getGenderLabel(student.gender)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ngày sinh</p>
                  <p className="text-sm font-medium">{formatDate(student.dateOfBirth)}</p>
                </div>
              </div>

              {student.parentName && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phụ huynh</p>
                    <p className="text-sm font-medium">{student.parentName}</p>
                  </div>
                </div>
              )}

              {student.parentPhone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">SĐT phụ huynh</p>
                    <p className="text-sm font-medium">{student.parentPhone}</p>
                  </div>
                </div>
              )}

              {student.address && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Địa chỉ</p>
                    <p className="text-sm font-medium">{student.address}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lớp</p>
                  <p className="text-sm font-medium">
                    {student.class ? `${student.class.name} (${student.class.grade.name})` : 'Chưa xếp lớp'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scores Section */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Bảng điểm
              </h3>
            </div>

            {student.scores.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Chưa có dữ liệu điểm</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="table-header">Môn học</th>
                      <th className="table-header">Học kỳ</th>
                      <th className="table-header">Loại điểm</th>
                      <th className="table-header text-center">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {student.scores
                      .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
                      .map((score) => (
                        <tr key={score.id} className="hover:bg-gray-50">
                          <td className="table-cell font-medium">{score.subject.name}</td>
                          <td className="table-cell text-gray-500">
                            {score.semester.name} ({score.semester.year})
                          </td>
                          <td className="table-cell">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {score.scoreComponent.name}
                            </span>
                          </td>
                          <td className="table-cell text-center">
                            <span className={`font-semibold ${
                              score.value >= 5 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {score.value.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
