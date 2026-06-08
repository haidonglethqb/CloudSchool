'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { academicYearApi, classApi, settingsApi, subjectApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { formatSemesterLabel } from '@/lib/utils'
import {
  Users,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  FolderOpen,
  BookOpen,
  ClipboardEdit,
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
  capacity: number
  grade?: { name: string }
  teacherAssignments?: Array<{
    id: string
    isHomeroom?: boolean
    semester?: { id: string; name: string; year?: string; displayName?: string; academicYearId?: string; isActive?: boolean } | null
    subject?: { id: string; name: string } | null
    teacher?: { id: string; fullName: string } | null
  }>
  _count: { students: number }
}

interface Settings {
  maxClassSize: number
}

interface AcademicYear {
  id: string
  startYear: number
  endYear: number
  isActive: boolean
}

interface Semester {
  id: string
  name: string
  year?: string
  displayName?: string
  academicYearId?: string
  isActive: boolean
}

export default function ClassesPage() {
  const user = useAuthStore((state) => state.user)
  const isTeacher = user?.role === 'TEACHER'
  const [grades, setGrades] = useState<Grade[]>([])
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('')
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  // Track whether user manually picked a year so we don't override their selection.
  // When false (default), always follow the backend active year — this ensures the dropdown
  // auto-updates to the new active year after promotion executes.
  const [userSelectedYear, setUserSelectedYear] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [showAddClass, setShowAddClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [selectedGradeId, setSelectedGradeId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const yearRes = await academicYearApi.list()
      const semesterRes = await subjectApi.getSemesters()
      const yearRows = yearRes.data.data || []
      const semesterRows = semesterRes.data.data || []
      const activeYearId = yearRows.find((item: AcademicYear) => item.isActive)?.id || yearRows[0]?.id || ''
      const activeSemesterId = semesterRows.find((item: Semester) => item.isActive && item.academicYearId === activeYearId)?.id
        || semesterRows.find((item: Semester) => item.academicYearId === activeYearId)?.id
        || semesterRows[0]?.id
      // If user has not manually selected a year, always follow the active year from backend.
      const targetYearId = userSelectedYear ? (selectedAcademicYearId || activeYearId) : activeYearId
      const targetSemesterId = selectedSemesterId && semesterRows.some((item: Semester) => item.id === selectedSemesterId)
        ? selectedSemesterId
        : activeSemesterId || ''
      setAcademicYears(yearRows)
      setSemesters(semesterRows)
      if (targetYearId !== selectedAcademicYearId) setSelectedAcademicYearId(targetYearId)
      if (targetSemesterId !== selectedSemesterId) setSelectedSemesterId(targetSemesterId)

      const classesRes = await classApi.list(targetYearId ? { academicYearId: targetYearId, ...(isTeacher && targetSemesterId ? { semesterId: targetSemesterId } : {}) } : undefined)
      setTeacherClasses(classesRes.data.data || [])

      if (isTeacher) {
        setGrades([])
        setSettings(null)
        return
      }

      const [gradesRes, settingsRes] = await Promise.all([
        classApi.getGrades(targetYearId ? { academicYearId: targetYearId } : undefined),
        settingsApi.get(),
      ])
      setGrades(gradesRes.data.data || [])
      setSettings(settingsRes.data.data)
      // Expand all grades by default
      setExpandedGrades(new Set((gradesRes.data.data || []).map((g: Grade) => g.id)))
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [isTeacher, selectedAcademicYearId, selectedSemesterId])

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
      await classApi.create({ name: newClassName.trim(), gradeId: selectedGradeId, academicYearId: selectedAcademicYearId })
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

  const filteredSemesters = selectedAcademicYearId
    ? semesters.filter((item) => item.academicYearId === selectedAcademicYearId)
    : semesters

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isTeacher) {
    const cards = teacherClasses.map((item) => {
      const assignments = (item.teacherAssignments || []).filter((entry) => entry.teacher?.id === user?.id && (!selectedSemesterId || entry.semester?.id === selectedSemesterId))
      const homeroom = assignments.find((entry) => entry.isHomeroom)
      const subject = homeroom?.subject || assignments[0]?.subject || null
      return {
        id: item.id,
        name: item.name,
        gradeName: item.grade?.name || '',
        studentCount: item._count?.students || 0,
        subject,
        isHomeroom: Boolean(homeroom),
      }
    })

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lớp của tôi</h1>
          <p className="text-gray-600 text-sm mt-1">Danh sách lớp giáo viên đang phụ trách trong năm học hiện tại</p>
        </div>

        {cards.length === 0 ? (
          <div className="card p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có lớp được phân công</h3>
            <p className="text-gray-500">Vui lòng liên hệ quản trị viên để được cấp phân công.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((item) => (
              <div key={item.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.gradeName}</p>
                  </div>
                  {item.isHomeroom ? (
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Chủ nhiệm</span>
                  ) : null}
                </div>
                <div className="mt-4 space-y-1 text-sm text-gray-600">
                  <p>{item.studentCount} học sinh</p>
                  <p>{item.subject ? `Môn phụ trách: ${item.subject.name}` : 'Môn phụ trách: Đang cập nhật'}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/classes/${item.id}?academicYearId=${selectedAcademicYearId}&semesterId=${selectedSemesterId}`} className="btn-outline flex-1 justify-center">
                    <BookOpen className="w-4 h-4 mr-1" />
                    Xem lớp
                  </Link>
                  <Link
                    href={`/scores?academicYearId=${selectedAcademicYearId}&semesterId=${selectedSemesterId}&classId=${item.id}${item.subject?.id ? `&subjectId=${item.subject.id}` : ''}`}
                    className="btn-primary flex-1 justify-center"
                  >
                    <ClipboardEdit className="w-4 h-4 mr-1" />
                    Nhập điểm
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
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
            BM2 - Quản lý danh sách lớp theo khối và năm học
          </p>
        </div>
        <button onClick={() => setShowAddClass(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Thêm lớp mới
        </button>
      </div>

      <div className="card p-4">
        <label className="label">Đang xem danh sách lớp năm học</label>
        <div className="grid gap-3 md:grid-cols-2 max-w-2xl">
          <select
            className="input"
            value={selectedAcademicYearId}
            onChange={(e) => {
              const nextYearId = e.target.value
              setUserSelectedYear(true)
              setSelectedAcademicYearId(nextYearId)
              const nextSemester = semesters.find((item) => item.isActive && item.academicYearId === nextYearId)
                || semesters.find((item) => item.academicYearId === nextYearId)
              setSelectedSemesterId(nextSemester?.id || '')
            }}
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.startYear}-{year.endYear}{year.isActive ? ' - Đang active' : ''}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
          >
            {filteredSemesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {formatSemesterLabel(semester)}{semester.isActive ? ' - Hiện tại' : ''}
              </option>
            ))}
          </select>
        </div>
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
                              {cls._count.students}/{cls.capacity}{' '}
                              học sinh
                              {cls._count.students >=
                                (cls.capacity) && (
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
                                (cls.capacity)
                                  ? 'bg-red-500'
                                  : cls._count.students >=
                                      (cls.capacity) * 0.8
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min((cls._count.students / (cls.capacity)) * 100, 100)}%`,
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <Link
                              href={`/classes/${cls.id}?academicYearId=${selectedAcademicYearId}&semesterId=${selectedSemesterId}`}
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
