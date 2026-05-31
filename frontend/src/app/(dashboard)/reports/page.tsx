'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { classApi, reportApi, subjectApi } from '@/lib/api'
import { formatSemesterLabel, pickDefaultSemester } from '@/lib/utils'
import { BarChart3, BookOpen, Loader2, School, CalendarRange, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

type ReportKey = 'subjectPass' | 'classPromotion' | 'semesterPromotion' | 'yearPromotion'

type ReportFilters = {
  subjectPass: { subjectId: string; semesterId: string }
  classPromotion: { classId: string; semesterId: string }
  semesterPromotion: { semesterId: string }
  yearPromotion: { academicYearId: string }
}

const EMPTY_FILTERS: ReportFilters = {
  subjectPass: { subjectId: '', semesterId: '' },
  classPromotion: { classId: '', semesterId: '' },
  semesterPromotion: { semesterId: '' },
  yearPromotion: { academicYearId: '' },
}

const REPORT_TITLE: Record<ReportKey, string> = {
  subjectPass: 'Ty le dat theo mon hoc',
  classPromotion: 'Ty le len lop theo lop',
  semesterPromotion: 'Ty le len lop theo hoc ky',
  yearPromotion: 'Ty le len lop theo nam hoc',
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
  return `${value.toFixed(2).replace(/\\.00$/, '')}%`
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [dashboardScope, setDashboardScope] = useState({ academicYearId: '', semesterId: '' })
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [activeReport, setActiveReport] = useState<ReportKey>('subjectPass')
  const [reportLoading, setReportLoading] = useState<Record<ReportKey, boolean>>({
    subjectPass: false,
    classPromotion: false,
    semesterPromotion: false,
    yearPromotion: false,
  })
  const [reportData, setReportData] = useState<Record<ReportKey, any | null>>({
    subjectPass: null,
    classPromotion: null,
    semesterPromotion: null,
    yearPromotion: null,
  })

  useEffect(() => {
    Promise.all([subjectApi.list(), classApi.list(), subjectApi.getSemesters(), reportApi.dashboard()])
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

        const defaultSemester = pickDefaultSemester(semesterRows)
        const defaultYear = yearRows.find((item: any) => item.isActive)
          || yearRows.find((item: any) => item.id === dashboard.selectedAcademicYear?.id)
          || yearRows[0]

        setSubjects(subjectRows)
        setClasses(classRows)
        setSemesters(semesterRows)
        setYears(yearRows)
        setDashboardData(dashboard)
        setDashboardScope({
          academicYearId: defaultYear?.id || '',
          semesterId: dashboard.selectedSemester?.id || defaultSemester?.id || '',
        })
        setFilters({
          subjectPass: { subjectId: subjectRows[0]?.id || '', semesterId: defaultSemester?.id || '' },
          classPromotion: { classId: classRows[0]?.id || '', semesterId: defaultSemester?.id || '' },
          semesterPromotion: { semesterId: defaultSemester?.id || '' },
          yearPromotion: { academicYearId: defaultYear?.id || '' },
        })
      })
      .catch(() => toast.error('Khong the tai du lieu bao cao'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!dashboardScope.academicYearId && !dashboardScope.semesterId) return
    setDashboardLoading(true)
    reportApi.dashboardByScope({
      academicYearId: dashboardScope.academicYearId || undefined,
      semesterId: dashboardScope.semesterId || undefined,
    })
      .then((res) => setDashboardData(res.data.data))
      .catch(() => setDashboardData(null))
      .finally(() => setDashboardLoading(false))
  }, [dashboardScope.academicYearId, dashboardScope.semesterId])

  const loadReport = async (key: ReportKey) => {
    try {
      setActiveReport(key)
      setReportLoading((prev) => ({ ...prev, [key]: true }))

      if (key === 'subjectPass') {
        const { subjectId, semesterId } = filters.subjectPass
        if (!subjectId || !semesterId) {
          toast.error('Chon mon hoc va hoc ky')
          return
        }
        const res = await reportApi.subjectSummary(subjectId, semesterId)
        setReportData((prev) => ({ ...prev, subjectPass: res.data.data }))
      }

      if (key === 'classPromotion') {
        const { classId, semesterId } = filters.classPromotion
        if (!classId || !semesterId) {
          toast.error('Chon lop va hoc ky')
          return
        }
        const res = await reportApi.classPromotionSummary(classId, semesterId)
        setReportData((prev) => ({ ...prev, classPromotion: res.data.data }))
      }

      if (key === 'semesterPromotion') {
        const { semesterId } = filters.semesterPromotion
        if (!semesterId) {
          toast.error('Chon hoc ky')
          return
        }
        const res = await reportApi.semesterPromotionSummary(semesterId)
        setReportData((prev) => ({ ...prev, semesterPromotion: res.data.data }))
      }

      if (key === 'yearPromotion') {
        const { academicYearId } = filters.yearPromotion
        if (!academicYearId) {
          toast.error('Chon nam hoc')
          return
        }
        const res = await reportApi.yearPromotionSummary(academicYearId)
        setReportData((prev) => ({ ...prev, yearPromotion: res.data.data }))
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Khong the tai bao cao')
    } finally {
      setReportLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const cards = useMemo(() => ([
    { key: 'subjectPass' as const, icon: BookOpen },
    { key: 'classPromotion' as const, icon: School },
    { key: 'semesterPromotion' as const, icon: CalendarRange },
    { key: 'yearPromotion' as const, icon: GraduationCap },
  ]), [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const active = reportData[activeReport]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bao cao hoc vu</h1>
          <p className="text-sm text-gray-600 mt-1">Trang nay chi de xem bao cao. Nghiep vu xet len lop da tach sang trang rieng.</p>
        </div>
        <Link href="/promotion" className="btn-outline">
          <GraduationCap className="mr-2 h-4 w-4" />
          Sang trang xet len lop
        </Link>
      </div>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label">Nam hoc dashboard</label>
            <select
              className="input"
              value={dashboardScope.academicYearId}
              onChange={(e) => setDashboardScope((prev) => ({ ...prev, academicYearId: e.target.value }))}
            >
              <option value="">Chon nam hoc</option>
              {years.map((item) => (
                <option key={item.id} value={item.id}>{item.startYear}-{item.endYear}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Hoc ky dashboard</label>
            <select
              className="input"
              value={dashboardScope.semesterId}
              onChange={(e) => setDashboardScope((prev) => ({ ...prev, semesterId: e.target.value }))}
            >
              <option value="">Chon hoc ky</option>
              {semesters.map((item) => (
                <option key={item.id} value={item.id}>{formatSemesterLabel(item)}</option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Tong hoc sinh</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{dashboardLoading ? '--' : (dashboardData?.stats?.totalStudents ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Tong lop</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{dashboardLoading ? '--' : (dashboardData?.stats?.totalClasses ?? 0)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {cards.map(({ key, icon: Icon }) => (
          <article key={key} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{REPORT_TITLE[key]}</h2>
                <p className="text-sm text-gray-600 mt-1">Bo loc rieng cho tung bao cao.</p>
              </div>
              <Icon className="h-5 w-5 text-primary" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {key === 'subjectPass' ? (
                <>
                  <select className="input" value={filters.subjectPass.subjectId} onChange={(e) => setFilters((prev) => ({ ...prev, subjectPass: { ...prev.subjectPass, subjectId: e.target.value } }))}>
                    <option value="">Chon mon</option>
                    {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select className="input" value={filters.subjectPass.semesterId} onChange={(e) => setFilters((prev) => ({ ...prev, subjectPass: { ...prev.subjectPass, semesterId: e.target.value } }))}>
                    <option value="">Chon hoc ky</option>
                    {semesters.map((item) => <option key={item.id} value={item.id}>{formatSemesterLabel(item)}</option>)}
                  </select>
                </>
              ) : null}

              {key === 'classPromotion' ? (
                <>
                  <select className="input" value={filters.classPromotion.classId} onChange={(e) => setFilters((prev) => ({ ...prev, classPromotion: { ...prev.classPromotion, classId: e.target.value } }))}>
                    <option value="">Chon lop</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select className="input" value={filters.classPromotion.semesterId} onChange={(e) => setFilters((prev) => ({ ...prev, classPromotion: { ...prev.classPromotion, semesterId: e.target.value } }))}>
                    <option value="">Chon hoc ky</option>
                    {semesters.map((item) => <option key={item.id} value={item.id}>{formatSemesterLabel(item)}</option>)}
                  </select>
                </>
              ) : null}

              {key === 'semesterPromotion' ? (
                <select className="input md:col-span-2" value={filters.semesterPromotion.semesterId} onChange={(e) => setFilters((prev) => ({ ...prev, semesterPromotion: { semesterId: e.target.value } }))}>
                  <option value="">Chon hoc ky</option>
                  {semesters.map((item) => <option key={item.id} value={item.id}>{formatSemesterLabel(item)}</option>)}
                </select>
              ) : null}

              {key === 'yearPromotion' ? (
                <select className="input md:col-span-2" value={filters.yearPromotion.academicYearId} onChange={(e) => setFilters((prev) => ({ ...prev, yearPromotion: { academicYearId: e.target.value } }))}>
                  <option value="">Chon nam hoc</option>
                  {years.map((item) => <option key={item.id} value={item.id}>{item.startYear}-{item.endYear}</option>)}
                </select>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {reportData[key]?.summary
                  ? `Ty le hien tai: ${formatPercent(reportData[key].summary.passRate)}`
                  : 'Chua tai bao cao'}
              </div>
              <button onClick={() => loadReport(key)} className="btn-primary" disabled={reportLoading[key]}>
                {reportLoading[key] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                Xem bao cao
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-gray-900">{REPORT_TITLE[activeReport]}</h2>
        {!active?.summary ? (
          <p className="mt-2 text-sm text-gray-600">Chon bo loc va bam "Xem bao cao" de hien thi du lieu.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Tong xet</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{active.summary.totalStudents ?? 0}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Dat</p>
                <p className="mt-1 text-xl font-bold text-green-700">{active.summary.passStudents ?? active.summary.totalPassed ?? 0}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Chua dat</p>
                <p className="mt-1 text-xl font-bold text-rose-700">{active.summary.failStudents ?? ((active.summary.totalStudents ?? 0) - (active.summary.passStudents ?? active.summary.totalPassed ?? 0))}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Ty le</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{formatPercent(active.summary.passRate)}</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
