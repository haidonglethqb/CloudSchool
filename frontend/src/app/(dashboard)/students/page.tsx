'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { studentApi, classApi } from '@/lib/api'
import { formatDate, getGenderLabel } from '@/lib/utils'
import {
  Search,
  Plus,
  ChevronDown,
  Eye,
  Edit2,
  Trash2,
  Loader2,
  UserX,
  Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Student {
  id: string
  studentCode: string
  fullName: string
  gender: string
  dateOfBirth: string
  address: string
  parentName: string | null
  parentPhone: string | null
  class: { id: string; name: string; grade: { name: string } } | null
  createdAt: string
}

interface Grade {
  id: string
  name: string
  level: number
}

interface Class {
  id: string
  name: string
  gradeId: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true)
      const response = await studentApi.list({
        search: searchQuery || undefined,
        gradeId: selectedGrade || undefined,
        classId: selectedClass || undefined,
      })
      setStudents(response.data.data)
    } catch (error) {
      console.error('Failed to fetch students:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedGrade, selectedClass])

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [gradesRes, classesRes] = await Promise.all([
          classApi.getGrades(),
          classApi.list(),
        ])
        setGrades(gradesRes.data.data)
        setClasses(classesRes.data.data)
      } catch (error) {
        console.error('Failed to fetch grades/classes:', error)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(fetchStudents, 300)
    return () => clearTimeout(debounce)
  }, [fetchStudents])

  const filteredClasses = selectedGrade
    ? classes.filter((c: any) => c.gradeId === selectedGrade)
    : classes

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa học sinh này?')) return

    try {
      setDeletingId(id)
      await studentApi.delete(id)
      toast.success('Xóa học sinh thành công')
      fetchStudents()
    } catch (error: any) {
      const message =
        error.response?.data?.error?.message || 'Xóa học sinh thất bại'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedGrade('')
    setSelectedClass('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tra cứu học sinh</h1>
          <p className="text-gray-600 text-sm mt-1">
            BM3 - Tìm kiếm và xem thông tin học sinh
          </p>
        </div>
        <Link href="/students/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Tiếp nhận học sinh
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã học sinh..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Bộ lọc
            <ChevronDown
              className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
            <div className="min-w-[200px]">
              <label className="label">Khối</label>
              <select
                className="input"
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value)
                  setSelectedClass('')
                }}
              >
                <option value="">Tất cả khối</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[200px]">
              <label className="label">Lớp</label>
              <select
                className="input"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Tất cả lớp</option>
                {filteredClasses.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedGrade || selectedClass) && (
              <div className="flex items-end">
                <button onClick={clearFilters} className="btn-secondary text-sm">
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Không tìm thấy học sinh nào</p>
            <p className="text-gray-400 text-sm mt-1">
              Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Mã HS</th>
                  <th className="table-header">Họ và tên</th>
                  <th className="table-header">Giới tính</th>
                  <th className="table-header">Ngày sinh</th>
                  <th className="table-header">Lớp</th>
                  <th className="table-header">Phụ huynh</th>
                  <th className="table-header text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-xs">
                      {student.studentCode}
                    </td>
                    <td className="table-cell font-medium">{student.fullName}</td>
                    <td className="table-cell">{getGenderLabel(student.gender)}</td>
                    <td className="table-cell">{formatDate(student.dateOfBirth)}</td>
                    <td className="table-cell">
                      {student.class ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                          {student.class.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">Chưa xếp lớp</span>
                      )}
                    </td>
                    <td className="table-cell text-gray-500">
                      {student.parentName || '-'}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
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
                        <button
                          onClick={() => handleDelete(student.id)}
                          disabled={deletingId === student.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Xóa"
                        >
                          {deletingId === student.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result count */}
        {!loading && students.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            Tìm thấy {students.length} học sinh
          </div>
        )}
      </div>
    </div>
  )
}
