'use client'

import { useEffect, useState } from 'react'
import { academicYearApi, settingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Plus, Loader2, Trash2, Edit2, X, CheckCircle2, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'

interface Semester {
  id: string
  name: string
  semesterNum: number
  startDate: string
  endDate: string
  isActive: boolean
}

interface AcademicYear {
  id: string
  startYear: number
  endYear: number
  startDate: string
  endDate: string
  isActive: boolean
  semesters: Semester[]
}

export default function AcademicYearsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN'

  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [maxSemesters, setMaxSemesters] = useState(2)

  const [showYearModal, setShowYearModal] = useState(false)
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null)
  const [yearForm, setYearForm] = useState({
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 1,
    startDate: '',
    endDate: ''
  })

  const [showSemesterModal, setShowSemesterModal] = useState(false)
  const [semesterYear, setSemesterYear] = useState<AcademicYear | null>(null)
  const [semesterForm, setSemesterForm] = useState({
    semesterNum: 1,
    name: '',
    startDate: '',
    endDate: ''
  })

  const fetchData = async () => {
    try {
      const [yearRes, settingRes] = await Promise.all([academicYearApi.list(), settingsApi.get()])
      setYears(yearRes.data.data || [])
      setMaxSemesters(settingRes.data.data?.maxSemesters || 2)
    } catch {
      toast.error('Không thể tải dữ liệu năm học')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openCreateYear = () => {
    const current = new Date().getFullYear()
    setEditingYear(null)
    setYearForm({ startYear: current, endYear: current + 1, startDate: `${current}-09-01`, endDate: `${current + 1}-08-31` })
    setShowYearModal(true)
  }

  const openEditYear = (year: AcademicYear) => {
    setEditingYear(year)
    setYearForm({
      startYear: year.startYear,
      endYear: year.endYear,
      startDate: year.startDate?.slice(0, 10) || '',
      endDate: year.endDate?.slice(0, 10) || ''
    })
    setShowYearModal(true)
  }

  const submitYear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (yearForm.startYear >= yearForm.endYear) return toast.error('Năm bắt đầu phải nhỏ hơn năm kết thúc')
    if (!yearForm.startDate || !yearForm.endDate) return toast.error('Cần chọn ngày bắt đầu/kết thúc')
    if (new Date(yearForm.startDate) >= new Date(yearForm.endDate)) return toast.error('Ngày bắt đầu phải trước ngày kết thúc')

    try {
      setSaving(true)
      if (editingYear) {
        await academicYearApi.update(editingYear.id, yearForm)
        toast.success('Cập nhật năm học thành công')
      } else {
        await academicYearApi.create(yearForm)
        toast.success('Tạo năm học thành công')
      }
      setShowYearModal(false)
      await fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thao tác thất bại')
    } finally {
      setSaving(false)
    }
  }

  const activateYear = async (id: string) => {
    try {
      await academicYearApi.activate(id)
      toast.success('Đã kích hoạt năm học')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Kích hoạt thất bại')
    }
  }

  const deleteYear = async (id: string) => {
    if (!confirm('Xóa năm học này?')) return
    try {
      await academicYearApi.delete(id)
      toast.success('Xóa năm học thành công')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xóa năm học thất bại')
    }
  }

  const openCreateSemester = (year: AcademicYear) => {
    const usedNums = new Set(year.semesters.map((s) => s.semesterNum))
    const nextNum = Array.from({ length: maxSemesters }, (_, i) => i + 1).find((n) => !usedNums.has(n)) || 1
    setSemesterYear(year)
    setSemesterForm({
      semesterNum: nextNum,
      name: `Học kỳ ${nextNum}`,
      startDate: year.startDate?.slice(0, 10) || '',
      endDate: year.endDate?.slice(0, 10) || ''
    })
    setShowSemesterModal(true)
  }

  const submitSemester = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!semesterYear) return
    if (!semesterForm.startDate || !semesterForm.endDate) return toast.error('Cần chọn ngày bắt đầu/kết thúc')
    try {
      setSaving(true)
      await academicYearApi.createSemester(semesterYear.id, semesterForm)
      toast.success('Thêm học kỳ thành công')
      setShowSemesterModal(false)
      await fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thêm học kỳ thất bại')
    } finally {
      setSaving(false)
    }
  }

  const toggleSemesterActive = async (yearId: string, semester: Semester) => {
    try {
      await academicYearApi.updateSemester(yearId, semester.id, { isActive: !semester.isActive })
      toast.success('Cập nhật học kỳ thành công')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Cập nhật học kỳ thất bại')
    }
  }

  const deleteSemester = async (yearId: string, semesterId: string) => {
    if (!confirm('Xóa học kỳ này?')) return
    try {
      await academicYearApi.deleteSemester(yearId, semesterId)
      toast.success('Xóa học kỳ thành công')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xóa học kỳ thất bại')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Năm học & Học kỳ</h1>
          <p className="text-sm text-gray-600 mt-1">Số học kỳ tối đa theo quy định: {maxSemesters}</p>
        </div>
        {isAdmin && (
          <button onClick={openCreateYear} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> Thêm năm học
          </button>
        )}
      </div>

      <div className="space-y-4">
        {years.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">Chưa có năm học nào</div>
        ) : years.map((year) => (
          <div key={year.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{year.startYear}-{year.endYear}</p>
                  {year.isActive && <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Đang hoạt động</span>}
                </div>
                <p className="text-sm text-gray-600 mt-1">{new Date(year.startDate).toLocaleDateString('vi-VN')} - {new Date(year.endDate).toLocaleDateString('vi-VN')}</p>
                <p className="text-xs text-gray-500 mt-1">Học kỳ: {year.semesters.length}/{maxSemesters}</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {!year.isActive && (
                    <button onClick={() => activateYear(year.id)} className="p-2 text-green-700 hover:bg-green-50 rounded" title="Kích hoạt năm học">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => openEditYear(year)} className="p-2 text-gray-500 hover:bg-gray-100 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteYear(year.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Danh sách học kỳ</p>
                {isAdmin && year.semesters.length < maxSemesters && (
                  <button onClick={() => openCreateSemester(year)} className="text-xs text-primary hover:underline">+ Thêm học kỳ</button>
                )}
              </div>
              {year.semesters.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có học kỳ</p>
              ) : (
                <div className="space-y-2">
                  {year.semesters.map((semester) => (
                    <div key={semester.id} className="flex items-center justify-between bg-gray-50 border rounded px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{semester.name}</p>
                        <p className="text-xs text-gray-600">{new Date(semester.startDate).toLocaleDateString('vi-VN')} - {new Date(semester.endDate).toLocaleDateString('vi-VN')}</p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleSemesterActive(year.id, semester)} className={`text-xs px-2 py-1 rounded ${semester.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {semester.isActive ? 'Đang dùng' : 'Kích hoạt'}
                          </button>
                          <button onClick={() => deleteSemester(year.id, semester.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showYearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingYear ? 'Sửa năm học' : 'Thêm năm học'}</h2>
              <button onClick={() => setShowYearModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitYear} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Năm bắt đầu</label><input type="number" className="input" value={yearForm.startYear} onChange={(e) => setYearForm({ ...yearForm, startYear: Number(e.target.value) })} /></div>
                <div><label className="label">Năm kết thúc</label><input type="number" className="input" value={yearForm.endYear} onChange={(e) => setYearForm({ ...yearForm, endYear: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Ngày bắt đầu</label><input type="date" className="input" value={yearForm.startDate} onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })} /></div>
                <div><label className="label">Ngày kết thúc</label><input type="date" className="input" value={yearForm.endDate} onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowYearModal(false)} className="btn-outline flex-1">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSemesterModal && semesterYear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Thêm học kỳ ({semesterYear.startYear}-{semesterYear.endYear})</h2>
              <button onClick={() => setShowSemesterModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitSemester} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Số thứ tự kỳ</label>
                  <select className="input" value={semesterForm.semesterNum} onChange={(e) => setSemesterForm({ ...semesterForm, semesterNum: Number(e.target.value), name: `Học kỳ ${e.target.value}` })}>
                    {Array.from({ length: maxSemesters }, (_, i) => i + 1)
                      .filter((num) => !semesterYear.semesters.some((s) => s.semesterNum === num))
                      .map((num) => <option key={num} value={num}>Học kỳ {num}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tên hiển thị</label>
                  <input className="input" value={semesterForm.name} onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Ngày bắt đầu</label><input type="date" className="input" min={semesterYear.startDate?.slice(0, 10)} max={semesterYear.endDate?.slice(0, 10)} value={semesterForm.startDate} onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })} /></div>
                <div><label className="label">Ngày kết thúc</label><input type="date" className="input" min={semesterYear.startDate?.slice(0, 10)} max={semesterYear.endDate?.slice(0, 10)} value={semesterForm.endDate} onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSemesterModal(false)} className="btn-outline flex-1">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
