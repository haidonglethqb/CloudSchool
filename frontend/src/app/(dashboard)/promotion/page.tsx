'use client'

import { useEffect, useMemo, useState } from 'react'
import { academicYearApi, classApi, promotionApi, reportApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Loader2, CheckCircle2, AlertTriangle, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

type PromotionResultData = {
  passStudents: any[]
  failStudents: any[]
  nextAcademicYear?: { id: string; startYear: number; endYear: number } | null
}

export default function PromotionPage() {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [filters, setFilters] = useState({ classId: '', academicYearId: '' })
  const [results, setResults] = useState<PromotionResultData | null>(null)
  const [failAssignments, setFailAssignments] = useState<Record<string, string>>({})
  const [missingDetails, setMissingDetails] = useState<any[]>([])
  const [graduationData, setGraduationData] = useState<any>(null)

  useEffect(() => {
    Promise.all([classApi.list(), academicYearApi.list()])
      .then(([classRes, yearRes]) => {
        const classRows = classRes.data.data || []
        const yearRows = yearRes.data.data || []
        const activeYearId = yearRows.find((item: any) => item.isActive)?.id || yearRows[0]?.id || ''
        setClasses(classRows)
        setYears(yearRows)
        setFilters((prev) => ({ ...prev, academicYearId: prev.academicYearId || activeYearId }))
      })
      .catch(() => toast.error('Khong the tai du lieu xet len lop'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!filters.academicYearId) {
      setGraduationData(null)
      return
    }
    reportApi.graduationSummary(filters.academicYearId)
      .then((res) => setGraduationData(res.data.data))
      .catch(() => setGraduationData(null))
  }, [filters.academicYearId])

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes])

  const getAllowedFailClasses = (studentRow: any) => {
    const currentGrade = Number(studentRow?.class?.grade?.level || 0)
    const nextAcademicYearId = results?.nextAcademicYear?.id
    return classes.filter((item) => {
      if (item.id === studentRow.classId) return false
      if (nextAcademicYearId && item.academicYearId !== nextAcademicYearId) return false
      const targetGrade = Number(item?.grade?.level || 0)
      return targetGrade <= currentGrade
    })
  }

  const runEvaluation = async () => {
    if (!filters.academicYearId) {
      toast.error('Vui long chon nam hoc')
      return
    }

    try {
      setRunning(true)
      setMissingDetails([])
      setResults(null)
      setFailAssignments({})

      await promotionApi.evaluateYearEnd({
        academicYearId: filters.academicYearId,
        classId: filters.classId || undefined,
      })
      const resultRes = await promotionApi.getYearEndResults({
        academicYearId: filters.academicYearId,
        classId: filters.classId || undefined,
      })
      setResults(resultRes.data.data)
      toast.success('Da chay xet len lop')
    } catch (error: any) {
      const err = error.response?.data?.error
      if (err?.code === 'MISSING_SCORES') {
        setMissingDetails(err.details || [])
      }
      if (err?.code === 'SEMESTER_NOT_FINISHED') {
        const detail = err?.details?.[0]
        const dateText = detail?.endDate ? formatDate(detail.endDate) : null
        toast.error(dateText ? `${detail?.reason || err.message} (ket thuc: ${dateText})` : (err?.message || 'Khong the xet len lop'))
      } else {
        toast.error(err?.message || 'Xet len lop that bai')
      }
    } finally {
      setRunning(false)
    }
  }

  const executePromotion = async () => {
    if (!filters.academicYearId || !results) return
    try {
      setRunning(true)
      const failRows = results.failStudents
        .filter((item) => failAssignments[item.studentId])
        .map((item) => ({ studentId: item.studentId, toClassId: failAssignments[item.studentId] }))

      const res = await promotionApi.executeYearEnd({
        academicYearId: filters.academicYearId,
        failAssignments: failRows,
      })
      toast.success(`Da thuc thi: ${res.data.data.summary.promoted} len lop, ${res.data.data.summary.archived} luu tru`)

      const refreshRes = await promotionApi.getYearEndResults({
        academicYearId: filters.academicYearId,
        classId: filters.classId || undefined,
      })
      setResults(refreshRes.data.data)
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thuc thi xet len lop that bai')
    } finally {
      setRunning(false)
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xet len lop</h1>
        <p className="mt-1 text-sm text-gray-600">Thao tac xet len lop da tach rieng khoi trang Bao cao.</p>
      </div>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Nam hoc</label>
            <select
              className="input"
              value={filters.academicYearId}
              onChange={(e) => setFilters((prev) => ({ ...prev, academicYearId: e.target.value }))}
            >
              <option value="">Chon nam hoc</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Loc theo lop</label>
            <select
              className="input"
              value={filters.classId}
              onChange={(e) => setFilters((prev) => ({ ...prev, classId: e.target.value }))}
            >
              <option value="">Tat ca lop</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={runEvaluation} disabled={running} className="btn-primary">
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}
              Chay xet
            </button>
            {results ? (
              <button onClick={executePromotion} disabled={running} className="btn-outline">
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Thuc thi
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {missingDetails.length > 0 ? (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-semibold">Con thieu diem, chua the xet</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="table-header">Hoc sinh</th>
                  <th className="table-header">Lop</th>
                  <th className="table-header">Mon</th>
                  <th className="table-header">Hoc ky</th>
                  <th className="table-header">Cot diem thieu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {missingDetails.slice(0, 100).map((item: any, idx: number) => (
                  <tr key={`${item.studentId}-${item.subjectName}-${idx}`}>
                    <td className="table-cell">{item.studentName}</td>
                    <td className="table-cell">{item.className}</td>
                    <td className="table-cell">{item.subjectName}</td>
                    <td className="table-cell">{item.semesterName}</td>
                    <td className="table-cell">{(item.missingComponents || []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {results ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Hoc sinh len lop</p>
              <p className="mt-2 text-2xl font-bold text-green-700">{results.passStudents.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Hoc sinh chua dat</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{results.failStudents.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Nam hoc dich</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {results.nextAcademicYear ? `${results.nextAcademicYear.startYear}-${results.nextAcademicYear.endYear}` : 'Chua co'}
              </p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="font-semibold">Danh sach len lop</h2>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="table-header">Ma HS</th>
                      <th className="table-header">Ho ten</th>
                      <th className="table-header">Lop hien tai</th>
                      <th className="table-header">Lop dich</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.passStudents.map((item: any) => (
                      <tr key={item.id}>
                        <td className="table-cell">{item.student.studentCode}</td>
                        <td className="table-cell">{item.student.fullName}</td>
                        <td className="table-cell">{item.class?.name}</td>
                        <td className="table-cell">
                          {item.isGraduating ? 'Tot nghiep' : (item.autoTargetClassName || 'Can bo tri thu cong')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="font-semibold">Danh sach chua dat</h2>
              </div>
              <div className="max-h-[420px] overflow-auto space-y-3">
                {results.failStudents.map((item: any) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                    <p className="font-medium text-gray-900">{item.student.fullName} ({item.student.studentCode})</p>
                    <p className="text-xs text-gray-500">{item.class?.name} • TB: {item.average}</p>
                    <select
                      className="input mt-2"
                      value={failAssignments[item.studentId] || ''}
                      onChange={(e) => setFailAssignments((prev) => ({ ...prev, [item.studentId]: e.target.value }))}
                    >
                      <option value="">Chua bo tri lai lop</option>
                      {getAllowedFailClasses(item).map((row: any) => (
                        <option key={row.id} value={row.id}>{row.name} ({row.grade?.name})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className="card p-5">
        <h2 className="font-semibold text-gray-900">Tot nghiep nam hoc</h2>
        <p className="mt-1 text-sm text-gray-600">Tong hop hoc sinh lop cuoi cap da luu tru sau khi thuc thi xet len lop.</p>
        <p className="mt-3 text-sm text-gray-700">Tong so: {graduationData?.summary?.totalGraduated || 0}</p>
      </section>
    </div>
  )
}
