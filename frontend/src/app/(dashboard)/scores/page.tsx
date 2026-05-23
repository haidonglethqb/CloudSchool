'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { classApi, subjectApi, scoreApi, scoreComponentApi, settingsApi, exportApi, downloadBlob } from '@/lib/api'
import { formatDateTime, getPassStatus, getSemesterEntryStatus, getSemesterScheduleStatus } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { Save, Loader2, AlertCircle, CheckCircle, Lock, Unlock, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface Class {
  id: string
  name: string
  grade: { name: string }
}

interface Subject {
  id: string
  name: string
  code: string
}

interface Semester {
  id: string
  name: string
  isActive: boolean
  startDate?: string | null
  endDate?: string | null
}

interface ScoreComponent {
  id: string
  name: string
  weight: number
}

interface ScoreEntry {
  id?: string
  scoreComponentId: string
  value: number | null
  isLocked: boolean
}

interface StudentRow {
  studentId: string
  studentCode: string
  fullName: string
  scores: Record<string, ScoreEntry>
  average: number | null
}

interface ScoreHistoryEntry {
  id: string
  studentId: string
  studentCode: string | null
  studentName: string
  scoreComponentName: string
  action: string
  oldValue: number | null
  newValue: number | null
  actorName: string
  actorRole: string
  createdAt: string
}

export default function ScoresPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [passScore, setPassScore] = useState(5)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [components, setComponents] = useState<ScoreComponent[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [historyEntries, setHistoryEntries] = useState<ScoreHistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingScores, setLoadingScores] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedScores, setEditedScores] = useState<
    Map<string, { studentId: string; scoreComponentId: string; value: number }>
  >(new Map())
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN' || user?.role === 'STAFF'
  const now = new Date()
  const selectedSemesterRef = useRef('')
  const selectedSemesterMeta = semesters.find((semester) => semester.id === selectedSemester)
  const isSemesterOpenForEntry = Boolean(selectedSemesterMeta?.isActive)

  const selectedSemesterEntryStatus = selectedSemesterMeta ? getSemesterEntryStatus(selectedSemesterMeta) : null
  const selectedSemesterScheduleStatus = selectedSemesterMeta ? getSemesterScheduleStatus(selectedSemesterMeta, now) : null

  useEffect(() => {
    selectedSemesterRef.current = selectedSemester
  }, [selectedSemester])

  const refreshSemesters = useCallback(async (options?: { notifyIfSelectionMissing?: boolean }) => {
    const semestersRes = await subjectApi.getSemesters()
    const nextSemesters = semestersRes.data.data || []
    const currentSemesterId = selectedSemesterRef.current

    setSemesters(nextSemesters)

    if (currentSemesterId && !nextSemesters.some((semester: Semester) => semester.id === currentSemesterId)) {
      setSelectedSemester('')
      setStudents([])
      setEditedScores(new Map())
      if (options?.notifyIfSelectionMissing) {
        toast.error('Học kỳ đang chọn đã bị xóa hoặc không còn khả dụng. Vui lòng chọn lại học kỳ.')
      }
      return nextSemesters
    }

    if (!currentSemesterId) {
      const activeSem = nextSemesters.find((semester: Semester) => semester.isActive)
      if (activeSem) {
        setSelectedSemester(activeSem.id)
      }
    }

    return nextSemesters
  }, [])

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [classesRes, subjectsRes, settingsRes] = await Promise.all([
          classApi.list(), subjectApi.list(), settingsApi.get(),
        ])
        setClasses(classesRes.data.data)
        setSubjects(subjectsRes.data.data)
        setPassScore(settingsRes.data.data?.passScore ?? 5)

        await refreshSemesters()
      } catch {
        toast.error('Không thể tải dữ liệu ban đầu')
      } finally { setLoading(false) }
    }
    fetchInitialData()
  }, [refreshSemesters])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSemesters({ notifyIfSelectionMissing: true }).catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshSemesters])

  // Load score components when subject changes
  useEffect(() => {
    if (!selectedSubject) { setComponents([]); return }
    scoreComponentApi.list(selectedSubject)
      .then(res => setComponents(res.data.data || []))
      .catch(() => setComponents([]))
  }, [selectedSubject])

  const fetchScores = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !selectedSemester) { setStudents([]); return }
    try {
      setLoadingScores(true)
      const response = await scoreApi.getByClass(selectedClass, selectedSubject, selectedSemester)
      const data = response.data.data
      const rows = (data.students || data || []).map((item: any) => {
        const st = item.student || item
        const scoreMap: Record<string, ScoreEntry> = {}
        const rawScores = item.scores || []
        if (Array.isArray(rawScores)) {
          rawScores.forEach((s: any) => {
            scoreMap[s.scoreComponentId || s.scoreComponent?.id] = {
              id: s.id,
              scoreComponentId: s.scoreComponentId || s.scoreComponent?.id,
              value: s.value,
              isLocked: s.isLocked || false,
            }
          })
        }
        return {
          studentId: st.id || item.studentId,
          studentCode: st.studentCode || item.studentCode,
          fullName: st.fullName || item.fullName,
          scores: scoreMap,
          average: item.average ?? null,
        }
      })
      setStudents(rows)
      setEditedScores(new Map())
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'NOT_FOUND') {
        await refreshSemesters({ notifyIfSelectionMissing: true })
        return
      }
      toast.error('Không thể tải điểm')
    } finally { setLoadingScores(false) }
  }, [selectedClass, selectedSubject, selectedSemester, refreshSemesters])

  useEffect(() => { fetchScores() }, [fetchScores])

  useEffect(() => {
    setHistoryPage(1)
  }, [selectedClass, selectedSubject, selectedSemester])

  const fetchHistory = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !selectedSemester) {
      setHistoryEntries([])
      setHistoryTotalPages(1)
      return
    }

    try {
      setLoadingHistory(true)
      const response = await scoreApi.history({
        classId: selectedClass,
        subjectId: selectedSubject,
        semesterId: selectedSemester,
        page: historyPage,
        limit: 10,
      })
      setHistoryEntries(response.data.data || [])
      setHistoryTotalPages(response.data.meta?.totalPages || 1)
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'NOT_FOUND') {
        await refreshSemesters({ notifyIfSelectionMissing: true })
        return
      }
      toast.error('Không thể tải lịch sử nhập điểm')
    } finally {
      setLoadingHistory(false)
    }
  }, [selectedClass, selectedSubject, selectedSemester, historyPage, refreshSemesters])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const calcAverage = (scores: Record<string, ScoreEntry>) => {
    let totalW = 0, totalV = 0
    components.forEach(c => {
      const entry = scores[c.id]
      if (entry && entry.value !== null && entry.value !== undefined) {
        totalW += c.weight
        totalV += entry.value * c.weight
      }
    })
    return totalW > 0 ? totalV / totalW : null
  }

  const handleScoreChange = (studentId: string, compId: string, value: string) => {
    const numValue = parseFloat(value)
    if (value !== '' && (isNaN(numValue) || numValue < 0 || numValue > 10)) return

    setStudents(prev => prev.map(st => {
      if (st.studentId !== studentId) return st
      const newScores = { ...st.scores }
      newScores[compId] = {
        ...newScores[compId],
        scoreComponentId: compId,
        value: value === '' ? null : numValue,
        isLocked: newScores[compId]?.isLocked || false,
      }
      return { ...st, scores: newScores, average: calcAverage(newScores) }
    }))

    if (value !== '' && !isNaN(numValue)) {
      const key = `${studentId}-${compId}`
      setEditedScores(prev => {
        const m = new Map(prev)
        m.set(key, { studentId, scoreComponentId: compId, value: numValue })
        return m
      })
    }
  }

  const handleSave = async () => {
    if (editedScores.size === 0) { toast.error('Không có thay đổi để lưu'); return }
    if (!isSemesterOpenForEntry) {
      toast.error('Học kỳ này đang đóng nhập điểm. Hãy kích hoạt học kỳ ở phần Năm học & Học kỳ')
      return
    }
    try {
      setSaving(true)
      const scores = Array.from(editedScores.values()).map(s => ({
        ...s,
        subjectId: selectedSubject,
        semesterId: selectedSemester,
      }))
      await scoreApi.batchSave(scores)
      toast.success('Lưu điểm thành công')
      setEditedScores(new Map())
      fetchScores()
      fetchHistory()
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'SEMESTER_CLOSED') {
        toast.error('Học kỳ này đang đóng nhập điểm. Hãy kích hoạt học kỳ ở phần Năm học & Học kỳ')
        return
      }
      if (err.response?.data?.error?.code === 'NOT_FOUND') {
        await refreshSemesters({ notifyIfSelectionMissing: true })
        return
      }
      toast.error(err.response?.data?.error?.message || 'Lưu điểm thất bại')
    } finally { setSaving(false) }
  }

  const handleLock = async (scoreId: string) => {
    try {
      await scoreApi.lock(scoreId)
      toast.success('Đã khóa điểm')
      fetchScores()
      fetchHistory()
    } catch { toast.error('Lỗi khóa điểm') }
  }

  const handleUnlock = async (scoreId: string) => {
    try {
      await scoreApi.unlock(scoreId)
      toast.success('Đã mở khóa điểm')
      fetchScores()
      fetchHistory()
    } catch { toast.error('Lỗi mở khóa điểm') }
  }

  const handleLockClass = async () => {
    if (!selectedClass) return
    try {
      await scoreApi.lockClass(selectedClass, { subjectId: selectedSubject, semesterId: selectedSemester })
      toast.success('Đã khóa điểm cả lớp')
      fetchScores()
      fetchHistory()
    } catch { toast.error('Lỗi khóa điểm lớp') }
  }

  const handleUnlockClass = async () => {
    if (!selectedClass) return
    try {
      await scoreApi.unlockClass(selectedClass, { subjectId: selectedSubject, semesterId: selectedSemester })
      toast.success('Đã mở khóa điểm cả lớp')
      fetchScores()
      fetchHistory()
    } catch { toast.error('Lỗi mở khóa điểm lớp') }
  }

  const getHistoryActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-700'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-700'
      case 'LOCK':
        return 'bg-amber-100 text-amber-700'
      case 'UNLOCK':
        return 'bg-violet-100 text-violet-700'
      case 'DELETE':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  const hasChanges = editedScores.size > 0
  const totalWeight = components.reduce((s, c) => s + c.weight, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhập điểm môn học</h1>
          <p className="text-gray-600 text-sm mt-1">Nhập và quản lý điểm theo cột điểm (ScoreComponent)</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && selectedClass && selectedSubject && selectedSemester && (
            <>
              <button onClick={handleLockClass} disabled={!isSemesterOpenForEntry} className="btn-outline text-yellow-600 border-yellow-300 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <Lock className="w-4 h-4 mr-1" /> Khóa lớp
              </button>
              <button onClick={handleUnlockClass} disabled={!isSemesterOpenForEntry} className="btn-outline text-green-600 border-green-300 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <Unlock className="w-4 h-4 mr-1" /> Mở khóa lớp
              </button>
            </>
          )}
          {selectedClass && selectedSubject && selectedSemester && (
            <button
              onClick={async () => {
                try {
                  const res = await exportApi.scores({ format: 'excel', classId: selectedClass, subjectId: selectedSubject, semesterId: selectedSemester })
                  downloadBlob(res.data, 'bang-diem.xlsx')
                  toast.success('Xuất file thành công')
                } catch { toast.error('Xuất file thất bại') }
              }}
              className="btn-outline"
            >
              <Download className="w-4 h-4 mr-1" /> Xuất
            </button>
          )}
          <button onClick={handleSave} disabled={!hasChanges || saving || !isSemesterOpenForEntry} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Lưu điểm ({editedScores.size})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Lớp</label>
            <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Chọn lớp</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade.name})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Môn học</label>
            <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              <option value="">Chọn môn</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Học kỳ</label>
            <select className="input" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
              <option value="">Chọn học kỳ</option>
              {semesters.map((semester) => {
                const entryStatus = getSemesterEntryStatus(semester)
                const scheduleStatus = getSemesterScheduleStatus(semester, now)
                return (
                  <option key={semester.id} value={semester.id}>
                    {semester.name} - {entryStatus.label} | {scheduleStatus.label}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        {selectedSemesterMeta && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${selectedSemesterEntryStatus?.className}`}>
                Nhập điểm: {selectedSemesterEntryStatus?.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${selectedSemesterScheduleStatus?.className}`}>
                Lịch học kỳ: {selectedSemesterScheduleStatus?.label}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {selectedSemesterMeta.startDate && selectedSemesterMeta.endDate
                ? `Thời gian học kỳ: ${new Date(selectedSemesterMeta.startDate).toLocaleDateString('vi-VN')} - ${new Date(selectedSemesterMeta.endDate).toLocaleDateString('vi-VN')}`
                : 'Học kỳ này chưa cấu hình ngày bắt đầu và ngày kết thúc.'}
            </p>
            {!isSemesterOpenForEntry && (
              <p className="mt-2 text-sm text-amber-700">Học kỳ này đang đóng nhập điểm. Muốn nhập điểm thì vào Năm học & Học kỳ để kích hoạt.</p>
            )}
          </div>
        )}
      </div>

      {/* Score Table */}
      {!selectedClass || !selectedSubject || !selectedSemester ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Vui lòng chọn lớp, môn học và học kỳ để nhập điểm</p>
        </div>
      ) : loadingScores ? (
        <div className="card p-8 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" /></div>
      ) : components.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Môn học chưa có cột điểm. Vui lòng cấu hình cột điểm trong trang Môn học.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Lớp này không có học sinh</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">STT</th>
                  <th className="table-header">Mã HS</th>
                  <th className="table-header">Họ và tên</th>
                  {components.map(c => (
                    <th key={c.id} className="table-header text-center">
                      <div>{c.name}</div>
                      <div className="text-xs font-normal text-gray-400">{c.weight}%</div>
                    </th>
                  ))}
                  <th className="table-header text-center">TB</th>
                  <th className="table-header text-center">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((st, idx) => {
                  const result = st.average !== null ? getPassStatus(st.average, passScore) : null
                  return (
                    <tr key={st.studentId} className="hover:bg-gray-50">
                      <td className="table-cell text-center">{idx + 1}</td>
                      <td className="table-cell font-mono text-xs">{st.studentCode}</td>
                      <td className="table-cell font-medium">{st.fullName}</td>
                      {components.map(c => {
                        const entry = st.scores[c.id]
                        const isLocked = entry?.isLocked
                        return (
                          <td key={c.id} className="px-1 py-1">
                            <div className="flex items-center gap-0.5">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                disabled={isLocked || !isSemesterOpenForEntry}
                                className={`w-14 px-1 py-1 text-center text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary ${isLocked ? 'bg-gray-100 text-gray-400 border-gray-200' : 'border-gray-200'}`}
                                value={entry?.value ?? ''}
                                onChange={e => handleScoreChange(st.studentId, c.id, e.target.value)}
                              />
                              {entry?.id && !isLocked && (
                                <button onClick={() => handleLock(entry.id!)} className="p-0.5 text-gray-300 hover:text-yellow-500" title="Khóa điểm">
                                  <Lock className="w-3 h-3" />
                                </button>
                              )}
                              {isLocked && isAdmin && entry?.id && (
                                <button onClick={() => handleUnlock(entry.id!)} className="p-0.5 text-yellow-500 hover:text-green-500" title="Mở khóa điểm">
                                  <Unlock className="w-3 h-3" />
                                </button>
                              )}
                              {isLocked && !isAdmin && <Lock className="w-3 h-3 text-yellow-500" />}
                            </div>
                          </td>
                        )
                      })}
                      <td className="table-cell text-center font-semibold">
                        {st.average !== null ? st.average.toFixed(2) : '-'}
                      </td>
                      <td className="table-cell text-center">
                        {result && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${result.color}`}>
                            {result.passed ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {result.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm text-gray-600">
            <p>
              <span className="font-medium">Điểm:</span> 0 - 10 |{' '}
              <span className="font-medium">Đạt:</span> TB ≥ {passScore} |{' '}
              <span className="font-medium">Tổng trọng số:</span>{' '}
              <span className={totalWeight === 100 ? 'text-green-600' : 'text-red-600'}>{totalWeight}%</span> |{' '}
              <span className="font-medium">Công thức:</span> TB = Σ(điểm × trọng số) / Σ trọng số
            </p>
          </div>
        </div>
      )}

      {selectedClass && selectedSubject && selectedSemester && (
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900">Lịch sử nhập và sửa điểm</h2>
            <p className="mt-1 text-sm text-gray-600">Hiển thị theo bộ lọc hiện tại: lớp, môn học và học kỳ đang chọn.</p>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : historyEntries.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">Chưa có lịch sử nhập hoặc sửa điểm cho bộ lọc hiện tại.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="table-header">Học sinh</th>
                      <th className="table-header">Đầu điểm</th>
                      <th className="table-header text-center">Thao tác</th>
                      <th className="table-header text-center">Giá trị</th>
                      <th className="table-header">Người sửa</th>
                      <th className="table-header">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <div className="font-medium text-gray-900">{entry.studentName}</div>
                          {entry.studentCode && <div className="text-xs text-gray-500">{entry.studentCode}</div>}
                        </td>
                        <td className="table-cell">{entry.scoreComponentName}</td>
                        <td className="table-cell text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getHistoryActionBadge(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="table-cell text-center text-sm text-gray-700">
                          {entry.oldValue !== null ? entry.oldValue.toFixed(1) : '-'} {'->'} {entry.newValue !== null ? entry.newValue.toFixed(1) : '-'}
                        </td>
                        <td className="table-cell">
                          <div className="font-medium text-gray-900">{entry.actorName}</div>
                          <div className="text-xs text-gray-500">{entry.actorRole}</div>
                        </td>
                        <td className="table-cell text-sm text-gray-600">{formatDateTime(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {historyTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3">
                  <button
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={historyPage === 1}
                    className="rounded border p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-600">Trang {historyPage} / {historyTotalPages}</span>
                  <button
                    onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                    disabled={historyPage === historyTotalPages}
                    className="rounded border p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
