'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { studentApi, classApi, scoreApi, subjectApi, academicYearApi } from '@/lib/api'
import { formatDate, getGenderLabel } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Loader2,
  User,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  GraduationCap,
  ArrowRightLeft,
  History,
  TrendingUp,
  Award,
  CheckCircle,
  XCircle,
  ClipboardEdit,
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
  createdAt: string
}

interface ScoreEntry {
  id: string
  value: number
  isLocked: boolean
  studentId: string
  subjectId: string
  semesterId: string
  scoreComponentId: string
  scoreComponent: { id: string; name: string; weight: number }
  subject: { id: string; name: string }
  semester: { id: string; name: string }
}

interface SubjectScore {
  subject: { id: string; name: string }
  scores: ScoreEntry[]
  average: number | null
  isPassed: boolean
}

interface Semester {
  id: string
  name: string
  isActive: boolean
}

interface ScoreData {
  subjectScores: SubjectScore[]
  overallAverage: number | null
  ranking: number | null
  totalStudents: number | null
}

export default function StudentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const isAdminOrStaff = isAdmin || user?.role === 'STAFF'
  const canEditScores = isAdminOrStaff || user?.role === 'TEACHER'

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferClassId, setTransferClassId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [allClasses, setAllClasses] = useState<Array<{ id: string; name: string; grade: { name: string } }>>([])
  const [transferHistory, setTransferHistory] = useState<Array<{
    id: string; reason: string | null; createdAt: string;
    fromClass: { name: string } | null; toClass: { name: string } | null;
  }>>([])

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [scoreData, setScoreData] = useState<ScoreData | null>(null)
  const [loadingScores, setLoadingScores] = useState(false)
  const [scoreView, setScoreView] = useState<'semester' | 'yearly'>('semester')
  const [yearlyData, setYearlyData] = useState<any>(null)
  const [loadingYearly, setLoadingYearly] = useState(false)
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; startYear: number; endYear: number }>>([])
  const [selectedYear, setSelectedYear] = useState('')

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const [response, historyRes, semRes, ayRes] = await Promise.all([
          studentApi.get(id as string),
          studentApi.getTransferHistory(id as string).catch(() => ({ data: { data: [] } })),
          subjectApi.getSemesters().catch(() => ({ data: { data: [] } })),
          academicYearApi.list().catch(() => ({ data: { data: [] } })),
        ])
        setStudent(response.data.data)
        setTransferHistory(historyRes.data.data || [])
        const sems = semRes.data.data || []
        setSemesters(sems)
        const active = sems.find((s: Semester) => s.isActive)
        if (active) setSelectedSemester(active.id)
        const ays = ayRes.data.data || []
        setAcademicYears(ays)
        if (ays.length > 0) setSelectedYear(`${ays[0].startYear}-${ays[0].endYear}`)
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

  const fetchScores = useCallback(async () => {
    if (!id) return
    setLoadingScores(true)
    try {
      const res = await scoreApi.getByStudent(id as string, selectedSemester || undefined)
      setScoreData(res.data.data)
    } catch {
      setScoreData(null)
    } finally {
      setLoadingScores(false)
    }
  }, [id, selectedSemester])

  useEffect(() => {
    if (student) fetchScores()
  }, [student, fetchScores])

  const fetchYearly = useCallback(async () => {
    if (!id || !selectedYear) return
    setLoadingYearly(true)
    try {
      const res = await scoreApi.getYearly(id as string, selectedYear)
      setYearlyData(res.data.data)
    } catch {
      setYearlyData(null)
    } finally {
      setLoadingYearly(false)
    }
  }, [id, selectedYear])

  useEffect(() => {
    if (student && scoreView === 'yearly') fetchYearly()
  }, [student, scoreView, fetchYearly])

  const handleTransfer = async () => {
    if (!transferClassId) { toast.error('Vui lòng chọn lớp'); return }
    try {
      setTransferring(true)
      await studentApi.transfer(id as string, { classId: transferClassId, reason: transferReason })
      toast.success('Chuyển lớp thành công')
      setShowTransfer(false)
      setTransferClassId('')
      setTransferReason('')
      const [res, hRes] = await Promise.all([
        studentApi.get(id as string),
        studentApi.getTransferHistory(id as string).catch(() => ({ data: { data: [] } })),
      ])
      setStudent(res.data.data)
      setTransferHistory(hRes.data.data || [])
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Chuyển lớp thất bại')
    } finally { setTransferring(false) }
  }

  const openTransfer = async () => {
    try {
      const res = await classApi.list()
      setAllClasses(res.data.data || [])
    } catch {}
    setShowTransfer(true)
  }

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

  const getGradeLabel = (avg: number | null) => {
    if (avg === null) return { label: '-', cls: 'text-gray-400' }
    if (avg >= 8.5) return { label: 'Giỏi', cls: 'text-green-600' }
    if (avg >= 6.5) return { label: 'Khá', cls: 'text-blue-600' }
    if (avg >= 5.0) return { label: 'Trung bình', cls: 'text-yellow-600' }
    return { label: 'Yếu', cls: 'text-red-600' }
  }

  const subjectScores = scoreData?.subjectScores || []
  const passedCount = subjectScores.filter(s => s.isPassed).length
  const failedCount = subjectScores.filter(s => !s.isPassed && s.average !== null).length

  // Collect all unique score component names across all subjects for consistent columns
  const allComponentNames = (() => {
    const seen = new Map<string, number>()
    subjectScores.forEach(item => {
      item.scores.forEach(s => {
        if (!seen.has(s.scoreComponent.name)) {
          seen.set(s.scoreComponent.name, s.scoreComponent.weight)
        }
      })
    })
    return Array.from(seen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name)
  })()

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
          {isAdminOrStaff && student.class && (
            <button onClick={openTransfer} className="btn-outline">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Chuyển lớp
            </button>
          )}
          {isAdminOrStaff && (
            <Link
              href={`/students/${student.id}/edit`}
              className="btn-outline"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Chỉnh sửa
            </Link>
          )}
          {isAdmin && (
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
          )}
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
        <div className="lg:col-span-2 space-y-6">
          {/* Transfer Modal */}
          {showTransfer && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="card p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">Chuyển lớp</h2>
                <div className="space-y-4">
                  <div>
                    <label className="label">Lớp hiện tại</label>
                    <input type="text" className="input bg-gray-50" readOnly
                      value={student.class ? `${student.class.name} (${student.class.grade.name})` : 'Chưa xếp lớp'} />
                  </div>
                  <div>
                    <label className="label">Chuyển đến lớp</label>
                    <select className="input" value={transferClassId} onChange={e => setTransferClassId(e.target.value)}>
                      <option value="">Chọn lớp</option>
                      {allClasses.filter(c => c.id !== student.class?.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.grade?.name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Lý do chuyển</label>
                    <textarea className="input" rows={2} placeholder="Nhập lý do..."
                      value={transferReason} onChange={e => setTransferReason(e.target.value)} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowTransfer(false)} className="btn-outline flex-1">Hủy</button>
                    <button onClick={handleTransfer} disabled={transferring} className="btn-primary flex-1">
                      {transferring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Chuyển lớp
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transfer History */}
          {transferHistory.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Lịch sử chuyển lớp
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {transferHistory.map(h => (
                  <div key={h.id} className="px-6 py-3 flex items-center gap-3">
                    <ArrowRightLeft className="w-4 h-4 text-purple-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{h.fromClass?.name || '?'}</span>
                        {' → '}
                        <span className="font-medium">{h.toClass?.name || '?'}</span>
                      </p>
                      {h.reason && <p className="text-xs text-gray-500">{h.reason}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score Section */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex border-b border-gray-100 -mb-4">
                <button
                  onClick={() => setScoreView('semester')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    scoreView === 'semester' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <BookOpen className="w-4 h-4 inline-block mr-2" />
                  Bảng điểm theo HK
                </button>
                <button
                  onClick={() => setScoreView('yearly')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    scoreView === 'yearly' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Award className="w-4 h-4 inline-block mr-2" />
                  BM7 - Bảng điểm cả năm
                </button>
              </div>
            </div>

            {scoreView === 'semester' ? (
            <>
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Bảng điểm
              </h3>
              <div className="flex items-center gap-3">
                <select
                  className="input py-1.5 text-sm w-48"
                  value={selectedSemester}
                  onChange={e => setSelectedSemester(e.target.value)}
                >
                  <option value="">Tất cả học kỳ</option>
                  {semesters.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.isActive ? ' (Hiện tại)' : ''}
                    </option>
                  ))}
                </select>
                {canEditScores && selectedSemester && (
                  <Link href={`/students/${id}/scores?semester=${selectedSemester}`} className="btn-outline py-1.5 text-sm whitespace-nowrap">
                    <ClipboardEdit className="w-4 h-4 mr-1.5" />
                    Sửa điểm
                  </Link>
                )}
              </div>
            </div>

            {loadingScores ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : subjectScores.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Chưa có dữ liệu điểm</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-blue-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-blue-600 font-medium">TB chung</span>
                      </div>
                      <p className="text-xl font-bold text-blue-700">
                        {scoreData?.overallAverage !== null && scoreData?.overallAverage !== undefined
                          ? scoreData.overallAverage.toFixed(2)
                          : '-'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-purple-600 font-medium">Xếp loại</span>
                      </div>
                      <p className={`text-xl font-bold ${getGradeLabel(scoreData?.overallAverage ?? null).cls}`}>
                        {getGradeLabel(scoreData?.overallAverage ?? null).label}
                      </p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-600 font-medium">Môn đạt</span>
                      </div>
                      <p className="text-xl font-bold text-green-700">
                        {passedCount}/{subjectScores.length}
                      </p>
                    </div>
                    {scoreData?.ranking && selectedSemester ? (
                      <div className="rounded-lg bg-amber-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Award className="w-4 h-4 text-amber-500" />
                          <span className="text-xs text-amber-600 font-medium">Xếp hạng</span>
                        </div>
                        <p className="text-xl font-bold text-amber-700">
                          {scoreData.ranking}/{scoreData.totalStudents}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-red-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-xs text-red-600 font-medium">Môn chưa đạt</span>
                        </div>
                        <p className="text-xl font-bold text-red-700">
                          {failedCount}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Score Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="table-header whitespace-nowrap">Môn học</th>
                        {selectedSemester && allComponentNames.map(name => (
                          <th key={name} className="table-header text-center whitespace-nowrap">{name}</th>
                        ))}
                        <th className="table-header text-center whitespace-nowrap">TB môn</th>
                        <th className="table-header text-center whitespace-nowrap">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {subjectScores.map(item => {
                        const scoreMap = selectedSemester
                          ? new Map(item.scores.map(s => [s.scoreComponent.name, s.value]))
                          : null
                        return (
                          <tr key={item.subject.id} className="hover:bg-gray-50">
                            <td className="table-cell font-medium text-gray-900 whitespace-nowrap">
                              {item.subject.name}
                            </td>
                            {selectedSemester && scoreMap && allComponentNames.map(name => {
                              const value = scoreMap.get(name)
                              return (
                                <td key={name} className="table-cell text-center">
                                  {value !== undefined ? (
                                    <span className={`font-semibold ${value >= 5 ? 'text-gray-900' : 'text-red-600'}`}>
                                      {value.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="table-cell text-center">
                              {item.average !== null ? (
                                <span className={`text-base font-bold ${item.isPassed ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.average.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="table-cell text-center">
                              {item.average !== null ? (
                                item.isPassed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    <CheckCircle className="w-3 h-3" />
                                    Đạt
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                    <XCircle className="w-3 h-3" />
                                    Chưa đạt
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            </>
            ) : (
            /* Yearly Score View - BM7 */
            <div>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Năm học:</label>
                <select
                  className="input py-1.5 text-sm w-48"
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                >
                  {academicYears.map(ay => (
                    <option key={ay.id} value={`${ay.startYear}-${ay.endYear}`}>
                      {ay.startYear}-{ay.endYear}
                    </option>
                  ))}
                </select>
              </div>

              {loadingYearly ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !yearlyData || yearlyData.subjects.length === 0 ? (
                <div className="p-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Chưa có dữ liệu điểm cả năm</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="table-header">STT</th>
                        <th className="table-header">Môn học</th>
                        <th className="table-header text-center">HK I</th>
                        <th className="table-header text-center">HK II</th>
                        <th className="table-header text-center">TB cả năm</th>
                        <th className="table-header text-center">Đạt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {yearlyData.subjects.map((s: any, idx: number) => (
                        <tr key={s.subject.id} className="hover:bg-gray-50">
                          <td className="table-cell text-center">{idx + 1}</td>
                          <td className="table-cell font-medium">{s.subject.name}</td>
                          <td className="table-cell text-center">
                            {s.semester1Average != null ? (
                              <span className={s.semester1Average >= 5 ? 'text-gray-900' : 'text-red-600'}>{s.semester1Average.toFixed(2)}</span>
                            ) : '-'}
                          </td>
                          <td className="table-cell text-center">
                            {s.semester2Average != null ? (
                              <span className={s.semester2Average >= 5 ? 'text-gray-900' : 'text-red-600'}>{s.semester2Average.toFixed(2)}</span>
                            ) : '-'}
                          </td>
                          <td className="table-cell text-center font-bold">
                            {s.yearlyAverage != null ? (
                              <span className={s.yearlyAverage >= 5 ? 'text-green-600' : 'text-red-600'}>{s.yearlyAverage.toFixed(2)}</span>
                            ) : '-'}
                          </td>
                          <td className="table-cell text-center">
                            {s.isPassed != null ? (
                              s.isPassed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" /> Đạt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <XCircle className="w-3 h-3" /> Chưa đạt
                                </span>
                              )
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                        <td className="table-cell" colSpan={2}>Tổng TB</td>
                        <td className="table-cell text-center">{yearlyData.overallSemester1 != null ? yearlyData.overallSemester1.toFixed(2) : '-'}</td>
                        <td className="table-cell text-center">{yearlyData.overallSemester2 != null ? yearlyData.overallSemester2.toFixed(2) : '-'}</td>
                        <td className="table-cell text-center">{yearlyData.overallYearly != null ? yearlyData.overallYearly.toFixed(2) : '-'}</td>
                        <td className="table-cell"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
