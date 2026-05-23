'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { classApi, promotionApi, reportApi, subjectApi, academicYearApi } from '@/lib/api'
import { BarChart3, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'bm1' | 'bm2' | 'bm3' | 'bm4' | 'promotion'

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('bm1')
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [subjects, setSubjects] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const [classId, setClassId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [data, setData] = useState<any>(null)
  const semesterIdRef = useRef('')

  const [results, setResults] = useState<{ passStudents: any[]; failStudents: any[] } | null>(null)
  const [missingDetails, setMissingDetails] = useState<any[]>([])
  const [passAssign, setPassAssign] = useState<Record<string, string>>({})
  const [failAssign, setFailAssign] = useState<Record<string, string>>({})

  useEffect(() => {
    semesterIdRef.current = semesterId
  }, [semesterId])

  const refreshSemesters = useCallback(async (options?: { notifyIfSelectionMissing?: boolean }) => {
    const semesterRes = await subjectApi.getSemesters()
    const nextSemesters = semesterRes.data.data || []
    const currentSemesterId = semesterIdRef.current

    setSemesters(nextSemesters)

    if (currentSemesterId && !nextSemesters.some((semester: any) => semester.id === currentSemesterId)) {
      setSemesterId('')
      if (options?.notifyIfSelectionMissing) {
        toast.error('Học kỳ đang chọn đã bị xóa hoặc không còn khả dụng. Vui lòng chọn lại học kỳ.')
      }
      return nextSemesters
    }

    if (!currentSemesterId && nextSemesters.length > 0) {
      setSemesterId(nextSemesters.find((semester: any) => semester.isActive)?.id || nextSemesters[0].id)
    }

    return nextSemesters
  }, [])

  useEffect(() => {
    Promise.all([subjectApi.list(), classApi.list(), academicYearApi.list(), refreshSemesters()])
      .then(([subjectRes, classRes, yearRes, sems]) => {
        setSubjects(subjectRes.data.data || [])
        setClasses(classRes.data.data || [])
        setYears(yearRes.data.data || [])
        const ys = yearRes.data.data || []
        if (ys.length > 0) setAcademicYearId((ys.find((y: any) => y.isActive) || ys[0]).id)
      })
      .catch(() => toast.error('Không thể tải dữ liệu báo cáo'))
      .finally(() => setLoading(false))
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

  const loadReport = async () => {
    try {
      setLoadingReport(true)
      setData(null)
      if (tab === 'bm1') {
        if (!subjectId || !semesterId) return toast.error('Chọn môn học và học kỳ')
        const res = await reportApi.subjectSummary(subjectId, semesterId)
        setData(res.data.data)
      } else if (tab === 'bm2') {
        if (!classId || !semesterId) return toast.error('Chọn lớp và học kỳ')
        const res = await reportApi.classPromotionSummary(classId, semesterId)
        setData(res.data.data)
      } else if (tab === 'bm3') {
        if (!semesterId) return toast.error('Chọn học kỳ')
        const res = await reportApi.semesterPromotionSummary(semesterId)
        setData(res.data.data)
      } else if (tab === 'bm4') {
        if (!academicYearId) return toast.error('Chọn năm học')
        const res = await reportApi.yearPromotionSummary(academicYearId)
        setData(res.data.data)
      }
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'NOT_FOUND') {
        await refreshSemesters({ notifyIfSelectionMissing: true })
        return
      }
      toast.error(error.response?.data?.error?.message || 'Không thể tải báo cáo')
    } finally {
      setLoadingReport(false)
    }
  }

  const evaluatePromotion = async () => {
    if (!academicYearId) return toast.error('Chọn năm học')
    setMissingDetails([])
    setResults(null)
    try {
      await promotionApi.evaluateYearEnd({ academicYearId, classId: classId || undefined })
      const res = await promotionApi.getYearEndResults({ academicYearId, classId: classId || undefined })
      setResults(res.data.data)
      toast.success('Đã xét lên lớp')
    } catch (error: any) {
      const err = error.response?.data?.error
      if (err?.code === 'MISSING_SCORES') {
        setMissingDetails(err.details || [])
      }
      toast.error(err?.message || 'Xét lên lớp thất bại')
    }
  }

  const executePromotion = async () => {
    if (!academicYearId || !results) return
    try {
      const passAssignments = results.passStudents
        .filter((item) => passAssign[item.studentId])
        .map((item) => ({ studentId: item.studentId, toClassId: passAssign[item.studentId] }))
      const failAssignments = results.failStudents
        .filter((item) => failAssign[item.studentId])
        .map((item) => ({ studentId: item.studentId, toClassId: failAssign[item.studentId] }))

      const res = await promotionApi.executeYearEnd({ academicYearId, passAssignments, failAssignments })
      toast.success(`Hoàn tất xét lên lớp: ${res.data.data.summary.promoted} lên lớp, ${res.data.data.summary.archived} lưu trữ`)
      const re = await promotionApi.getYearEndResults({ academicYearId, classId: classId || undefined })
      setResults(re.data.data)
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thực thi xét lên lớp thất bại')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo tổng kết</h1>
        <p className="text-sm text-gray-600 mt-1">BM1/BM2/BM3/BM4 và xét lên lớp đồng bộ</p>
      </div>

      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button className={`btn-outline ${tab === 'bm1' ? 'bg-gray-100' : ''}`} onClick={() => setTab('bm1')}>BM1</button>
          <button className={`btn-outline ${tab === 'bm2' ? 'bg-gray-100' : ''}`} onClick={() => setTab('bm2')}>BM2</button>
          <button className={`btn-outline ${tab === 'bm3' ? 'bg-gray-100' : ''}`} onClick={() => setTab('bm3')}>BM3</button>
          <button className={`btn-outline ${tab === 'bm4' ? 'bg-gray-100' : ''}`} onClick={() => setTab('bm4')}>BM4</button>
          <button className={`btn-outline ${tab === 'promotion' ? 'bg-gray-100' : ''}`} onClick={() => setTab('promotion')}>Xét lên lớp</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(tab === 'bm1') && (
            <div>
              <label className="label">Môn học</label>
              <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Chọn môn</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </div>
          )}

          {(tab === 'bm2' || tab === 'promotion') && (
            <div>
              <label className="label">Lớp</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
          )}

          {(tab === 'bm1' || tab === 'bm2' || tab === 'bm3') && (
            <div>
              <label className="label">Học kỳ</label>
              <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                <option value="">Chọn học kỳ</option>
                {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
              </select>
            </div>
          )}

          {(tab === 'bm4' || tab === 'promotion') && (
            <div>
              <label className="label">Năm học</label>
              <select className="input" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
                <option value="">Chọn năm học</option>
                {years.map((year) => <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>)}
              </select>
            </div>
          )}
        </div>

        {tab !== 'promotion' ? (
          <button onClick={loadReport} disabled={loadingReport} className="btn-primary">
            {loadingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
            Xem báo cáo
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={evaluatePromotion} className="btn-primary">Xét lên lớp</button>
            {results && <button onClick={executePromotion} className="btn-outline">Thực thi lên lớp</button>}
          </div>
        )}
      </div>

      {tab !== 'promotion' && data && (
        <div className="card p-4">
          <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      {tab === 'promotion' && missingDetails.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-red-700 mb-2">Thiếu điểm, chưa thể xét lên lớp</h3>
          <div className="space-y-1 text-sm">
            {missingDetails.slice(0, 50).map((item, idx) => (
              <p key={idx}>
                {item.studentName} ({item.studentCode}) - {item.subjectName} - {item.semesterName}: thiếu {item.missingComponents?.join(', ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {tab === 'promotion' && results && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Đạt (PASS)</h3>
            <div className="space-y-2">
              {results.passStudents.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <span className="text-sm flex-1">{item.student.fullName} ({item.class.name})</span>
                  <select className="input max-w-[220px]" value={passAssign[item.studentId] || ''} onChange={(e) => setPassAssign((prev) => ({ ...prev, [item.studentId]: e.target.value }))}>
                    <option value="">Chọn lớp đích</option>
                    {classes.filter((c) => c.id !== item.classId).map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Không đạt (FAIL) - xếp lớp riêng</h3>
            <div className="space-y-2">
              {results.failStudents.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <span className="text-sm flex-1">{item.student.fullName} ({item.class.name})</span>
                  <select className="input max-w-[220px]" value={failAssign[item.studentId] || ''} onChange={(e) => setFailAssign((prev) => ({ ...prev, [item.studentId]: e.target.value }))}>
                    <option value="">Chọn lớp đích</option>
                    {classes.filter((c) => c.id !== item.classId).map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
