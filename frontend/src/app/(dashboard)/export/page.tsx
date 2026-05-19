'use client'

import { useEffect, useState } from 'react'
import { academicYearApi, classApi, exportApi, subjectApi, downloadBlob } from '@/lib/api'
import { Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type ExportTarget = 'students' | 'subject-summary' | 'class-promotion-summary' | 'semester-promotion-summary' | 'year-promotion-summary'

export default function ExportPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [target, setTarget] = useState<ExportTarget>('students')
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx')
  const [sections, setSections] = useState<string[]>(['summary'])
  const sectionOptions = target === 'class-promotion-summary'
    ? [
        { value: 'summary', label: 'Tóm tắt' },
        { value: 'students', label: 'Danh sách học sinh' }
      ]
    : [{ value: 'summary', label: 'Tóm tắt' }]

  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])

  const [subjectId, setSubjectId] = useState('')
  const [classId, setClassId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')

  useEffect(() => {
    Promise.all([subjectApi.list(), classApi.list(), academicYearApi.list(), subjectApi.getSemesters()])
      .then(([subjectRes, classRes, yearRes, semesterRes]) => {
        setSubjects(subjectRes.data.data || [])
        setClasses(classRes.data.data || [])
        setYears(yearRes.data.data || [])
        setSemesters(semesterRes.data.data || [])
      })
      .catch(() => toast.error('Không thể tải dữ liệu export'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setSections((prev) => {
      const allowed = new Set(sectionOptions.map((item) => item.value))
      const next = prev.filter((value) => allowed.has(value))
      return next.length > 0 ? next : ['summary']
    })
  }, [target])

  const toggleSection = (value: string) => {
    setSections((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev
        return prev.filter((item) => item !== value)
      }
      return [...prev, value]
    })
  }

  const doExport = async () => {
    try {
      setExporting(true)
      if (target === 'students') {
        const res = await exportApi.students({ format })
        downloadBlob(res.data, `students.${format}`)
      } else if (target === 'subject-summary') {
        if (!subjectId || !semesterId) return toast.error('Cần chọn môn và học kỳ')
        const res = await exportApi.report('subject-summary', { format, subjectId, semesterId, sections: sections.join(',') })
        downloadBlob(res.data, `report_subject_summary.${format}`)
      } else if (target === 'class-promotion-summary') {
        if (!classId || !semesterId) return toast.error('Cần chọn lớp và học kỳ')
        const res = await exportApi.report('class-promotion-summary', { format, classId, semesterId, sections: sections.join(',') })
        downloadBlob(res.data, `report_class_promotion.${format}`)
      } else if (target === 'semester-promotion-summary') {
        if (!semesterId) return toast.error('Cần chọn học kỳ')
        const res = await exportApi.report('semester-promotion-summary', { format, semesterId, sections: sections.join(',') })
        downloadBlob(res.data, `report_semester_promotion.${format}`)
      } else if (target === 'year-promotion-summary') {
        if (!academicYearId) return toast.error('Cần chọn năm học')
        const res = await exportApi.report('year-promotion-summary', { format, academicYearId, sections: sections.join(',') })
        downloadBlob(res.data, `report_year_promotion.${format}`)
      }
      toast.success('Xuất file thành công')
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xuất file thất bại')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xuất dữ liệu</h1>
        <p className="text-sm text-gray-600 mt-1">Chọn động phần báo cáo cần export</p>
      </div>

      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Loại dữ liệu</label>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value as ExportTarget)}>
            <option value="students">Danh sách học sinh</option>
            <option value="subject-summary">BM1 - Tổng kết môn học</option>
            <option value="class-promotion-summary">BM2 - Tỷ lệ lên lớp theo lớp</option>
            <option value="semester-promotion-summary">BM3 - Tỷ lệ lên lớp theo học kỳ</option>
            <option value="year-promotion-summary">BM4 - Tỷ lệ lên lớp theo năm học</option>
          </select>
        </div>

        {(target === 'subject-summary') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Môn học</label>
              <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Chọn môn</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Học kỳ</label>
              <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                <option value="">Chọn học kỳ</option>
                {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {(target === 'class-promotion-summary') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lớp</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Chọn lớp</option>
                {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Học kỳ</label>
              <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                <option value="">Chọn học kỳ</option>
                {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {(target === 'semester-promotion-summary') && (
          <div>
            <label className="label">Học kỳ</label>
            <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">Chọn học kỳ</option>
              {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
            </select>
          </div>
        )}

        {(target === 'year-promotion-summary') && (
          <div>
            <label className="label">Năm học</label>
            <select className="input" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="">Chọn năm học</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>)}
            </select>
          </div>
        )}

        {target !== 'students' && (
          <div>
            <label className="label">Phần export</label>
            <div className="flex gap-3 flex-wrap">
              {sectionOptions.map((section) => (
                <label key={section.value} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sections.includes(section.value)} onChange={() => toggleSection(section.value)} />
                  {section.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Định dạng</label>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'xlsx' | 'pdf')}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={doExport} disabled={exporting} className="btn-primary w-full">
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Xuất file
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
