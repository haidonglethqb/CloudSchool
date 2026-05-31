'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { classApi, reportApi, subjectApi } from '@/lib/api'
import { formatSemesterLabel, pickDefaultSemester } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  GraduationCap,
  Layers,
  Loader2,
  School,
} from 'lucide-react'
import toast from 'react-hot-toast'

type ReportKey = 'subjectPass' | 'classPromotion' | 'semesterPromotion' | 'yearPromotion'

type SemesterRow = {
  id: string
  name: string
  year?: string | null
  semesterNum?: number | null
  academicYearId?: string | null
  isActive?: boolean
}

type YearRow = {
  id: string
  startYear: number
  endYear: number
  isActive?: boolean
}

type ReportState = {
  subjectId: string
  classId: string
}

const REPORTS: Array<{
  key: ReportKey
  title: string
  description: string
  icon: typeof BookOpen
}> = [
  {
    key: 'subjectPass',
    title: 'Tỷ lệ đạt theo môn học',
    description: 'Theo dõi mức đạt chuẩn của từng lớp trong một môn học.',
    icon: BookOpen,
  },
  {
    key: 'classPromotion',
    title: 'Tỷ lệ lên lớp theo lớp',
    description: 'Xem kết quả đạt, chưa đạt và thi lại của một lớp.',
    icon: School,
  },
  {
    key: 'semesterPromotion',
    title: 'Tỷ lệ lên lớp theo học kỳ',
    description: 'So sánh kết quả lên lớp giữa các lớp trong học kỳ.',
    icon: CalendarRange,
  },
  {
    key: 'yearPromotion',
    title: 'Tỷ lệ lên lớp theo năm học',
    description: 'Tổng hợp kết quả cuối năm theo từng khối.',
    icon: GraduationCap,
  },
]

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
  return `${value.toFixed(2).replace(/\.00$/, '')}%`
}

function yearLabel(year?: YearRow | null) {
  return year ? `${year.startYear}-${year.endYear}` : ''
}

function getSummaryValue(summary: any, key: 'pass' | 'fail' | 'retake') {
  if (!summary) return 0
  if (key === 'pass') return summary.passStudents ?? summary.totalPassed ?? 0
  if (key === 'retake') return summary.retakeStudents ?? 0
  return summary.failStudents ?? Math.max((summary.totalStudents ?? 0) - (summary.passStudents ?? summary.totalPassed ?? 0) - (summary.retakeStudents ?? 0), 0)
}

function StatBox({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'green' | 'red' | 'amber' | 'blue' }) {
  const toneClass = {
    default: 'text-gray-950',
    green: 'text-emerald-700',
    red: 'text-rose-700',
    amber: 'text-amber-700',
    blue: 'text-primary',
  }[tone]

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function DonutChart({ passRate }: { passRate: number }) {
  const safeRate = Math.max(0, Math.min(passRate || 0, 100))
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#059669 ${safeRate}%, #e11d48 ${safeRate}% 100%)`,
        }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
          <span className="text-xl font-bold text-gray-950">{formatPercent(safeRate)}</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
          <span className="text-gray-700">Đạt</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-600" />
          <span className="text-gray-700">Chưa đạt / thi lại</span>
        </div>
      </div>
    </div>
  )
}

function BarList({ rows }: { rows: Array<{ label: string; value: number; meta?: string }> }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, 8)
  if (sorted.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có dữ liệu để vẽ biểu đồ.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-gray-800">{item.label}</span>
            <span className="text-gray-500">{item.meta || formatPercent(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(3, Math.min(item.value, 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultPanel({ activeKey, data }: { activeKey: ReportKey; data: any }) {
  const summary = data?.summary
  if (!summary) {
    return (
      <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 font-medium text-gray-700">Chọn bộ lọc rồi bấm “Xem báo cáo” để hiển thị dữ liệu.</p>
      </section>
    )
  }

  const passRate = summary.passRate ?? 0
  const rows =
    activeKey === 'subjectPass'
      ? (data.classes || []).map((item: any) => ({ label: item.class?.name || '-', value: item.passRate || 0 }))
      : activeKey === 'yearPromotion'
        ? (data.grades || []).map((item: any) => ({ label: item.grade?.name || '-', value: item.passRate || 0 }))
        : (data.classes || []).map((item: any) => ({ label: item.class?.name || '-', value: item.passRate || 0 }))

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-950">{REPORTS.find((item) => item.key === activeKey)?.title}</h2>
          <p className="mt-1 text-sm text-gray-600">Kết quả được tính theo bộ lọc hiện tại.</p>
        </div>
        <DonutChart passRate={passRate} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <StatBox label="Tổng xét" value={summary.totalStudents ?? 0} />
        <StatBox label="Đạt" value={getSummaryValue(summary, 'pass')} tone="green" />
        <StatBox label="Chưa đạt" value={getSummaryValue(summary, 'fail')} tone="red" />
        <StatBox label="Thi lại" value={getSummaryValue(summary, 'retake')} tone="amber" />
        <StatBox label="Tỷ lệ đạt" value={formatPercent(passRate)} tone="blue" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-4 font-semibold text-gray-900">Biểu đồ tỷ lệ</h3>
          <BarList rows={rows} />
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Nhóm</th>
                <th className="table-header text-right">Tổng</th>
                <th className="table-header text-right">Đạt</th>
                <th className="table-header text-right">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Chưa có dữ liệu chi tiết.</td>
                </tr>
              ) : (
                (activeKey === 'yearPromotion' ? data.grades || [] : data.classes || []).map((item: any, index: number) => (
                  <tr key={item.class?.id || item.grade?.id || index}>
                    <td className="table-cell font-medium">{item.class?.name || item.grade?.name || '-'}</td>
                    <td className="table-cell text-right">{item.totalStudents ?? 0}</td>
                    <td className="table-cell text-right text-emerald-700">{item.passStudents ?? item.passedStudents ?? 0}</td>
                    <td className="table-cell text-right font-semibold">{formatPercent(item.passRate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user)
  const isTeacher = user?.role === 'TEACHER'
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [semesters, setSemesters] = useState<SemesterRow[]>([])
  const [years, setYears] = useState<YearRow[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [reportState, setReportState] = useState<ReportState>({ subjectId: '', classId: '' })
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [activeReport, setActiveReport] = useState<ReportKey>('subjectPass')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState<any | null>(null)

  const selectedYear = years.find((item) => item.id === selectedYearId) || null
  const filteredSemesters = useMemo(() => {
    if (!selectedYearId) return semesters
    const label = yearLabel(selectedYear)
    return semesters.filter((item) => item.academicYearId === selectedYearId || item.year === label)
  }, [selectedYearId, selectedYear, semesters])

  useEffect(() => {
    Promise.all([subjectApi.list(), classApi.list(), subjectApi.getSemesters(), reportApi.dashboardByScope({ allYears: 'true' })])
      .then(([subjectRes, classRes, semesterRes, dashboardRes]) => {
        const subjectRows = subjectRes.data.data || []
        const classRows = classRes.data.data || []
        const semesterRows = semesterRes.data.data || []
        const dashboard = dashboardRes.data.data || {}
        const yearRows = (dashboard.academicYears || []).map((item: any) => ({
          id: item.id,
          startYear: item.startYear,
          endYear: item.endYear,
          isActive: item.isActive,
        }))

        setSubjects(subjectRows)
        setClasses(classRows)
        setSemesters(semesterRows)
        setYears(yearRows)
        setDashboardData(dashboard)
        setReportState({
          subjectId: subjectRows[0]?.id || '',
          classId: classRows[0]?.id || '',
        })
      })
      .catch(() => toast.error('Không thể tải dữ liệu báo cáo'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedSemesterId && !filteredSemesters.some((item) => item.id === selectedSemesterId)) {
      setSelectedSemesterId('')
    }
  }, [filteredSemesters, selectedSemesterId])

  useEffect(() => {
    setDashboardLoading(true)
    reportApi.dashboardByScope({
      academicYearId: selectedYearId || undefined,
      semesterId: selectedSemesterId || undefined,
      allYears: !selectedYearId && !selectedSemesterId ? 'true' : undefined,
    })
      .then((res) => setDashboardData(res.data.data))
      .catch(() => setDashboardData(null))
      .finally(() => setDashboardLoading(false))
  }, [selectedYearId, selectedSemesterId])

  const effectiveSemester = selectedSemesterId || pickDefaultSemester(filteredSemesters)?.id || ''

  const loadReport = async (key: ReportKey) => {
    try {
      setActiveReport(key)
      setReportLoading(true)
      setReportData(null)

      if (key !== 'yearPromotion' && !effectiveSemester) {
        toast.error('Vui lòng chọn học kỳ')
        return
      }

      if (key === 'subjectPass') {
        if (!reportState.subjectId) {
          toast.error('Vui lòng chọn môn học')
          return
        }
        const res = await reportApi.subjectSummary(reportState.subjectId, effectiveSemester)
        setReportData(res.data.data)
      }

      if (key === 'classPromotion') {
        if (!reportState.classId) {
          toast.error('Vui lòng chọn lớp')
          return
        }
        const res = await reportApi.classPromotionSummary(reportState.classId, effectiveSemester)
        setReportData(res.data.data)
      }

      if (key === 'semesterPromotion') {
        const res = await reportApi.semesterPromotionSummary(effectiveSemester)
        setReportData(res.data.data)
      }

      if (key === 'yearPromotion') {
        if (!selectedYearId) {
          toast.error('Vui lòng chọn năm học để xem báo cáo năm')
          return
        }
        const res = await reportApi.yearPromotionSummary(selectedYearId)
        setReportData(res.data.data)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Không thể tải báo cáo')
    } finally {
      setReportLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Báo cáo học vụ</h1>
          <p className="mt-1 text-sm text-gray-600">Theo dõi kết quả học tập, tỷ lệ đạt và tình hình lên lớp.</p>
        </div>
        {!isTeacher ? (
          <Link href="/promotion" className="btn-outline">
            <GraduationCap className="mr-2 h-4 w-4" />
            Xét lên lớp
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_repeat(3,minmax(120px,0.7fr))]">
          <div>
            <label className="label">Năm học</label>
            <select
              className="input"
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value)
                setReportData(null)
              }}
            >
              <option value="">Tất cả năm học</option>
              {years.map((item) => (
                <option key={item.id} value={item.id}>{yearLabel(item)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Học kỳ</label>
            <select
              className="input"
              value={selectedSemesterId}
              onChange={(e) => {
                setSelectedSemesterId(e.target.value)
                setReportData(null)
              }}
            >
              <option value="">Tất cả học kỳ</option>
              {filteredSemesters.map((item) => (
                <option key={item.id} value={item.id}>{formatSemesterLabel(item)}</option>
              ))}
            </select>
          </div>
          <StatBox label="Tổng học sinh" value={dashboardLoading ? '--' : (dashboardData?.stats?.totalStudents ?? 0)} />
          <StatBox label="Tổng lớp" value={dashboardLoading ? '--' : (dashboardData?.stats?.totalClasses ?? 0)} />
          <StatBox label="Tổng môn" value={dashboardLoading ? '--' : (dashboardData?.stats?.totalSubjects ?? 0)} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {REPORTS.map(({ key, icon: Icon, title, description }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveReport(key)
              setReportData(null)
            }}
            className={`rounded-lg border bg-white p-4 text-left transition ${
              activeReport === key ? 'border-primary shadow-sm ring-2 ring-primary/10' : 'border-gray-200 hover:border-primary/40'
            }`}
          >
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold text-gray-950">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-4 md:grid-cols-3">
            {activeReport === 'subjectPass' ? (
              <div>
                <label className="label">Môn học</label>
                <select className="input" value={reportState.subjectId} onChange={(e) => setReportState((prev) => ({ ...prev, subjectId: e.target.value }))}>
                  {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            ) : null}
            {activeReport === 'classPromotion' ? (
              <div>
                <label className="label">Lớp</label>
                <select className="input" value={reportState.classId} onChange={(e) => setReportState((prev) => ({ ...prev, classId: e.target.value }))}>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name} {item.grade?.name ? `- ${item.grade.name}` : ''}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label className="label">{activeReport === 'yearPromotion' ? 'Năm đang xét' : 'Học kỳ đang xét'}</label>
              <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">
                {activeReport === 'yearPromotion'
                  ? selectedYear ? yearLabel(selectedYear) : 'Chọn năm học ở bộ lọc phía trên'
                  : selectedSemesterId
                    ? formatSemesterLabel(filteredSemesters.find((item) => item.id === selectedSemesterId) || ({} as SemesterRow))
                    : 'Tự chọn học kỳ phù hợp nhất'}
              </div>
            </div>
          </div>
          <button onClick={() => loadReport(activeReport)} className="btn-primary" disabled={reportLoading}>
            {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
            Xem báo cáo
          </button>
        </div>
      </section>

      <ResultPanel activeKey={activeReport} data={reportData} />
    </div>
  )
}
