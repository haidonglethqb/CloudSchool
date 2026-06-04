'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { academicYearApi, classApi, scoreComponentSetApi, settingsApi, subjectApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { BookOpen, Copy, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'

interface SubjectVersionScope {
  gradeId?: string
  classId?: string
}

interface SubjectVersion {
  id: string
  academicYearId: string
  versionName?: string
  gradeScopes: SubjectVersionScope[]
  classScopes: SubjectVersionScope[]
}

interface Subject {
  id: string
  code: string
  name: string
  description: string | null
  subjectVersions?: SubjectVersion[]
}

interface AcademicYear {
  id: string
  startYear: number
  endYear: number
  isActive: boolean
}

interface Grade {
  id: string
  name: string
  level: number
}

interface ClassItem {
  id: string
  name: string
  grade?: Grade
}

interface Semester {
  id: string
  name: string
  year: string
  semesterNum: number
  isActive: boolean
  displayName?: string
}

interface ComponentRow {
  id?: string
  name: string
  weight: number
  displayOrder: number
  isActive?: boolean
}

const yearLabel = (year?: AcademicYear) => year ? `${year.startYear}-${year.endYear}` : ''
const semesterLabel = (semester?: Semester) => semester?.displayName || (semester ? `${semester.name} (${semester.year})` : '')

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [maxSubjects, setMaxSubjects] = useState(9)
  const [loading, setLoading] = useState(true)

  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', description: '' })

  const [selectedYearId, setSelectedYearId] = useState('')
  const [scopeSubjectId, setScopeSubjectId] = useState('')
  const [scopeGradeIds, setScopeGradeIds] = useState<string[]>([])
  const [scopeClassIds, setScopeClassIds] = useState<string[]>([])
  const [savingScope, setSavingScope] = useState(false)

  const [componentSubjectId, setComponentSubjectId] = useState('')
  const [componentSemesterId, setComponentSemesterId] = useState('')
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [savingComponents, setSavingComponents] = useState(false)
  const [cloneSourceSemesterId, setCloneSourceSemesterId] = useState('')

  const selectedYear = years.find((item) => item.id === selectedYearId)
  const selectedSemester = semesters.find((item) => item.id === componentSemesterId)
  const scopeSubject = subjects.find((item) => item.id === scopeSubjectId)
  const componentSubject = subjects.find((item) => item.id === componentSubjectId)
  const activeWeight = useMemo(
    () => components.filter((item) => item.isActive !== false).reduce((sum, item) => sum + Number(item.weight || 0), 0),
    [components]
  )

  const fetchBaseData = useCallback(async () => {
    setLoading(true)
    try {
      const [subjectRes, yearRes, gradeRes, semesterRes, settingRes] = await Promise.all([
        subjectApi.list({ includeVersions: true }),
        academicYearApi.list(),
        settingsApi.getGrades(),
        subjectApi.getSemesters(),
        settingsApi.get()
      ])
      const nextSubjects = subjectRes.data.data || []
      const nextYears = yearRes.data.data || []
      const nextSemesters = semesterRes.data.data || []
      setSubjects(nextSubjects)
      setYears(nextYears)
      setGrades(gradeRes.data.data || [])
      setSemesters(nextSemesters)
      setMaxSubjects(settingRes.data.data?.maxSubjects || 9)

      const activeYear = nextYears.find((item: AcademicYear) => item.isActive) || nextYears[0]
      const activeSemester = nextSemesters.find((item: Semester) => item.isActive) || nextSemesters[0]
      if (!selectedYearId && activeYear) setSelectedYearId(activeYear.id)
      if (!scopeSubjectId && nextSubjects[0]) setScopeSubjectId(nextSubjects[0].id)
      if (!componentSubjectId && nextSubjects[0]) setComponentSubjectId(nextSubjects[0].id)
      if (!componentSemesterId && activeSemester) setComponentSemesterId(activeSemester.id)
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [componentSemesterId, componentSubjectId, scopeSubjectId, selectedYearId])

  useEffect(() => { fetchBaseData() }, [fetchBaseData])

  useEffect(() => {
    if (!selectedYearId) return
    classApi.list({ academicYearId: selectedYearId })
      .then((res) => setClasses(res.data.data || []))
      .catch(() => toast.error('Lỗi tải danh sách lớp'))
  }, [selectedYearId])

  useEffect(() => {
    const version = scopeSubject?.subjectVersions?.find((item) => item.academicYearId === selectedYearId)
    setScopeGradeIds((version?.gradeScopes || []).map((item) => item.gradeId).filter(Boolean) as string[])
    setScopeClassIds((version?.classScopes || []).map((item) => item.classId).filter(Boolean) as string[])
  }, [scopeSubject, selectedYearId])

  const fetchComponents = useCallback(async () => {
    if (!componentSubjectId || !componentSemesterId) return
    try {
      const res = await scoreComponentSetApi.get({ subjectId: componentSubjectId, semesterId: componentSemesterId })
      const rows = (res.data.data?.components || []).map((item: ComponentRow, index: number) => ({
        id: item.id,
        name: item.name,
        weight: item.weight,
        displayOrder: item.displayOrder || index + 1,
        isActive: item.isActive !== false
      }))
      setComponents(rows)
      if (res.data.warning) toast.error(res.data.warning)
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi tải thành phần điểm')
    }
  }, [componentSemesterId, componentSubjectId])

  useEffect(() => { fetchComponents() }, [fetchComponents])

  const handleSubjectSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!subjectForm.code.trim() || !subjectForm.name.trim()) {
      toast.error('Vui lòng nhập mã và tên môn')
      return
    }
    try {
      if (editingSubject) {
        await subjectApi.update(editingSubject, subjectForm)
        toast.success('Đã cập nhật môn học')
      } else {
        await subjectApi.create(subjectForm)
        toast.success('Đã thêm môn học')
      }
      setShowSubjectForm(false)
      setEditingSubject(null)
      setSubjectForm({ code: '', name: '', description: '' })
      fetchBaseData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi lưu môn học')
    }
  }

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Xóa môn học này?')) return
    try {
      await subjectApi.delete(id)
      toast.success('Đã xóa môn học')
      fetchBaseData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi xóa môn học')
    }
  }

  const toggle = (items: string[], id: string) => (
    items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
  )

  const handleSaveScope = async () => {
    if (!scopeSubjectId || !selectedYearId) return
    if (scopeGradeIds.length === 0 && scopeClassIds.length === 0) {
      toast.error('Chọn ít nhất một khối hoặc lớp')
      return
    }
    setSavingScope(true)
    try {
      const versionRes = await subjectApi.createVersion(scopeSubjectId, {
        academicYearId: selectedYearId,
        versionName: `${scopeSubject?.name || 'Môn học'} ${yearLabel(selectedYear)}`
      })
      await subjectApi.updateVersionScope(versionRes.data.data.id, {
        gradeIds: scopeGradeIds,
        classIds: scopeClassIds
      })
      toast.success('Đã lưu phạm vi áp dụng môn')
      fetchBaseData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi lưu phạm vi')
    } finally {
      setSavingScope(false)
    }
  }

  const addComponent = () => {
    setComponents((prev) => [...prev, { name: '', weight: 0, displayOrder: prev.length + 1, isActive: true }])
  }

  const updateComponent = (index: number, patch: Partial<ComponentRow>) => {
    setComponents((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  const removeComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, displayOrder: itemIndex + 1 })))
  }

  const handleSaveComponents = async () => {
    if (!componentSubjectId || !componentSemesterId) return
    if (components.some((item) => !item.name.trim() || Number(item.weight) <= 0)) {
      toast.error('Tên và trọng số thành phần điểm là bắt buộc')
      return
    }
    setSavingComponents(true)
    try {
      const res = await scoreComponentSetApi.save({
        subjectId: componentSubjectId,
        semesterId: componentSemesterId,
        components: components.map((item, index) => ({ ...item, displayOrder: index + 1 }))
      })
      toast.success(res.data.warning || 'Đã lưu thành phần điểm')
      fetchComponents()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi lưu thành phần điểm')
    } finally {
      setSavingComponents(false)
    }
  }

  const handleClone = async () => {
    if (!componentSubjectId || !componentSemesterId || !cloneSourceSemesterId) {
      toast.error('Chọn học kỳ nguồn')
      return
    }
    try {
      await scoreComponentSetApi.clone({
        subjectId: componentSubjectId,
        sourceSemesterId: cloneSourceSemesterId,
        targetSemesterId: componentSemesterId
      })
      toast.success('Đã sao chép thành phần điểm')
      fetchComponents()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Lỗi sao chép')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Môn học & thành phần điểm</h1>
          <p className="text-gray-600 mt-1">Cấu hình môn theo năm/khối/lớp và đầu điểm theo môn/học kỳ</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1 space-y-3">
          <h2 className="font-semibold text-gray-900">Danh mục môn</h2>
          {subjects.map((subject) => (
            <div key={subject.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{subject.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{subject.code}</p>
                  {subject.description && <p className="text-sm text-gray-500 mt-1">{subject.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingSubject(subject.id); setSubjectForm({ code: subject.code, name: subject.name, description: subject.description || '' }); setShowSubjectForm(true) }} className="p-1.5 text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteSubject(subject.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {subjects.length === 0 && (
            <div className="card p-10 text-center text-gray-500">
              <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              Chưa có môn học
            </div>
          )}
        </section>

        <section className="xl:col-span-2 space-y-6">
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Phạm vi áp dụng môn</h2>
              <p className="text-sm text-gray-500">Môn được áp dụng theo năm học, khối hoặc lớp cụ thể.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Năm học</label>
                <select className="input" value={selectedYearId} onChange={(event) => setSelectedYearId(event.target.value)}>
                  {years.map((year) => <option key={year.id} value={year.id}>{yearLabel(year)}{year.isActive ? ' - Đang active' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Môn học</label>
                <select className="input" value={scopeSubjectId} onChange={(event) => setScopeSubjectId(event.target.value)}>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="label">Áp dụng theo khối</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {grades.map((grade) => (
                  <label key={grade.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                    <input type="checkbox" checked={scopeGradeIds.includes(grade.id)} onChange={() => setScopeGradeIds((prev) => toggle(prev, grade.id))} />
                    {grade.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Áp dụng riêng theo lớp</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-auto">
                {classes.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                    <input type="checkbox" checked={scopeClassIds.includes(item.id)} onChange={() => setScopeClassIds((prev) => toggle(prev, item.id))} />
                    {item.name}
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleSaveScope} disabled={savingScope} className="btn-primary">
              {savingScope ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Lưu phạm vi
            </button>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Thành phần điểm theo học kỳ</h2>
              <p className="text-sm text-gray-500">Cùng một môn trong cùng một học kỳ dùng chung bộ thành phần điểm cho mọi lớp.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Môn học</label>
                <select className="input" value={componentSubjectId} onChange={(event) => setComponentSubjectId(event.target.value)}>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Học kỳ</label>
                <select className="input" value={componentSemesterId} onChange={(event) => setComponentSemesterId(event.target.value)}>
                  {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semesterLabel(semester)}{semester.isActive ? ' - Đang active' : ''}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-primary">
              Đang cấu hình: {componentSubject?.name || 'Môn học'} - {semesterLabel(selectedSemester)}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select className="input sm:max-w-xs" value={cloneSourceSemesterId} onChange={(event) => setCloneSourceSemesterId(event.target.value)}>
                <option value="">Chọn học kỳ nguồn</option>
                {semesters.filter((semester) => semester.id !== componentSemesterId).map((semester) => (
                  <option key={semester.id} value={semester.id}>{semesterLabel(semester)}</option>
                ))}
              </select>
              <button onClick={handleClone} className="px-4 py-2 rounded-lg border text-sm flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" /> Clone
              </button>
            </div>

            <div className="space-y-2">
              {components.map((component, index) => (
                <div key={component.id || index} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-7" placeholder="Tên thành phần" value={component.name} onChange={(event) => updateComponent(index, { name: event.target.value })} />
                  <input className="input col-span-3" type="number" min="1" max="100" value={component.weight} onChange={(event) => updateComponent(index, { weight: Number(event.target.value) })} />
                  <button onClick={() => removeComponent(index)} className="col-span-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 flex justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addComponent} className="px-4 py-2 rounded-lg border text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Thêm thành phần
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm font-medium ${activeWeight > 100 ? 'text-red-600' : activeWeight === 100 ? 'text-green-700' : 'text-yellow-700'}`}>
                Tổng trọng số: {activeWeight}% / 100%
              </span>
              <button onClick={handleSaveComponents} disabled={savingComponents} className="btn-primary">
                {savingComponents ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Lưu thành phần điểm
              </button>
            </div>
          </div>
        </section>
      </div>

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
                  <input className="input" value={subjectForm.code} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Tên *</label>
                  <input className="input" value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Mô tả</label>
                <input className="input" value={subjectForm.description} onChange={(event) => setSubjectForm({ ...subjectForm, description: event.target.value })} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSubjectForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="btn-primary">{editingSubject ? 'Cập nhật' : 'Thêm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
