'use client'

import { useEffect, useState } from 'react'
import { academicYearApi, classApi, studentApi, subjectApi } from '@/lib/api'
import { ArrowRightLeft, ChevronDown, Filter, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface ClassItem {
  id: string
  name: string
  gradeId?: string
  grade?: { id?: string; name: string }
}

interface GradeItem {
  id: string
  name: string
  level: number
}

interface StudentItem {
  id: string
  fullName: string
  studentCode: string
  gender?: string
  dateOfBirth?: string
  address?: string | null
  class?: { id: string; name: string; grade?: { name: string } } | null
}

interface TransferHistoryItem {
  id: string
  reason: string | null
  createdAt: string
  transferredBy?: string | null
  student?: { fullName: string; studentCode: string } | null
  fromClass?: { name: string } | null
  toClass?: { name: string } | null
  transferredByUser?: { fullName: string; email?: string } | null
}

export default function ClassTransferPage() {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [grades, setGrades] = useState<GradeItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [targetClassId, setTargetClassId] = useState('')
  const [reason, setReason] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [history, setHistory] = useState<TransferHistoryItem[]>([])

  const selectedStudent = students.find((student) => student.id === studentId)
  const filteredClasses = selectedGrade
    ? classes.filter((item) => item.gradeId === selectedGrade || item.grade?.id === selectedGrade)
    : classes

  const fetchData = async () => {
    try {
      const [yearsRes, semestersRes, historyRes, gradesRes] = await Promise.all([
        academicYearApi.list(),
        subjectApi.getSemesters(),
        studentApi.getAllTransferHistory(),
        classApi.getGrades(),
      ])
      const years = yearsRes.data.data || []
      const semesters = semestersRes.data.data || []
      const activeSemester = semesters.find((semester: { isActive: boolean; academicYearId?: string }) => semester.isActive)
      const activeYear = years.find((year: { id: string; isActive: boolean }) => year.isActive) || years[0]
      const academicYearId = activeSemester?.academicYearId || activeYear?.id
      const classRes = await classApi.list(academicYearId ? { academicYearId } : undefined)
      setClasses(classRes.data.data || [])
      setGrades(gradesRes.data.data || [])
      setHistory(historyRes.data.data || [])
    } catch {
      toast.error('Không thể tải dữ liệu chuyển lớp')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setSearchingStudents(true)
        const res = await studentApi.list({
          search: studentSearch || undefined,
          gradeId: selectedGrade || undefined,
          classId: selectedClass || undefined,
          gender: selectedGender || undefined,
          address: addressQuery || undefined,
          birthYear: birthYear ? Number(birthYear) : undefined,
          status: 'active',
          page: 1,
          limit: 50,
        })
        setStudents(res.data.data || [])
      } catch {
        setStudents([])
      } finally {
        setSearchingStudents(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [addressQuery, birthYear, selectedClass, selectedGender, selectedGrade, studentSearch])

  const clearFilters = () => {
    setStudentSearch('')
    setSelectedGrade('')
    setSelectedClass('')
    setSelectedGender('')
    setAddressQuery('')
    setBirthYear('')
  }

  const selectStudentForTransfer = (student: StudentItem) => {
    setStudentId(student.id)
    setTargetClassId('')
  }

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedReason = reason.trim()
    if (!studentId || !targetClassId) {
      toast.error('Vui lòng chọn học sinh và lớp đích')
      return
    }
    if (!trimmedReason) {
      toast.error('Vui lòng nhập lý do chuyển lớp')
      return
    }

    try {
      setTransferring(true)
      await studentApi.transfer(studentId, { classId: targetClassId, reason: trimmedReason })
      toast.success('Chuyển lớp thành công')
      setStudentId('')
      setReason('')
      setTargetClassId('')
      await fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Chuyển lớp thất bại')
    } finally {
      setTransferring(false)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chuyển lớp</h1>
        <p className="text-sm text-gray-600 mt-1">Tìm học sinh bằng bộ lọc, chọn trong bảng, rồi chuyển lớp.</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã học sinh..."
              className="input pl-10"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Bộ lọc
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

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
                  <option key={grade.id} value={grade.id}>{grade.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="label">Lớp</label>
              <select className="input" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {filteredClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="label">Giới tính</label>
              <select className="input" value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="label">Địa chỉ</label>
              <input className="input" placeholder="Tìm theo địa chỉ" value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)} />
            </div>
            <div className="min-w-[140px]">
              <label className="label">Năm sinh</label>
              <input className="input" type="number" placeholder="VD: 2008" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
            </div>
            {(studentSearch || selectedGrade || selectedClass || selectedGender || addressQuery || birthYear) && (
              <div className="flex items-end">
                <button type="button" onClick={clearFilters} className="btn-secondary text-sm">
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Danh sách học sinh</h2>
          {searchingStudents && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        {students.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Không tìm thấy học sinh phù hợp</div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[760px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="table-header">Học sinh</th>
                  <th className="table-header">Lớp hiện tại</th>
                  <th className="table-header">Địa chỉ</th>
                  <th className="table-header">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className={`cursor-pointer hover:bg-gray-50 ${student.id === studentId ? 'bg-primary-50' : ''}`}
                    onClick={() => selectStudentForTransfer(student)}
                  >
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{student.fullName}</div>
                      <div className="text-xs text-gray-500">{student.studentCode}</div>
                    </td>
                    <td className="table-cell">{student.class?.name || 'Chưa có lớp'}</td>
                    <td className="table-cell">{student.address || '-'}</td>
                    <td className="table-cell">
                      <button type="button" onClick={() => selectStudentForTransfer(student)} className="btn-outline py-1.5 text-sm">
                        Chọn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form onSubmit={submitTransfer} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Học sinh đã chọn</label>
          <div className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm">
            {selectedStudent ? (
              <>
                <span className="font-medium text-primary-800">{selectedStudent.fullName}</span>
                <span className="text-primary-700"> - {selectedStudent.studentCode}</span>
                <span className="text-primary-700"> - {selectedStudent.class?.name || 'Chưa có lớp'}</span>
              </>
            ) : (
              <span className="text-gray-500">Chọn học sinh từ bảng kết quả phía trên.</span>
            )}
          </div>
        </div>
        <div>
          <label className="label">Lớp đích</label>
          <select className="input" value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
            <option value="">Chọn lớp đích</option>
            {classes
              .filter((cls) => cls.id !== selectedStudent?.class?.id)
              .map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}{cls.grade?.name ? ` (${cls.grade.name})` : ''}</option>
              ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Lý do chuyển <span className="text-red-500">*</span></label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do chuyển lớp"
            required
          />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={transferring} className="btn-primary">
            {transferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
            Chuyển lớp
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Lịch sử chuyển lớp</h2>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Chưa có dữ liệu</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Học sinh</th>
                  <th className="table-header">Lớp cũ</th>
                  <th className="table-header">Lớp đích</th>
                  <th className="table-header">Thời gian</th>
                  <th className="table-header">Lý do chuyển</th>
                  <th className="table-header">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{item.student?.fullName || '-'}</div>
                      <div className="text-xs text-gray-500">{item.student?.studentCode || ''}</div>
                    </td>
                    <td className="table-cell">{item.fromClass?.name || '-'}</td>
                    <td className="table-cell">{item.toClass?.name || '-'}</td>
                    <td className="table-cell">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="table-cell">{item.reason || '-'}</td>
                    <td className="table-cell">{item.transferredByUser?.fullName || item.transferredBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
