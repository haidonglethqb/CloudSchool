'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { classApi, settingsApi } from '@/lib/api'
import {
  Users,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Grade {
  id: string
  name: string
  level: number
  classes: Class[]
}

interface Class {
  id: string
  name: string
  _count: { students: number }
}

interface Settings {
  maxClassSize: number
}

export default function ClassesPage() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [showAddClass, setShowAddClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [selectedGradeId, setSelectedGradeId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const [gradesRes, settingsRes] = await Promise.all([
        classApi.getGrades(),
        settingsApi.get(),
      ])
      setGrades(gradesRes.data.data)
      setSettings(settingsRes.data.data)
      // Expand all grades by default
      setExpandedGrades(new Set(gradesRes.data.data.map((g: Grade) => g.id)))
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const toggleGrade = (gradeId: string) => {
    const newExpanded = new Set(expandedGrades)
    if (newExpanded.has(gradeId)) {
      newExpanded.delete(gradeId)
    } else {
      newExpanded.add(gradeId)
    }
    setExpandedGrades(newExpanded)
  }

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName.trim() || !selectedGradeId) {
      toast.error('Vui lòng nhập tên lớp và chọn khối')
      return
    }

    try {
      setSubmitting(true)
      await classApi.create({ name: newClassName.trim(), gradeId: selectedGradeId })
      toast.success('Thêm lớp thành công')
      setNewClassName('')
      setSelectedGradeId('')
      setShowAddClass(false)
      fetchData()
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Thêm lớp thất bại'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!confirm(`Bạn có chắc muốn xóa lớp ${className}?`)) return

    try {
      await classApi.delete(classId)
      toast.success('Xóa lớp thành công')
      fetchData()
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Xóa lớp thất bại'
      toast.error(message)
    }
  }

  const getTotalStudents = () =>
    grades.reduce(
      (sum, grade) =>
        sum + grade.classes.reduce((s, c) => s + c._count.students, 0),
      0
    )

  const getTotalClasses = () =>
    grades.reduce((sum, grade) => sum + grade.classes.length, 0)

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lập danh sách lớp</h1>
          <p className="text-gray-600 text-sm mt-1">
            BM2 - Quản lý danh sách lớp theo khối
          </p>
        </div>
        <button onClick={() => setShowAddClass(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Thêm lớp mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{grades.length}</p>
          <p className="text-sm text-gray-500">Khối</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{getTotalClasses()}</p>
          <p className="text-sm text-gray-500">Lớp</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{getTotalStudents()}</p>
          <p className="text-sm text-gray-500">Học sinh</p>
        </div>
      </div>

      {/* Add Class Modal */}
      {showAddClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Thêm lớp mới</h2>
            <form onSubmit={handleAddClass} className="space-y-4">
              <div>
                <label className="label">Khối</label>
                <select
                  className="input"
                  value={selectedGradeId}
                  onChange={(e) => setSelectedGradeId(e.target.value)}
                  required
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
                <label className="label">Tên lớp</label>
                <input
                  type="text"
                  className="input"
                  placeholder="VD: 10A1"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClass(false)}
                  className="btn-outline flex-1"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Thêm lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grades & Classes List */}
      <div className="space-y-4">
        {grades.length === 0 ? (
          <div className="card p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Chưa có khối nào</p>
            <p className="text-gray-400 text-sm mt-1">
              Vào phần Quy định để thêm khối mới
            </p>
          </div>
        ) : (
          grades.map((grade) => (
            <div key={grade.id} className="card overflow-hidden">
              {/* Grade Header */}
              <button
                onClick={() => toggleGrade(grade.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedGrades.has(grade.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <h3 className="font-semibold text-gray-900">{grade.name}</h3>
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                    {grade.classes.length} lớp
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {grade.classes.reduce((sum, c) => sum + c._count.students, 0)} học
                  sinh
                </span>
              </button>

              {/* Classes */}
              {expandedGrades.has(grade.id) && (
                <div className="divide-y divide-gray-100">
                  {grade.classes.length === 0 ? (
                    <p className="px-4 py-6 text-center text-gray-400 text-sm">
                      Chưa có lớp nào trong khối này
                    </p>
                  ) : (
                    grade.classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{cls.name}</p>
                            <p className="text-sm text-gray-500">
                              {cls._count.students}/{settings?.maxClassSize || 40}{' '}
                              học sinh
                              {cls._count.students >=
                                (settings?.maxClassSize || 40) && (
                                <span className="text-red-500 ml-2">(Đầy)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cls._count.students >=
                                (settings?.maxClassSize || 40)
                                  ? 'bg-red-500'
                                  : cls._count.students >=
                                      (settings?.maxClassSize || 40) * 0.8
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min((cls._count.students / (settings?.maxClassSize || 40)) * 100, 100)}%`,
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <Link
                              href={`/classes/${cls.id}`}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDeleteClass(cls.id, cls.name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              disabled={cls._count.students > 0}
                              title={
                                cls._count.students > 0
                                  ? 'Không thể xóa lớp có học sinh'
                                  : 'Xóa lớp'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* QD2 Info */}
      {settings && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-medium">QD2 - Sĩ số tối đa:</span> Mỗi lớp tối đa{' '}
            {settings.maxClassSize} học sinh. Có thể thay đổi trong phần Quy định.
          </p>
        </div>
      )}
    </div>
  )
}
