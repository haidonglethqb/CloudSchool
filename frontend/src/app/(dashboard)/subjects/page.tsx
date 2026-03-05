'use client'

import { useEffect, useState, useCallback } from 'react'
import { subjectApi, scoreComponentApi } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Plus, Loader2, X, Trash2, Pencil, BookOpen,
  ChevronDown, ChevronRight, Layers,
} from 'lucide-react'

interface ScoreComponent {
  id: string
  name: string
  weight: number
}

interface Subject {
  id: string
  code: string
  name: string
  description: string | null
  scoreComponents: ScoreComponent[]
}

interface Semester {
  id: string
  name: string
  year: number
  term: number
  isActive: boolean
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Subject form
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', description: '' })
  const [savingSubject, setSavingSubject] = useState(false)

  // Score component form
  const [showCompForm, setShowCompForm] = useState<string | null>(null)
  const [editingComp, setEditingComp] = useState<string | null>(null)
  const [compForm, setCompForm] = useState({ name: '', weight: 0 })
  const [savingComp, setSavingComp] = useState(false)

  // Semester form
  const [showSemForm, setShowSemForm] = useState(false)
  const [semForm, setSemForm] = useState({ name: '', year: String(new Date().getFullYear()), semesterNum: 1 })
  const [savingSem, setSavingSem] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([subjectApi.list(), subjectApi.getSemesters()])
      .then(([subRes, semRes]) => {
        setSubjects(subRes.data.data || [])
        setSemesters(semRes.data.data || [])
      })
      .catch(() => toast.error('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  /* ========== Subject CRUD ========== */
  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm({ code: '', name: '', description: '' })
    setShowSubjectForm(true)
  }

  const openEditSubject = (s: Subject) => {
    setEditingSubject(s.id)
    setSubjectForm({ code: s.code, name: s.name, description: s.description || '' })
    setShowSubjectForm(true)
  }

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subjectForm.code || !subjectForm.name) { toast.error('Vui lòng điền đủ thông tin'); return }
    setSavingSubject(true)
    try {
      if (editingSubject) {
        await subjectApi.update(editingSubject, subjectForm)
        toast.success('Cập nhật thành công')
      } else {
        await subjectApi.create(subjectForm)
        toast.success('Thêm môn học thành công')
      }
      setShowSubjectForm(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi')
    } finally { setSavingSubject(false) }
  }

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Xóa môn học này?')) return
    try {
      await subjectApi.delete(id)
      toast.success('Đã xóa')
      fetchData()
    } catch (err: any) { toast.error(err.response?.data?.error?.message || 'Lỗi xóa') }
  }

  /* ========== Score Component CRUD ========== */
  const openAddComp = (subjectId: string) => {
    setEditingComp(null)
    setCompForm({ name: '', weight: 0 })
    setShowCompForm(subjectId)
  }

  const openEditComp = (subjectId: string, c: ScoreComponent) => {
    setEditingComp(c.id)
    setCompForm({ name: c.name, weight: c.weight })
    setShowCompForm(subjectId)
  }

  const handleCompSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!compForm.name || !compForm.weight) { toast.error('Vui lòng điền đủ thông tin'); return }
    setSavingComp(true)
    try {
      if (editingComp) {
        await scoreComponentApi.update(editingComp, compForm)
        toast.success('Cập nhật thành công')
      } else {
        await scoreComponentApi.create({ ...compForm, subjectId: showCompForm! })
        toast.success('Thêm cột điểm thành công')
      }
      setShowCompForm(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi')
    } finally { setSavingComp(false) }
  }

  const handleDeleteComp = async (id: string) => {
    if (!confirm('Xóa cột điểm này?')) return
    try {
      await scoreComponentApi.delete(id)
      toast.success('Đã xóa')
      fetchData()
    } catch (err: any) { toast.error(err.response?.data?.error?.message || 'Lỗi xóa') }
  }

  /* ========== Semester CRUD ========== */
  const handleSemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!semForm.name) { toast.error('Vui lòng nhập tên học kỳ'); return }
    setSavingSem(true)
    try {
      await subjectApi.createSemester(semForm)
      toast.success('Thêm học kỳ thành công')
      setShowSemForm(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi')
    } finally { setSavingSem(false) }
  }

  const handleDeleteSem = async (id: string) => {
    if (!confirm('Xóa học kỳ này?')) return
    try {
      await subjectApi.deleteSemester(id)
      toast.success('Đã xóa')
      fetchData()
    } catch (err: any) { toast.error(err.response?.data?.error?.message || 'Lỗi xóa') }
  }

  const toggleActiveSem = async (id: string) => {
    try {
      const sem = semesters.find(s => s.id === id)
      await subjectApi.updateSemester(id, { isActive: !sem?.isActive })
      toast.success('Cập nhật thành công')
      fetchData()
    } catch { toast.error('Lỗi') }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Môn học & Cột điểm</h1>
          <p className="text-gray-600 mt-1">Quản lý môn học, cột điểm (ScoreComponent) và học kỳ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSemForm(true)} className="btn-outline">
            <Plus className="w-4 h-4 mr-1" /> Học kỳ
          </button>
          <button onClick={openCreateSubject} className="btn-primary">
            <Plus className="w-4 h-4 mr-1" /> Môn học
          </button>
        </div>
      </div>

      {/* Semesters */}
      <div className="card p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Học kỳ</h3>
        {semesters.length === 0 ? (
          <p className="text-gray-500 text-sm">Chưa có học kỳ nào</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {semesters.map(s => (
              <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                <button onClick={() => toggleActiveSem(s.id)} className="font-medium hover:underline">{s.name}</button>
                <span className="text-xs">({s.year})</span>
                {s.isActive && <span className="text-xs font-bold">✓</span>}
                <button onClick={() => handleDeleteSem(s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subjects */}
      {subjects.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có môn học nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map(sub => {
            const totalWeight = sub.scoreComponents.reduce((s, c) => s + c.weight, 0)
            const isExpanded = expanded.has(sub.id)
            return (
              <div key={sub.id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(sub.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <p className="font-medium text-gray-900">{sub.name} <span className="text-xs text-gray-400 font-mono">({sub.code})</span></p>
                      {sub.description && <p className="text-xs text-gray-500">{sub.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${totalWeight === 100 ? 'bg-green-100 text-green-700' : totalWeight > 100 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {totalWeight}% / 100%
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); openEditSubject(sub) }} className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSubject(sub.id) }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Layers className="w-4 h-4" /> Cột điểm
                      </h4>
                      <button onClick={() => openAddComp(sub.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Thêm
                      </button>
                    </div>
                    {sub.scoreComponents.length === 0 ? (
                      <p className="text-xs text-gray-400">Chưa có cột điểm</p>
                    ) : (
                      <div className="space-y-1">
                        {sub.scoreComponents.map(c => (
                          <div key={c.id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded border">
                            <span className="text-sm">{c.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-primary">{c.weight}%</span>
                              <button onClick={() => openEditComp(sub.id, c)} className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteComp(c.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Subject Form Modal */}
      {showSubjectForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingSubject ? 'Sửa môn học' : 'Thêm môn học'}</h2>
              <button onClick={() => setShowSubjectForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubjectSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Mã *</label>
                  <input className="input" value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="TOAN" />
                </div>
                <div className="col-span-2">
                  <label className="label">Tên *</label>
                  <input className="input" value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Toán học" />
                </div>
              </div>
              <div>
                <label className="label">Mô tả</label>
                <input className="input" value={subjectForm.description} onChange={e => setSubjectForm({ ...subjectForm, description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSubjectForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={savingSubject} className="btn-primary">
                  {savingSubject && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingSubject ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Score Component Form Modal */}
      {showCompForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingComp ? 'Sửa cột điểm' : 'Thêm cột điểm'}</h2>
              <button onClick={() => setShowCompForm(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCompSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Tên cột *</label>
                <input className="input" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} placeholder="VD: Kiểm tra 15p, Giữa kỳ, Cuối kỳ" />
              </div>
              <div>
                <label className="label">Trọng số (%) *</label>
                <input type="number" min="1" max="100" className="input" value={compForm.weight} onChange={e => setCompForm({ ...compForm, weight: +e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">Tổng trọng số các cột ≤ 100%</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCompForm(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={savingComp} className="btn-primary">
                  {savingComp && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingComp ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Semester Form Modal */}
      {showSemForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Thêm học kỳ</h2>
              <button onClick={() => setShowSemForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSemSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Tên *</label>
                <input className="input" value={semForm.name} onChange={e => setSemForm({ ...semForm, name: e.target.value })} placeholder="VD: Học kỳ 1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Năm học</label>
                  <input type="number" className="input" value={semForm.year} onChange={e => setSemForm({ ...semForm, year: e.target.value })} />
                </div>
                <div>
                  <label className="label">Kỳ</label>
                  <select className="input" value={semForm.semesterNum} onChange={e => setSemForm({ ...semForm, semesterNum: +e.target.value })}>
                    <option value={1}>Kỳ 1</option>
                    <option value={2}>Kỳ 2</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSemForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={savingSem} className="btn-primary">
                  {savingSem && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Thêm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
