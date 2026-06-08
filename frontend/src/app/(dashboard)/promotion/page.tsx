'use client'

import { useEffect, useMemo, useState } from 'react'
import { academicYearApi, classApi, promotionApi, reportApi } from '@/lib/api'
import { getApiError, resolveUiErrorMessage } from '@/lib/ui-error'
import { formatDate, getGenderLabel } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Clock, GraduationCap, Loader2, UserX } from 'lucide-react'
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
  const [filters, setFilters] = useState({ academicYearId: '' })
  const [results, setResults] = useState<PromotionResultData | null>(null)
  const [failAssignments, setFailAssignments] = useState<Record<string, string>>({})
  const [inactiveReasons, setInactiveReasons] = useState<Record<string, string>>({})
  const [processingPlacementId, setProcessingPlacementId] = useState('')
  const [missingDetails, setMissingDetails] = useState<any[]>([])
  const [graduationData, setGraduationData] = useState<any>(null)

  const isActiveYear = useMemo(() => {
    const selectedYear = years.find((y) => y.id === filters.academicYearId)
    return selectedYear?.isActive ?? false
  }, [years, filters.academicYearId])

  useEffect(() => {
    academicYearApi.list()
      .then((yearRes) => {
        const yearRows = yearRes.data.data || []
        const activeYearId = yearRows.find((item: any) => item.isActive)?.id || yearRows[0]?.id || ''
        setYears(yearRows)
        setFilters((prev) => ({ ...prev, academicYearId: prev.academicYearId || activeYearId }))
      })
      .catch(() => toast.error('Không thể tải dữ liệu xét lên lớp.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!filters.academicYearId) {
      setResults(null)
      setGraduationData(null)
      return
    }
    setResults(null)
    setGraduationData(null)

    promotionApi.getYearEndResults({ academicYearId: filters.academicYearId })
      .then((res) => {
        const data = res.data.data
        if (data && (data.passStudents?.length > 0 || data.failStudents?.length > 0)) {
          setResults(data)
          if (data.nextAcademicYear?.id) {
            classApi.list({ academicYearId: data.nextAcademicYear.id })
              .then((classRes) => setClasses(classRes.data.data || []))
              .catch(() => {})
          }
        }
      })
      .catch(() => {})

    reportApi.graduationSummary(filters.academicYearId)
      .then((res) => setGraduationData(res.data.data))
      .catch(() => setGraduationData(null))
  }, [filters.academicYearId])

  const pendingFailedStudents = useMemo(() => {
    return (results?.failStudents || []).filter((item: any) => !['ASSIGNED', 'INACTIVE'].includes(item.placementStatus))
  }, [results])

  const refreshResults = async () => {
    if (!filters.academicYearId) return
    const resultRes = await promotionApi.getYearEndResults({
      academicYearId: filters.academicYearId,
    })
    const data = resultRes.data.data
    setResults(data)
    if (data.nextAcademicYear?.id) {
      const classRes = await classApi.list({ academicYearId: data.nextAcademicYear.id })
      setClasses(classRes.data.data || [])
    } else {
      setClasses([])
    }
    const gradRes = await reportApi.graduationSummary(filters.academicYearId).catch(() => null)
    if (gradRes) setGraduationData(gradRes.data.data)
  }

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return '-'
    const birth = new Date(dateOfBirth)
    if (Number.isNaN(birth.getTime())) return '-'
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const monthDiff = now.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
    return age
  }

  const getPlacementLabel = (status?: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Chờ phân lớp',
      DRAFTED: 'Đã chọn dự kiến',
      ASSIGNED: 'Đã phân lớp',
      INACTIVE: 'Đã ngừng học',
      GRADUATED: 'Tốt nghiệp',
    }
    return labels[status || 'PENDING'] || status || 'Chờ phân lớp'
  }

  const getAllowedFailClasses = (studentRow: any) => {
    const currentGrade = Number(studentRow?.class?.grade?.level || 0)
    const nextAcademicYearId = results?.nextAcademicYear?.id
    return classes.filter((item) => {
      if (item.id === studentRow.classId) return false
      if (nextAcademicYearId && item.academicYearId !== nextAcademicYearId) return false
      const targetGrade = Number(item?.grade?.level || 0)
      return targetGrade === currentGrade
    })
  }

  const runEvaluation = async () => {
    if (!filters.academicYearId) {
      toast.error('Vui lòng chọn năm học.')
      return
    }

    try {
      setRunning(true)
      setMissingDetails([])
      setResults(null)
      setFailAssignments({})
      setInactiveReasons({})
      await promotionApi.evaluateYearEnd({
        academicYearId: filters.academicYearId,
      })
      await refreshResults()
      toast.success('Đã chạy xét lên lớp.')
    } catch (error: any) {
      const apiError = getApiError(error)
      if (apiError.code === 'MISSING_SCORES') setMissingDetails(apiError.details || [])
      if (apiError.code === 'SEMESTER_NOT_FINISHED') {
        const detail = apiError?.details?.[0] as { endDate?: string | Date; reason?: string } | undefined
        const dateText = detail?.endDate ? formatDate(detail.endDate) : null
        const message = resolveUiErrorMessage(error, 'Không thể xét lên lớp.')
        toast.error(dateText ? `${detail?.reason || message} (kết thúc: ${dateText})` : message)
      } else {
        toast.error(resolveUiErrorMessage(error, 'Xét lên lớp thất bại.'))
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

      let res
      try {
        res = await promotionApi.executeYearEnd({ academicYearId: filters.academicYearId, failAssignments: failRows })
      } catch (error: any) {
        const apiError = getApiError(error)
        if (apiError.code !== 'MISSING_TARGET_CLASSES') throw error
        const details = apiError.details || []
        const message = details.map((item: any) => `${item.sourceClassName} -> ${item.targetClassName}`).join(', ')
        if (!confirm(`Hành động này sẽ tạo thêm lớp đích vì chưa có: ${message}. Xác nhận tạo lớp và thực thi?`)) throw error
        res = await promotionApi.executeYearEnd({
          academicYearId: filters.academicYearId,
          failAssignments: failRows,
          confirmCreateMissingClasses: true,
        })
      }
      toast.success(`Đã thực thi: ${res.data.data.summary.promoted} lên lớp, ${res.data.data.summary.archived} tốt nghiệp`)

      // Re-fetch academic years so the newly activated year is reflected in the UI.
      // This also ensures /classes page will auto-switch to the new active year on next visit.
      try {
        const yearRes = await academicYearApi.list()
        const yearRows = yearRes.data.data || []
        setYears(yearRows)
        // If the newly activated year differs from the filter, switch to it
        const newActiveId = yearRows.find((y: any) => y.isActive)?.id
        if (newActiveId && newActiveId !== filters.academicYearId) {
          setFilters((prev) => ({ ...prev, academicYearId: newActiveId }))
          return // refreshResults will be triggered by the filter change effect
        }
      } catch {
        // non-critical
      }

      await refreshResults()
    } catch (error: any) {
      toast.error(resolveUiErrorMessage(error, 'Thực thi xét lên lớp thất bại.'))
    } finally {
      setRunning(false)
    }
  }

  const saveFailedPlacement = async (item: any, action: 'draft' | 'assign' | 'inactive') => {
    const toClassId = failAssignments[item.studentId] || item.latestPlacementHistory?.toClassId || ''
    const reason = inactiveReasons[item.id] || ''
    if ((action === 'draft' || action === 'assign') && !toClassId) return toast.error('Vui lòng chọn lớp đích.')
    if (action === 'inactive' && !reason.trim()) return toast.error('Vui lòng nhập lý do ngừng học.')

    try {
      setProcessingPlacementId(`${item.id}-${action}`)
      await promotionApi.updateFailedPlacement(item.id, {
        action,
        toClassId: action === 'inactive' ? undefined : toClassId,
        reason: action === 'inactive' ? reason : undefined,
      })
      toast.success(action === 'inactive' ? 'Đã ngừng học sinh.' : action === 'assign' ? 'Đã phân lớp.' : 'Đã lưu lớp dự kiến.')
      await refreshResults()
    } catch (error: any) {
      toast.error(resolveUiErrorMessage(error, 'Không thể cập nhật phân lớp.'))
    } finally {
      setProcessingPlacementId('')
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
        <h1 className="text-2xl font-bold text-gray-900">Xét lên lớp</h1>
        <p className="mt-1 text-sm text-gray-600">Xét cuối năm, phân lớp học sinh chưa đạt và theo dõi tốt nghiệp.</p>
      </div>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="label">Năm học</label>
            <select className="input" value={filters.academicYearId} onChange={(e) => setFilters((prev) => ({ ...prev, academicYearId: e.target.value }))}>
              <option value="">Chọn năm học</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={runEvaluation} disabled={running} className="btn-primary">
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}
              Chạy xét
            </button>
            {results ? <button onClick={executePromotion} disabled={running} className="btn-outline">Thực thi</button> : null}
          </div>
        </div>
      </section>

      {!results && filters.academicYearId && (
        <section className="card p-6 text-center text-gray-500">
          Chưa có dữ liệu xét lên lớp. Vui lòng bấm "Chạy xét" để bắt đầu.
        </section>
      )}

      {missingDetails.length > 0 ? (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-semibold">Còn thiếu điểm, chưa thể xét</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="table-header">Học sinh</th>
                  <th className="table-header">Lớp</th>
                  <th className="table-header">Môn</th>
                  <th className="table-header">Học kỳ</th>
                  <th className="table-header">Cột điểm thiếu</th>
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
          <section className="grid gap-4 md:grid-cols-4">
            <div className="card p-4"><p className="text-sm text-gray-500">Học sinh lên lớp</p><p className="mt-2 text-2xl font-bold text-green-700">{results.passStudents.length}</p></div>
            <div className="card p-4"><p className="text-sm text-gray-500">Học sinh chưa đạt</p><p className="mt-2 text-2xl font-bold text-rose-700">{results.failStudents.length}</p></div>
            <div className="card p-4"><p className="text-sm text-gray-500">Chờ phân lớp</p><p className="mt-2 text-2xl font-bold text-amber-700">{pendingFailedStudents.length}</p></div>
            <div className="card p-4"><p className="text-sm text-gray-500">Năm học đích</p><p className="mt-2 text-lg font-semibold text-gray-900">{results.nextAcademicYear ? `${results.nextAcademicYear.startYear}-${results.nextAcademicYear.endYear}` : 'Chưa có'}</p></div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <h2 className="font-semibold">Danh sách lên lớp</h2>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr><th className="table-header">Mã HS</th><th className="table-header">Họ tên</th><th className="table-header">Lớp hiện tại</th><th className="table-header">Lớp đích</th><th className="table-header">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.passStudents.map((item: any) => (
                    <tr key={item.id}>
                      <td className="table-cell">{item.student.studentCode}</td>
                      <td className="table-cell">{item.student.fullName}</td>
                      <td className="table-cell">{item.class?.name}</td>
                      <td className="table-cell">{item.isGraduating ? 'Tốt nghiệp' : (item.autoTargetClassName || 'Cần tạo lớp đích')}</td>
                      <td className="table-cell">{getPlacementLabel(item.placementStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-rose-700">
              <Clock className="h-5 w-5" />
              <h2 className="font-semibold">Học sinh chưa đạt chờ phân lớp</h2>
            </div>
            <div className="space-y-3">
              {pendingFailedStudents.length === 0 ? <p className="text-sm text-gray-500">Không còn học sinh chờ phân lớp.</p> : null}
              {pendingFailedStudents.map((item: any) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_220px_1fr_auto]">
                    <div>
                      <p className="font-medium text-gray-900">{item.student.fullName} ({item.student.studentCode})</p>
                      <p className="text-xs text-gray-500">{item.class?.name} • TB: {item.average} • {getPlacementLabel(item.placementStatus)}</p>
                    </div>
                    <select className="input" value={failAssignments[item.studentId] || item.latestPlacementHistory?.toClassId || ''} onChange={(e) => setFailAssignments((prev) => ({ ...prev, [item.studentId]: e.target.value }))}>
                      <option value="">Chưa bố trí lại lớp</option>
                      {getAllowedFailClasses(item).map((row: any) => <option key={row.id} value={row.id}>{row.name} ({row.grade?.name})</option>)}
                    </select>
                    <input className="input" placeholder="Lý do ngừng học nếu cần" value={inactiveReasons[item.id] || ''} onChange={(e) => setInactiveReasons((prev) => ({ ...prev, [item.id]: e.target.value }))} />
                    <div className="flex gap-2">
                      <button className="btn-outline" disabled={!!processingPlacementId} onClick={() => saveFailedPlacement(item, 'draft')}>Lưu chọn</button>
                      <button className="btn-primary" disabled={!!processingPlacementId} onClick={() => saveFailedPlacement(item, 'assign')}>Phân lớp</button>
                      <button className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50" disabled={!!processingPlacementId} onClick={() => saveFailedPlacement(item, 'inactive')} title="Ngừng học sinh">
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {item.placementHistory?.length ? (
                    <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                      {item.placementHistory.slice(0, 4).map((history: any) => (
                        <p key={history.id}>
                          {formatDate(history.createdAt)} • {history.actorName} • {getPlacementLabel(history.action === 'DRAFT_TARGET' ? 'DRAFTED' : history.action)} {history.toClass?.name ? `→ ${history.toClass.name}` : ''} {history.reason ? `• ${history.reason}` : ''}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="card p-5">
        <h2 className="font-semibold text-gray-900">Học sinh tốt nghiệp</h2>
        <p className="mt-1 text-sm text-gray-600">Danh sách học sinh lớp cuối cấp đã tốt nghiệp sau khi thực thi xét lên lớp.</p>
        <p className="mt-3 text-sm text-gray-700">Tổng số: {graduationData?.summary?.totalGraduated || 0}</p>
        <div className="mt-3 max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr><th className="table-header">Lớp</th><th className="table-header">Mã HS</th><th className="table-header">Họ tên</th><th className="table-header">Giới tính</th><th className="table-header">Tuổi</th><th className="table-header">Khóa</th><th className="table-header">Ngày lưu</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(graduationData?.graduates || []).map((item: any) => (
                <tr key={item.id}>
                  <td className="table-cell">{item.sourceClass?.name || '-'}</td>
                  <td className="table-cell">{item.student?.studentCode}</td>
                  <td className="table-cell">{item.student?.fullName}</td>
                  <td className="table-cell">{getGenderLabel(item.student?.gender)}</td>
                  <td className="table-cell">{item.age ?? calculateAge(item.student?.dateOfBirth)}</td>
                  <td className="table-cell">{item.courseLabel}</td>
                  <td className="table-cell">{formatDate(item.promotedAt || item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
