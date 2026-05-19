'use client'

import { useEffect, useState, useCallback } from 'react'
import { subjectApi, scoreComponentApi, settingsApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Loader2, X, Trash2, Pencil, BookOpen, ChevronDown, ChevronRight, Layers } from 'lucide-react'

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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [maxSubjects, setMaxSubjects] = useState<number>(9)

  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', description: '' })
  const [savingSubject, setSavingSubject] = useState(false)

  const [showCompForm, setShowCompForm] = useState<string | null>(null)
  const [editingComp, setEditingComp] = useState<string | null>(null)
  const [compForm, setCompForm] = useState({ name: '', weight: 0 })
  const [savingComp, setSavingComp] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([subjectApi.list(), settingsApi.get()])
      .then(([subjectRes, settingRes]) => {
        setSubjects(subjectRes.data.data || [])
        if (settingRes.data.data?.maxSubjects) setMaxSubjects(settingRes.data.data.maxSubjects)
      })
      .catch(() => toast.error('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subjectForm.code || !subjectForm.name) {
      toast.error('Vui lòng điền đủ thông tin')
      return
    }

    try {
      setSavingSubject(true)
      if (editingSubject) {
        await subjectApi.update(editingSubject, subjectForm)
        toast.success('Cập nhật thành công')
      } else {
        await subjectApi.create(subjectForm)
        toast.success('Thêm môn học thành công')
      }
      setShowSubjectForm(false)
      setEditingSubject(null)
      setSubjectForm({ code: '', name: '', description: '' })
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi')
    } finally {
      setSavingSubject(false)
    }
  }

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Xóa môn học này?')) return
    try {
      await subjectApi.delete(id)
      toast.success('Đã xóa')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi xóa')
    }
  }

  const handleCompSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showCompForm || !compForm.name || !compForm.weight) {
      toast.error('Vui lòng điền đủ thông tin')
      return
    }
    try {
      setSavingComp(true)
      if (editingComp) {
        await scoreComponentApi.update(editingComp, compForm)
        toast.success('Cập nhật thành công')
      } else {
        await scoreComponentApi.create({ ...compForm, subjectId: showCompForm })
        toast.success('Thêm cột điểm thành công')
      }
      setShowCompForm(null)
      setEditingComp(null)
      setCompForm({ name: '', weight: 0 })
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi')
    } finally {
      setSavingComp(false)
    }
  }

  const handleDeleteComp = async (id: string) => {
    if (!confirm('Xóa cột điểm này?')) return
    try {
      await scoreComponentApi.delete(id)
      toast.success('Đã xóa')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi xóa')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Môn học & Cột điểm</h1>
          <p className="text-gray-600 mt-1">Quản lý môn học và cột điểm</p>
        </div>
        <button
          onClick={() => {
            setEditingSubject(null)
            setSubjectForm({ code: '', name: '', description: '' })
            setShowSubjectForm(true)
          }}
          disabled={subjects.length >= maxSubjects}
          className="btn-primary disabled:opacity-50"
        >
          <Plus className="w-4 h-4 mr-1" /> Môn học
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có môn học nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => {
            const totalWeight = subject.scoreComponents.reduce((sum, component) => sum + component.weight, 0)
            const isExpanded = expanded.has(subject.id)
            return (
              <div key={subject.id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(subject.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <p className="font-medium text-gray-900">{subject.name} <span className="text-xs text-gray-400 font-mono">({subject.code})</span></p>
                      {subject.description && <p className="text-xs text-gray-500">{subject.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${totalWeight === 100 ? 'bg-green-100 text-green-700' : totalWeight > 100 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {totalWeight}% / 100%
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setEditingSubject(subject.id); setSubjectForm({ code: subject.code, name: subject.name, description: subject.description || '' }); setShowSubjectForm(true) }} className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subject.id) }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1"><Layers className="w-4 h-4" /> Cột điểm</h4>
                      <button onClick={() => { setEditingComp(null); setCompForm({ name: '', weight: 0 }); setShowCompForm(subject.id) }} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Thêm
                      </button>
                    </div>
                    {subject.scoreComponents.length === 0 ? (
                      <p className="text-xs text-gray-400">Chưa có cột điểm</p>
                    ) : (
                      <div className="space-y-1">
                        {subject.scoreComponents.map((component) => (
                          <div key={component.id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded border">
                            <span className="text-sm">{component.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-primary">{component.weight}%</span>
                              <button onClick={() => { setEditingComp(component.id); setCompForm({ name: component.name, weight: component.weight }); setShowCompForm(subject.id) }} className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteComp(component.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
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
                  <input className="input" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Tên *</label>
                  <input className="input" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Mô tả</label>
                <input className="input" value={subjectForm.description} onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })} />
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
                <input className="input" value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Trọng số (%) *</label>
                <input type="number" min="1" max="100" className="input" value={compForm.weight} onChange={(e) => setCompForm({ ...compForm, weight: Number(e.target.value) })} />
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
    </div>
  )
}
