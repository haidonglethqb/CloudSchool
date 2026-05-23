'use client'

import { useCallback, useEffect, useState } from 'react'
import { academicYearApi, classApi, promotionApi, reportApi, subjectApi } from '@/lib/api'
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  Loader2,
  School,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

type ReportKey = 'subjectPass' | 'classPromotion' | 'semesterPromotion' | 'yearPromotion'

type ReportFiltersState = {
  subjectPass: { subjectId: string; semesterId: string }
  classPromotion: { classId: string; semesterId: string }
  semesterPromotion: { semesterId: string }
  yearPromotion: { academicYearId: string }
}

type ReportDataState = Record<ReportKey, any | null>
type ReportLoadingState = Record<ReportKey, boolean>

const EMPTY_REPORT_FILTERS: ReportFiltersState = {
  subjectPass: { subjectId: '', semesterId: '' },
  classPromotion: { classId: '', semesterId: '' },
  semesterPromotion: { semesterId: '' },
  yearPromotion: { academicYearId: '' },
}

const EMPTY_REPORT_DATA: ReportDataState = {
  subjectPass: null,
  classPromotion: null,
  semesterPromotion: null,
  yearPromotion: null,
}

const EMPTY_REPORT_LOADING: ReportLoadingState = {
  subjectPass: false,
  classPromotion: false,
  semesterPromotion: false,
  yearPromotion: false,
}

const REPORT_META: Record<
  ReportKey,
  {
    title: string
    description: string
    accent: string
    icon: any
    cta: string
    emptyTitle: string
    emptyDescription: string
  }
> = {
  subjectPass: {
    title: 'Tỷ lệ học sinh đạt theo môn học',
    description: 'Thống kê tỉ lệ học sinh đạt của một môn học trong một học kỳ.',
    accent: 'from-emerald-500/20 via-white to-emerald-50',
    icon: BookOpen,
    cta: 'Xem báo cáo môn học',
    emptyTitle: 'Chưa có báo cáo môn học',
    emptyDescription: 'Chọn môn học và học kỳ ở board phía trên để xem tỷ lệ đạt và điểm trung bình theo lớp.',
  },
  classPromotion: {
    title: 'Tỷ lệ học sinh lên lớp theo lớp',
    description: 'Thống kê tỉ lệ học sinh lên lớp của một lớp trong một học kỳ.',
    accent: 'from-sky-500/20 via-white to-sky-50',
    icon: School,
    cta: 'Xem báo cáo theo lớp',
    emptyTitle: 'Chưa có báo cáo theo lớp',
    emptyDescription: 'Chọn lớp và học kỳ để xem tỷ lệ lên lớp, số đạt và danh sách học sinh.',
  },
  semesterPromotion: {
    title: 'Tỷ lệ học sinh lên lớp theo học kỳ',
    description: 'Thống kê tỉ lệ học sinh lên lớp của toàn trường trong một học kỳ.',
    accent: 'from-amber-500/20 via-white to-amber-50',
    icon: CalendarRange,
    cta: 'Xem báo cáo học kỳ',
    emptyTitle: 'Chưa có báo cáo học kỳ',
    emptyDescription: 'Chọn học kỳ để xem tổng quan lên lớp theo từng lớp trong học kỳ đó.',
  },
  yearPromotion: {
    title: 'Tỷ lệ học sinh lên lớp theo năm học',
    description: 'Thống kê tỉ lệ học sinh lên lớp của toàn trường trong cả năm học.',
    accent: 'from-rose-500/20 via-white to-rose-50',
    icon: GraduationCap,
    cta: 'Xem báo cáo năm học',
    emptyTitle: 'Chưa có báo cáo năm học',
    emptyDescription: 'Chọn năm học để xem tỷ lệ lên lớp theo từng khối và bức tranh tổng thể của năm học.',
  },
}

function formatRate(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
  return `${value.toFixed(2).replace(/\.00$/, '')}%`
}

function formatAverage(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return value.toFixed(2).replace(/\.00$/, '')
}

function formatAcademicYearLabel(year?: any) {
  if (!year) return 'Chưa chọn năm học'
  return `${year.startYear}-${year.endYear}`
}

function SummaryStat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

function RateBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  )
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [reportFilters, setReportFilters] = useState<ReportFiltersState>(EMPTY_REPORT_FILTERS)
  const [reportData, setReportData] = useState<ReportDataState>(EMPTY_REPORT_DATA)
  const [reportLoading, setReportLoading] = useState<ReportLoadingState>(EMPTY_REPORT_LOADING)
  const [activeDetailReport, setActiveDetailReport] = useState<ReportKey>('subjectPass')

  const [promotionFilters, setPromotionFilters] = useState({ classId: '', academicYearId: '' })
  const [promotionLoading, setPromotionLoading] = useState(false)
  const [promotionResults, setPromotionResults] = useState<{ passStudents: any[]; failStudents: any[] } | null>(null)
  const [missingDetails, setMissingDetails] = useState<any[]>([])
  const [passAssign, setPassAssign] = useState<Record<string, string>>({})
  const [failAssign, setFailAssign] = useState<Record<string, string>>({})

  const scrollToPromotionSection = () => {
    document.getElementById('promotion-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const refreshSemesters = useCallback(async (options?: { notifyIfSelectionMissing?: boolean }) => {
    const semesterRes = await subjectApi.getSemesters()
    const nextSemesters = semesterRes.data.data || []
    const nextDefaultSemesterId = nextSemesters.find((semester: any) => semester.isActive)?.id || nextSemesters[0]?.id || ''
    const validSemesterIds = new Set(nextSemesters.map((semester: any) => semester.id))
    let selectionWasCleared = false

    setSemesters(nextSemesters)
    setReportFilters((prev) => {
      const next = {
        subjectPass: { ...prev.subjectPass },
        classPromotion: { ...prev.classPromotion },
        semesterPromotion: { ...prev.semesterPromotion },
        yearPromotion: { ...prev.yearPromotion },
      }

      if (next.subjectPass.semesterId && !validSemesterIds.has(next.subjectPass.semesterId)) {
        next.subjectPass.semesterId = ''
        selectionWasCleared = true
      }
      if (next.classPromotion.semesterId && !validSemesterIds.has(next.classPromotion.semesterId)) {
        next.classPromotion.semesterId = ''
        selectionWasCleared = true
      }
      if (next.semesterPromotion.semesterId && !validSemesterIds.has(next.semesterPromotion.semesterId)) {
        next.semesterPromotion.semesterId = ''
        selectionWasCleared = true
      }

      if (!next.subjectPass.semesterId && nextDefaultSemesterId) next.subjectPass.semesterId = nextDefaultSemesterId
      if (!next.classPromotion.semesterId && nextDefaultSemesterId) next.classPromotion.semesterId = nextDefaultSemesterId
      if (!next.semesterPromotion.semesterId && nextDefaultSemesterId) next.semesterPromotion.semesterId = nextDefaultSemesterId

      return next
    })

    if (selectionWasCleared) {
      setReportData((prev) => ({
        ...prev,
        subjectPass: null,
        classPromotion: null,
        semesterPromotion: null,
      }))
      if (options?.notifyIfSelectionMissing) {
        toast.error('Một học kỳ đang chọn đã bị xóa hoặc không còn khả dụng. Vui lòng chọn lại.')
      }
    }

    return nextSemesters
  }, [])

  useEffect(() => {
    Promise.all([subjectApi.list(), classApi.list(), academicYearApi.list(), refreshSemesters()])
      .then(([subjectRes, classRes, yearRes]) => {
        const nextYears = yearRes.data.data || []
        const nextActiveYearId = nextYears.find((year: any) => year.isActive)?.id || nextYears[0]?.id || ''

        setSubjects(subjectRes.data.data || [])
        setClasses(classRes.data.data || [])
        setYears(nextYears)
        setReportFilters((prev) => ({
          ...prev,
          yearPromotion: {
            academicYearId: prev.yearPromotion.academicYearId || nextActiveYearId,
          },
        }))
        setPromotionFilters((prev) => ({
          ...prev,
          academicYearId: prev.academicYearId || nextActiveYearId,
        }))
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

  const updateReportFilters = (key: ReportKey, patch: Record<string, string>) => {
    setReportFilters((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] as Record<string, string>),
        ...patch,
      },
    }))
    setReportData((prev) => ({ ...prev, [key]: null }))
    setActiveDetailReport(key)
  }

  const loadReport = async (key: ReportKey) => {
    try {
      setReportLoading((prev) => ({ ...prev, [key]: true }))
      setActiveDetailReport(key)

      if (key === 'subjectPass') {
        const { subjectId, semesterId } = reportFilters.subjectPass
        if (!subjectId || !semesterId) {
          toast.error('Chọn môn học và học kỳ để xem báo cáo này')
          return
        }
        const res = await reportApi.subjectSummary(subjectId, semesterId)
        setReportData((prev) => ({ ...prev, subjectPass: res.data.data }))
      }

      if (key === 'classPromotion') {
        const { classId, semesterId } = reportFilters.classPromotion
        if (!classId || !semesterId) {
          toast.error('Chọn lớp và học kỳ để xem báo cáo này')
          return
        }
        const res = await reportApi.classPromotionSummary(classId, semesterId)
        setReportData((prev) => ({ ...prev, classPromotion: res.data.data }))
      }

      if (key === 'semesterPromotion') {
        const { semesterId } = reportFilters.semesterPromotion
        if (!semesterId) {
          toast.error('Chọn học kỳ để xem báo cáo này')
          return
        }
        const res = await reportApi.semesterPromotionSummary(semesterId)
        setReportData((prev) => ({ ...prev, semesterPromotion: res.data.data }))
      }

      if (key === 'yearPromotion') {
        const { academicYearId } = reportFilters.yearPromotion
        if (!academicYearId) {
          toast.error('Chọn năm học để xem báo cáo này')
          return
        }
        const res = await reportApi.yearPromotionSummary(academicYearId)
        setReportData((prev) => ({ ...prev, yearPromotion: res.data.data }))
      }
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'NOT_FOUND') {
        if (key !== 'yearPromotion') {
          await refreshSemesters({ notifyIfSelectionMissing: true })
        }
        return
      }
      toast.error(error.response?.data?.error?.message || 'Không thể tải báo cáo')
    } finally {
      setReportLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const evaluatePromotion = async () => {
    if (!promotionFilters.academicYearId) {
      toast.error('Chọn năm học trước khi xét lên lớp')
      return
    }

    setMissingDetails([])
    setPromotionResults(null)
    setPassAssign({})
    setFailAssign({})

    try {
      setPromotionLoading(true)
      await promotionApi.evaluateYearEnd({ academicYearId: promotionFilters.academicYearId, classId: promotionFilters.classId || undefined })
      const res = await promotionApi.getYearEndResults({ academicYearId: promotionFilters.academicYearId, classId: promotionFilters.classId || undefined })
      setPromotionResults(res.data.data)
      toast.success('Đã chạy xét lên lớp')
    } catch (error: any) {
      const err = error.response?.data?.error
      if (err?.code === 'MISSING_SCORES') {
        setMissingDetails(err.details || [])
      }
      toast.error(err?.message || 'Xét lên lớp thất bại')
    } finally {
      setPromotionLoading(false)
    }
  }

  const executePromotion = async () => {
    if (!promotionFilters.academicYearId || !promotionResults) return

    try {
      setPromotionLoading(true)

      const passAssignments = promotionResults.passStudents
        .filter((item) => passAssign[item.studentId])
        .map((item) => ({ studentId: item.studentId, toClassId: passAssign[item.studentId] }))

      const failAssignments = promotionResults.failStudents
        .filter((item) => failAssign[item.studentId])
        .map((item) => ({ studentId: item.studentId, toClassId: failAssign[item.studentId] }))

      const res = await promotionApi.executeYearEnd({
        academicYearId: promotionFilters.academicYearId,
        passAssignments,
        failAssignments,
      })

      toast.success(`Hoàn tất xét lên lớp: ${res.data.data.summary.promoted} học sinh lên lớp, ${res.data.data.summary.archived} học sinh lưu trữ`)

      const refreshed = await promotionApi.getYearEndResults({
        academicYearId: promotionFilters.academicYearId,
        classId: promotionFilters.classId || undefined,
      })
      setPromotionResults(refreshed.data.data)
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thực thi xét lên lớp thất bại')
    } finally {
      setPromotionLoading(false)
    }
  }

  const renderBoardMetrics = (key: ReportKey) => {
    const data = reportData[key]

    if (!data?.summary) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
          Chưa chạy báo cáo này. Chọn bộ lọc và bấm nút để xem số liệu mới nhất.
        </div>
      )
    }

    if (key === 'subjectPass') {
      return (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tỷ lệ đạt hiện tại</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{formatRate(data.summary.passRate)}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{data.subject?.name || 'Môn học'}</p>
              <p>{data.semester?.name || 'Học kỳ'}</p>
            </div>
          </div>
          <RateBar value={data.summary.passRate || 0} tone="from-emerald-500 to-teal-500" />
          <p className="text-sm text-slate-600">
            {data.summary.totalPassed}/{data.summary.totalStudents} học sinh đạt, điểm trung bình toàn cục {formatAverage(data.summary.averageScore)}.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tỷ lệ lên lớp</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatRate(data.summary.passRate)}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>{data.summary.passStudents || 0} học sinh đạt</p>
            <p>{data.summary.failStudents || 0} học sinh chưa đạt</p>
          </div>
        </div>
        <RateBar value={data.summary.passRate || 0} tone="from-sky-500 to-indigo-500" />
        <p className="text-sm text-slate-600">
          Tổng số đối tượng được xét: {data.summary.totalStudents || 0}. Dữ liệu được cập nhật theo bộ lọc của board này.
        </p>
      </div>
    )
  }

  const renderActiveDetail = () => {
    const key = activeDetailReport
    const meta = REPORT_META[key]
    const data = reportData[key]

    if (!data) {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{meta.emptyTitle}</h2>
              <p className="mt-1 text-sm text-slate-600">{meta.emptyDescription}</p>
            </div>
          </div>
        </div>
      )
    }

    if (key === 'subjectPass') {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Chi tiết báo cáo</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{meta.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {data.subject?.name || 'Môn học'} · {data.semester?.name || 'Học kỳ'} · Điểm đạt cấu hình: {formatAverage(data.passScore)}
              </p>
            </div>
            <p className="text-sm text-slate-500">Xếp theo lớp để nhìn ra nơi đang thiếu hoặc vượt chuẩn.</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4 xl:grid-cols-5">
            <SummaryStat label="Tổng học sinh" value={String(data.summary.totalStudents || 0)} />
            <SummaryStat label="Số đạt" value={String(data.summary.totalPassed || 0)} />
            <SummaryStat label="Tỷ lệ đạt" value={formatRate(data.summary.passRate)} />
            <SummaryStat label="Điểm trung bình" value={formatAverage(data.summary.averageScore)} />
            <SummaryStat label="Ngưỡng đạt" value={formatAverage(data.passScore)} />
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3">Khối</th>
                  <th className="px-4 py-3">Sĩ số</th>
                  <th className="px-4 py-3">Số đạt</th>
                  <th className="px-4 py-3">Điểm TB</th>
                  <th className="px-4 py-3">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.classes.map((item: any) => (
                  <tr key={item.class.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.class.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.class.grade?.name || '--'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.totalStudents}</td>
                    <td className="px-4 py-3 text-slate-600">{item.passedStudents}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAverage(item.averageScore)}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-[180px] space-y-2">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>{formatRate(item.passRate)}</span>
                          <span>{item.passedStudents}/{item.totalStudents}</span>
                        </div>
                        <RateBar value={item.passRate || 0} tone="from-emerald-500 to-teal-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (key === 'classPromotion') {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Chi tiết báo cáo</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{meta.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {data.class?.name || 'Lớp'} · {data.class?.grade?.name || 'Khối'} · Học kỳ đã chọn
              </p>
            </div>
            <p className="text-sm text-slate-500">Dùng bảng này để rà nhanh học sinh lên lớp và học sinh cần xử lý thêm.</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryStat label="Sĩ số xét" value={String(data.summary.totalStudents || 0)} />
            <SummaryStat label="Lên lớp" value={String(data.summary.passStudents || 0)} />
            <SummaryStat label="Chưa đạt" value={String(data.summary.failStudents || 0)} />
            <SummaryStat label="Tỷ lệ lên lớp" value={formatRate(data.summary.passRate)} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-emerald-900">Nhóm lên lớp</h3>
              </div>
              <p className="mt-2 text-sm text-emerald-800">{data.summary.passStudents || 0} học sinh đạt điều kiện lên lớp.</p>
            </div>
            <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-5">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-rose-900">Nhóm chưa đạt</h3>
              </div>
              <p className="mt-2 text-sm text-rose-800">{data.summary.failStudents || 0} học sinh cần xem lại kết quả hoặc xếp lớp lại.</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã HS</th>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-4 py-3">Điểm TB</th>
                  <th className="px-4 py-3">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.students.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.student.studentCode}</td>
                    <td className="px-4 py-3 text-slate-700">{item.student.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAverage(item.average)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.result === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {item.result === 'PASS' ? 'Lên lớp' : 'Chưa đạt'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (key === 'semesterPromotion') {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Chi tiết báo cáo</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{meta.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{data.semester?.name || 'Học kỳ'} · Kết quả được nhóm theo từng lớp.</p>
            </div>
            <p className="text-sm text-slate-500">Nhìn nhanh lớp nào đang kéo tỷ lệ học kỳ xuống hoặc vượt hẳn mặt bằng chung.</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryStat label="Tổng học sinh" value={String(data.summary.totalStudents || 0)} />
            <SummaryStat label="Số lên lớp" value={String(data.summary.passStudents || 0)} />
            <SummaryStat label="Số chưa đạt" value={String(data.summary.failStudents || 0)} />
            <SummaryStat label="Tỷ lệ lên lớp" value={formatRate(data.summary.passRate)} />
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3">Khối</th>
                  <th className="px-4 py-3">Tổng xét</th>
                  <th className="px-4 py-3">Lên lớp</th>
                  <th className="px-4 py-3">Chưa đạt</th>
                  <th className="px-4 py-3">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.classes.map((item: any) => (
                  <tr key={item.class.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.class.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.class.grade?.name || '--'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.totalStudents}</td>
                    <td className="px-4 py-3 text-slate-600">{item.passStudents}</td>
                    <td className="px-4 py-3 text-slate-600">{item.failStudents}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-[180px] space-y-2">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>{formatRate(item.passRate)}</span>
                          <span>{item.passStudents}/{item.totalStudents}</span>
                        </div>
                        <RateBar value={item.passRate || 0} tone="from-amber-500 to-orange-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Chi tiết báo cáo</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{meta.title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatAcademicYearLabel(data.academicYear)} · Dữ liệu tổng hợp theo khối từ học kỳ cuối năm.
            </p>
          </div>
          <p className="text-sm text-slate-500">Tập trung vào khối nào đang có tỷ lệ lên lớp thấp để can thiệp sớm.</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <SummaryStat label="Tổng học sinh" value={String(data.summary.totalStudents || 0)} />
          <SummaryStat label="Số lên lớp" value={String(data.summary.passStudents || 0)} />
          <SummaryStat label="Số chưa đạt" value={String(data.summary.failStudents || 0)} />
          <SummaryStat label="Tỷ lệ lên lớp" value={formatRate(data.summary.passRate)} />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Khối</th>
                <th className="px-4 py-3">Tổng xét</th>
                <th className="px-4 py-3">Lên lớp</th>
                <th className="px-4 py-3">Chưa đạt</th>
                <th className="px-4 py-3">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.grades.map((item: any) => (
                <tr key={item.grade.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.grade.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.totalStudents}</td>
                  <td className="px-4 py-3 text-slate-600">{item.passStudents}</td>
                  <td className="px-4 py-3 text-slate-600">{item.failStudents}</td>
                  <td className="px-4 py-3">
                    <div className="min-w-[180px] space-y-2">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>{formatRate(item.passRate)}</span>
                        <span>{item.passStudents}/{item.totalStudents}</span>
                      </div>
                      <RateBar value={item.passRate || 0} tone="from-rose-500 to-pink-500" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const reportBoards: ReportKey[] = ['subjectPass', 'classPromotion', 'semesterPromotion', 'yearPromotion']

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl lg:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_55%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
              <Sparkles className="h-3.5 w-3.5" />
              Dashboard báo cáo học vụ
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight lg:text-4xl">Báo cáo tổng kết theo đúng nghiệp vụ, không còn hiện mã BM ở phần chính</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 lg:text-base">
              Mỗi board tương ứng đúng một loại báo cáo: tỷ lệ đạt theo môn, tỷ lệ lên lớp theo lớp, theo học kỳ và theo năm học. Mỗi board có bộ lọc riêng để giáo vụ thao tác nhanh hơn và ít nhầm hơn.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={scrollToPromotionSection} className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                <GraduationCap className="mr-2 h-4 w-4" />
                Đi tới khu xét lên lớp
              </button>
              <p className="self-center text-sm text-slate-300">Nếu bạn cần thực hiện lên lớp, bấm nút này để nhảy thẳng xuống phần thao tác.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Board báo cáo</p>
              <p className="mt-2 text-3xl font-bold">4</p>
              <p className="mt-1 text-sm text-slate-300">Tách theo mục tiêu sử dụng thực tế</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Học kỳ đang ưu tiên</p>
              <p className="mt-2 text-lg font-semibold">{semesters.find((semester) => semester.isActive)?.name || semesters[0]?.name || 'Chưa có học kỳ'}</p>
              <p className="mt-1 text-sm text-slate-300">Tự đồng bộ khi quay lại tab</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Năm học mặc định</p>
              <p className="mt-2 text-lg font-semibold">{formatAcademicYearLabel(years.find((year) => year.id === reportFilters.yearPromotion.academicYearId) || years.find((year) => year.isActive) || years[0])}</p>
              <p className="mt-1 text-sm text-slate-300">Dùng cho báo cáo năm và xét lên lớp</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {reportBoards.map((key) => {
          const meta = REPORT_META[key]
          const Icon = meta.icon
          const isBusy = reportLoading[key]
          const isActive = activeDetailReport === key

          return (
            <article key={key} className={`overflow-hidden rounded-[28px] border bg-gradient-to-br ${meta.accent} p-5 shadow-sm transition ${isActive ? 'border-slate-900 shadow-lg' : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Board báo cáo</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">{meta.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{meta.description}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 p-3 text-slate-700 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {key === 'subjectPass' ? (
                  <>
                    <div>
                      <label className="label">Môn học</label>
                      <select className="input" value={reportFilters.subjectPass.subjectId} onChange={(e) => updateReportFilters('subjectPass', { subjectId: e.target.value })}>
                        <option value="">Chọn môn học</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Học kỳ</label>
                      <select className="input" value={reportFilters.subjectPass.semesterId} onChange={(e) => updateReportFilters('subjectPass', { semesterId: e.target.value })}>
                        <option value="">Chọn học kỳ</option>
                        {semesters.map((semester) => (
                          <option key={semester.id} value={semester.id}>{semester.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}

                {key === 'classPromotion' ? (
                  <>
                    <div>
                      <label className="label">Lớp</label>
                      <select className="input" value={reportFilters.classPromotion.classId} onChange={(e) => updateReportFilters('classPromotion', { classId: e.target.value })}>
                        <option value="">Chọn lớp</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Học kỳ</label>
                      <select className="input" value={reportFilters.classPromotion.semesterId} onChange={(e) => updateReportFilters('classPromotion', { semesterId: e.target.value })}>
                        <option value="">Chọn học kỳ</option>
                        {semesters.map((semester) => (
                          <option key={semester.id} value={semester.id}>{semester.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}

                {key === 'semesterPromotion' ? (
                  <div className="md:col-span-2">
                    <label className="label">Học kỳ</label>
                    <select className="input" value={reportFilters.semesterPromotion.semesterId} onChange={(e) => updateReportFilters('semesterPromotion', { semesterId: e.target.value })}>
                      <option value="">Chọn học kỳ</option>
                      {semesters.map((semester) => (
                        <option key={semester.id} value={semester.id}>{semester.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {key === 'yearPromotion' ? (
                  <div className="md:col-span-2">
                    <label className="label">Năm học</label>
                    <select className="input" value={reportFilters.yearPromotion.academicYearId} onChange={(e) => updateReportFilters('yearPromotion', { academicYearId: e.target.value })}>
                      <option value="">Chọn năm học</option>
                      {years.map((year) => (
                        <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="mt-5">{renderBoardMetrics(key)}</div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={() => loadReport(key)} disabled={isBusy} className="btn-primary">
                  {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                  {meta.cta}
                </button>
                {reportData[key] ? (
                  <button onClick={() => setActiveDetailReport(key)} className="btn-outline">
                    Xem chi tiết board này
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </section>

      <section>{renderActiveDetail()}</section>

      <section id="promotion-section" className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Tác vụ điều hành</p>
              <h2 className="mt-2 text-2xl font-bold">Khu xét lên lớp</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Phần này tách riêng khỏi dashboard báo cáo để người dùng không nhầm giữa xem số liệu và thực thi nghiệp vụ. Chạy xét trước, kiểm tra thiếu điểm, rồi mới thực thi phân lớp.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
              <Users className="h-3.5 w-3.5" />
              Đồng bộ với kết quả cuối năm
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label">Năm học</label>
              <select
                className="input"
                value={promotionFilters.academicYearId}
                onChange={(e) => {
                  setPromotionFilters((prev) => ({ ...prev, academicYearId: e.target.value }))
                  setPromotionResults(null)
                  setMissingDetails([])
                }}
              >
                <option value="">Chọn năm học</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Phạm vi lớp</label>
              <select
                className="input"
                value={promotionFilters.classId}
                onChange={(e) => {
                  setPromotionFilters((prev) => ({ ...prev, classId: e.target.value }))
                  setPromotionResults(null)
                  setMissingDetails([])
                }}
              >
                <option value="">Toàn bộ lớp</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 xl:col-span-2 xl:self-end">
              <div className="flex flex-wrap gap-3">
                <button onClick={evaluatePromotion} disabled={promotionLoading} className="btn-primary">
                  {promotionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}
                  Chạy xét lên lớp
                </button>
                {promotionResults ? (
                  <button onClick={executePromotion} disabled={promotionLoading} className="btn-outline">
                    Thực thi phân lớp
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {missingDetails.length > 0 ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-rose-900">Không thể xét lên lớp vì còn thiếu điểm</h3>
              </div>
              <div className="mt-4 space-y-2 text-sm text-rose-800">
                {missingDetails.slice(0, 50).map((item, index) => (
                  <p key={`${item.studentCode}-${item.subjectName}-${index}`}>
                    {item.studentName} ({item.studentCode}) · {item.subjectName} · {item.semesterName}: thiếu {item.missingComponents?.join(', ')}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {promotionResults ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryStat label="Tổng hồ sơ" value={String((promotionResults.passStudents?.length || 0) + (promotionResults.failStudents?.length || 0))} />
                <SummaryStat label="Lên lớp" value={String(promotionResults.passStudents?.length || 0)} />
                <SummaryStat label="Xếp lại lớp" value={String(promotionResults.failStudents?.length || 0)} />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="font-semibold text-emerald-900">Nhóm đạt điều kiện lên lớp</h3>
                      <p className="text-sm text-emerald-800">Chọn lớp đích cho từng học sinh hoặc để trống nếu chưa chốt.</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {promotionResults.passStudents.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-emerald-200 bg-white/80 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{item.student.fullName}</p>
                            <p className="text-sm text-slate-600">{item.class.name} · Điểm TB {formatAverage(item.average)}</p>
                          </div>
                          <select className="input lg:max-w-[240px]" value={passAssign[item.studentId] || ''} onChange={(e) => setPassAssign((prev) => ({ ...prev, [item.studentId]: e.target.value }))}>
                            <option value="">Chọn lớp đích</option>
                            {classes.filter((cls) => cls.id !== item.classId).map((cls) => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex items-center gap-3">
                    <School className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="font-semibold text-amber-900">Nhóm cần xếp lớp lại</h3>
                      <p className="text-sm text-amber-800">Dùng để gán lớp mới cho học sinh chưa đạt sau kỳ xét.</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {promotionResults.failStudents.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-amber-200 bg-white/80 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{item.student.fullName}</p>
                            <p className="text-sm text-slate-600">{item.class.name} · Điểm TB {formatAverage(item.average)}</p>
                          </div>
                          <select className="input lg:max-w-[240px]" value={failAssign[item.studentId] || ''} onChange={(e) => setFailAssign((prev) => ({ ...prev, [item.studentId]: e.target.value }))}>
                            <option value="">Chọn lớp đích</option>
                            {classes.filter((cls) => cls.id !== item.classId).map((cls) => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
