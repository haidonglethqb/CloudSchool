'use client'

import { useEffect, useState, useCallback } from 'react'
import { promotionApi, classApi, subjectApi } from '@/lib/api'
import { Loader2, AlertCircle, Calculator, CheckCircle, XCircle, RotateCcw, Pencil, ArrowUpRight, Archive } from 'lucide-react'
import toast from 'react-hot-toast'

interface Semester {
  id: string
  name: string
  isActive: boolean
}

interface Class {
  id: string
  name: string
  grade: { name: string }
}

interface PromotionRow {
  id: string
  student: {
    id: string
    studentCode: string
    fullName: string
  }
  class: { name: string }
  semester: { name: string }
  average: number | null
  result: 'PASS' | 'FAIL' | 'RETAKE'
  updatedAt: string
}

const resultLabels: Record<string, { label: string; color: string }> = {
  PASS: { label: 'Lên lớp', color: 'bg-green-100 text-green-700' },
  FAIL: { label: 'Ở lại', color: 'bg-red-100 text-red-700' },
  RETAKE: { label: 'Thi lại', color: 'bg-yellow-100 text-yellow-700' },
}

export default function PromotionPage() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [overrideResult, setOverrideResult] = useState<string>('')
  const [promoting, setPromoting] = useState(false)
  const [promoteResult, setPromoteResult] = useState<{
    promoted: any[]; graduated: any[]; retained: any[];
    summary: { totalPromoted: number; totalGraduated: number; totalRetained: number }
  } | null>(null)

  useEffect(() => {
    Promise.all([subjectApi.getSemesters(), classApi.list()])
      .then(([semRes, clsRes]) => {
        setSemesters(semRes.data.data || [])
        setClasses(clsRes.data.data || [])
        const active = semRes.data.data.find((s: Semester) => s.isActive)
        if (active) setSelectedSemester(active.id)
      })
      .catch(() => toast.error('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false))
  }, [])

  const fetchPromotions = useCallback(async () => {
    if (!selectedSemester) { setPromotions([]); return }
    try {
      setLoadingData(true)
      const res = await promotionApi.list({
        semesterId: selectedSemester,
        classId: selectedClass || undefined,
      })
      setPromotions(res.data.data || [])
    } catch {
      toast.error('Lỗi tải dữ liệu xét lên lớp')
    } finally { setLoadingData(false) }
  }, [selectedSemester, selectedClass])

  useEffect(() => { fetchPromotions() }, [fetchPromotions])

  const handleCalculate = async () => {
    if (!selectedSemester) { toast.error('Vui lòng chọn học kỳ'); return }
    try {
      setCalculating(true)
      await promotionApi.calculate({
        semesterId: selectedSemester,
        classId: selectedClass || undefined,
      })
      toast.success('Xét lên lớp thành công')
      fetchPromotions()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi xét lên lớp')
    } finally { setCalculating(false) }
  }

  const handleOverride = async () => {
    if (!overrideId || !overrideResult) return
    try {
      await promotionApi.override(overrideId, overrideResult)
      toast.success('Cập nhật kết quả thành công')
      setOverrideId(null)
      fetchPromotions()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi')
    }
  }

  const handlePromote = async () => {
    if (!selectedSemester) { toast.error('Vui lòng chọn học kỳ'); return }
    if (!confirm('Xác nhận chuyển lớp cuối năm? Học sinh PASS sẽ lên lớp, FAIL sẽ lưu ban, lớp 12 PASS sẽ tốt nghiệp.')) return
    try {
      setPromoting(true)
      const nextYear = new Date().getFullYear()
      const res = await promotionApi.promote({
        semesterId: selectedSemester,
        newAcademicYear: nextYear,
      })
      setPromoteResult(res.data.data)
      toast.success('Chuyển lớp cuối năm thành công')
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi chuyển lớp')
    } finally { setPromoting(false) }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  const stats = {
    total: promotions.length,
    pass: promotions.filter(p => p.result === 'PASS').length,
    fail: promotions.filter(p => p.result === 'FAIL').length,
    retake: promotions.filter(p => p.result === 'RETAKE').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xét lên lớp</h1>
          <p className="text-gray-600 text-sm mt-1">Tính điểm TB và xét kết quả lên lớp cho học sinh</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCalculate} disabled={calculating || !selectedSemester} className="btn-primary">
            {calculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            Xét lên lớp
          </button>
          {stats.total > 0 && (
            <button onClick={handlePromote} disabled={promoting || !selectedSemester} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
              {promoting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
              Chuyển lớp cuối năm
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Học kỳ</label>
            <select className="input" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
              <option value="">Chọn học kỳ</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive && '(Hiện tại)'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Lớp (tùy chọn)</label>
            <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Tất cả</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade.name})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {promotions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Tổng HS</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.pass}</p>
            <p className="text-sm text-gray-500">Lên lớp</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.retake}</p>
            <p className="text-sm text-gray-500">Thi lại</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.fail}</p>
            <p className="text-sm text-gray-500">Ở lại</p>
          </div>
        </div>
      )}

      {/* Year-end promote results */}
      {promoteResult && (
        <div className="card p-6 space-y-4 border-l-4 border-emerald-500">
          <h2 className="text-lg font-bold text-gray-900">Kết quả chuyển lớp cuối năm</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{promoteResult.summary.totalPromoted}</p>
              <p className="text-sm text-gray-600">Lên lớp</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{promoteResult.summary.totalGraduated}</p>
              <p className="text-sm text-gray-600">Tốt nghiệp</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{promoteResult.summary.totalRetained}</p>
              <p className="text-sm text-gray-600">Lưu ban</p>
            </div>
          </div>
          {promoteResult.graduated.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Học sinh tốt nghiệp</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {promoteResult.graduated.map((g: any) => (
                  <li key={g.student.id}>{g.student.fullName} ({g.student.studentCode}) - {g.fromClass}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {!selectedSemester ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Vui lòng chọn học kỳ</p>
        </div>
      ) : loadingData ? (
        <div className="card p-8 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" /></div>
      ) : promotions.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Chưa có dữ liệu xét lên lớp. Nhấn &quot;Xét lên lớp&quot; để tính toán.</p>
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
                  <th className="table-header">Lớp</th>
                  <th className="table-header text-center">Điểm TB</th>
                  <th className="table-header text-center">Kết quả</th>
                  <th className="table-header text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promotions.map((p, idx) => {
                  const r = resultLabels[p.result]
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="table-cell text-center">{idx + 1}</td>
                      <td className="table-cell font-mono text-xs">{p.student.studentCode}</td>
                      <td className="table-cell font-medium">{p.student.fullName}</td>
                      <td className="table-cell">{p.class.name}</td>
                      <td className="table-cell text-center font-semibold">
                        {p.average !== null ? p.average.toFixed(2) : '-'}
                      </td>
                      <td className="table-cell text-center">
                        {overrideId === p.id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <select className="text-xs border rounded px-1 py-0.5" value={overrideResult} onChange={e => setOverrideResult(e.target.value)}>
                              <option value="PASS">Lên lớp</option>
                              <option value="FAIL">Ở lại</option>
                              <option value="RETAKE">Thi lại</option>
                            </select>
                            <button onClick={handleOverride} className="text-xs text-primary hover:underline">OK</button>
                            <button onClick={() => setOverrideId(null)} className="text-xs text-gray-400 hover:underline">Hủy</button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
                            {p.result === 'PASS' ? <CheckCircle className="w-3 h-3" /> : p.result === 'FAIL' ? <XCircle className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                            {r.label}
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-center">
                        <button onClick={() => { setOverrideId(p.id); setOverrideResult(p.result) }} className="p-1 text-gray-400 hover:text-primary" title="Chỉnh sửa kết quả">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
