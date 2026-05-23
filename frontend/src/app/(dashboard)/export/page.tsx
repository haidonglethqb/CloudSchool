'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { academicYearApi, classApi, downloadBlob, exportApi, subjectApi } from '@/lib/api'
import { Download, Loader2, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

type ExportTarget =
  | 'students'
  | 'subject-summary'
  | 'class-promotion-summary'
  | 'semester-promotion-summary'
  | 'year-promotion-summary'

type ToggleOption = {
  value: string
  label: string
}

const targetMetadata: Record<ExportTarget, { label: string; description: string }> = {
  students: {
    label: 'Danh sách học sinh',
    description: 'Xuất dữ liệu học sinh theo các cột và hạng mục bạn cần dùng.',
  },
  'subject-summary': {
    label: 'Tỷ lệ học sinh đạt theo môn học',
    description: 'Xuất báo cáo thống kê tỉ lệ học sinh đạt của một môn học trong một học kỳ.',
  },
  'class-promotion-summary': {
    label: 'Tỷ lệ học sinh lên lớp theo lớp',
    description: 'Xuất báo cáo thống kê tỉ lệ học sinh lên lớp của một lớp trong một học kỳ.',
  },
  'semester-promotion-summary': {
    label: 'Tỷ lệ học sinh lên lớp theo học kỳ',
    description: 'Xuất báo cáo tổng hợp tỉ lệ học sinh lên lớp của toàn trường trong một học kỳ.',
  },
  'year-promotion-summary': {
    label: 'Tỷ lệ học sinh lên lớp theo năm học',
    description: 'Xuất báo cáo tổng hợp tỉ lệ học sinh lên lớp của toàn trường trong cả năm học.',
  },
}

const sectionConfig: Record<ExportTarget, ToggleOption[]> = {
  students: [
    { value: 'cover', label: 'Trang bìa' },
    { value: 'filters', label: 'Bộ lọc áp dụng' },
    { value: 'summary', label: 'Thông tin tổng hợp' },
    { value: 'table', label: 'Bảng dữ liệu' },
    { value: 'signature', label: 'Chữ ký người lập' }
  ],
  'subject-summary': [
    { value: 'cover', label: 'Trang bìa' },
    { value: 'filters', label: 'Bộ lọc áp dụng' },
    { value: 'summary', label: 'Thông tin tổng hợp' },
    { value: 'table', label: 'Bảng dữ liệu' },
    { value: 'signature', label: 'Chữ ký người lập' }
  ],
  'class-promotion-summary': [
    { value: 'cover', label: 'Trang bìa' },
    { value: 'filters', label: 'Bộ lọc áp dụng' },
    { value: 'summary', label: 'Thông tin tổng hợp' },
    { value: 'table', label: 'Bảng tổng hợp' },
    { value: 'students', label: 'Danh sách học sinh' },
    { value: 'signature', label: 'Chữ ký người lập' }
  ],
  'semester-promotion-summary': [
    { value: 'cover', label: 'Trang bìa' },
    { value: 'filters', label: 'Bộ lọc áp dụng' },
    { value: 'summary', label: 'Thông tin tổng hợp' },
    { value: 'table', label: 'Bảng dữ liệu' },
    { value: 'signature', label: 'Chữ ký người lập' }
  ],
  'year-promotion-summary': [
    { value: 'cover', label: 'Trang bìa' },
    { value: 'filters', label: 'Bộ lọc áp dụng' },
    { value: 'summary', label: 'Thông tin tổng hợp' },
    { value: 'table', label: 'Bảng dữ liệu' },
    { value: 'signature', label: 'Chữ ký người lập' }
  ]
}

const columnConfig: Record<ExportTarget, ToggleOption[]> = {
  students: [
    { value: 'studentCode', label: 'Mã học sinh' },
    { value: 'fullName', label: 'Họ tên' },
    { value: 'gender', label: 'Giới tính' },
    { value: 'dateOfBirth', label: 'Ngày sinh' },
    { value: 'className', label: 'Lớp' },
    { value: 'gradeName', label: 'Khối' },
    { value: 'address', label: 'Địa chỉ' },
    { value: 'phone', label: 'Số điện thoại' },
    { value: 'parentName', label: 'Tên phụ huynh' },
    { value: 'parentPhone', label: 'SĐT phụ huynh' },
    { value: 'status', label: 'Trạng thái' }
  ],
  'subject-summary': [
    { value: 'className', label: 'Lớp' },
    { value: 'gradeName', label: 'Khối' },
    { value: 'total', label: 'Sĩ số' },
    { value: 'pass', label: 'Số đạt' },
    { value: 'rate', label: 'Tỷ lệ đạt' }
  ],
  'class-promotion-summary': [
    { value: 'className', label: 'Lớp' },
    { value: 'gradeName', label: 'Khối' },
    { value: 'total', label: 'Sĩ số xét' },
    { value: 'pass', label: 'Số lên lớp' },
    { value: 'rate', label: 'Tỷ lệ lên lớp' }
  ],
  'semester-promotion-summary': [
    { value: 'className', label: 'Lớp' },
    { value: 'gradeName', label: 'Khối' },
    { value: 'total', label: 'Sĩ số xét' },
    { value: 'pass', label: 'Số lên lớp' },
    { value: 'rate', label: 'Tỷ lệ lên lớp' }
  ],
  'year-promotion-summary': [
    { value: 'gradeName', label: 'Khối' },
    { value: 'total', label: 'Sĩ số xét' },
    { value: 'pass', label: 'Số lên lớp' },
    { value: 'rate', label: 'Tỷ lệ lên lớp' }
  ]
}

const toDefaultValues = (items: ToggleOption[]) => items.map((item) => item.value)

export default function ExportPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [target, setTarget] = useState<ExportTarget>('students')
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx')
  const [sections, setSections] = useState<string[]>(toDefaultValues(sectionConfig.students))
  const [columns, setColumns] = useState<string[]>(toDefaultValues(columnConfig.students))

  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])

  const [subjectId, setSubjectId] = useState('')
  const [classId, setClassId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const semesterIdRef = useRef('')

  const sectionOptions = useMemo(() => sectionConfig[target], [target])
  const columnOptions = useMemo(() => columnConfig[target], [target])
  const currentTargetMeta = useMemo(() => targetMetadata[target], [target])

  useEffect(() => {
    semesterIdRef.current = semesterId
  }, [semesterId])

  const refreshSemesters = useCallback(async (options?: { notifyIfSelectionMissing?: boolean }) => {
    const semesterRes = await subjectApi.getSemesters()
    const nextSemesters = semesterRes.data.data || []
    const currentSemesterId = semesterIdRef.current

    setSemesters(nextSemesters)

    if (currentSemesterId && !nextSemesters.some((semester: any) => semester.id === currentSemesterId)) {
      setSemesterId('')
      if (options?.notifyIfSelectionMissing) {
        toast.error('Học kỳ đang chọn đã bị xóa hoặc không còn khả dụng. Vui lòng chọn lại học kỳ.')
      }
      return nextSemesters
    }

    return nextSemesters
  }, [])

  useEffect(() => {
    Promise.all([subjectApi.list(), classApi.list(), academicYearApi.list(), refreshSemesters()])
      .then(([subjectRes, classRes, yearRes]) => {
        setSubjects(subjectRes.data.data || [])
        setClasses(classRes.data.data || [])
        setYears(yearRes.data.data || [])
      })
      .catch(() => toast.error('Không thể tải dữ liệu export'))
      .finally(() => setLoading(false))
  }, [refreshSemesters])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSemesters({ notifyIfSelectionMissing: true }).catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshSemesters])

  useEffect(() => {
    setSections(toDefaultValues(sectionConfig[target]))
    setColumns(toDefaultValues(columnConfig[target]))
  }, [target])

  const toggleValue = (
    value: string,
    setSelected: (updater: (prev: string[]) => string[]) => void
  ) => {
    setSelected((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev
        return prev.filter((item) => item !== value)
      }
      return [...prev, value]
    })
  }

  const serialize = (items: string[]) => items.join(',')

  const doExport = async () => {
    if (sections.length === 0) return toast.error('Cần chọn ít nhất một hạng mục export')
    if (columns.length === 0) return toast.error('Cần chọn ít nhất một cột dữ liệu')

    try {
      setExporting(true)
      if (target === 'students') {
        const res = await exportApi.students({ format, sections: serialize(sections), columns: serialize(columns) })
        downloadBlob(res.data, `students.${format}`)
      } else if (target === 'subject-summary') {
        if (!subjectId || !semesterId) return toast.error('Cần chọn môn và học kỳ')
        const res = await exportApi.report('subject-summary', {
          format,
          subjectId,
          semesterId,
          sections: serialize(sections),
          columns: serialize(columns)
        })
        downloadBlob(res.data, `report_subject_summary.${format}`)
      } else if (target === 'class-promotion-summary') {
        if (!classId || !semesterId) return toast.error('Cần chọn lớp và học kỳ')
        const res = await exportApi.report('class-promotion-summary', {
          format,
          classId,
          semesterId,
          sections: serialize(sections),
          columns: serialize(columns)
        })
        downloadBlob(res.data, `report_class_promotion.${format}`)
      } else if (target === 'semester-promotion-summary') {
        if (!semesterId) return toast.error('Cần chọn học kỳ')
        const res = await exportApi.report('semester-promotion-summary', {
          format,
          semesterId,
          sections: serialize(sections),
          columns: serialize(columns)
        })
        downloadBlob(res.data, `report_semester_promotion.${format}`)
      } else if (target === 'year-promotion-summary') {
        if (!academicYearId) return toast.error('Cần chọn năm học')
        const res = await exportApi.report('year-promotion-summary', {
          format,
          academicYearId,
          sections: serialize(sections),
          columns: serialize(columns)
        })
        downloadBlob(res.data, `report_year_promotion.${format}`)
      }
      toast.success('Xuất file thành công')
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'NOT_FOUND') {
        await refreshSemesters({ notifyIfSelectionMissing: true })
        return
      }
      toast.error(error.response?.data?.error?.message || 'Xuất file thất bại')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xuất dữ liệu</h1>
        <p className="text-sm text-gray-600 mt-1">Chọn đúng loại báo cáo và cấu hình nội dung file trước khi xuất</p>
      </div>

      <div className="card p-4 space-y-5">
        <div>
          <label className="label">Loại dữ liệu</label>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value as ExportTarget)}>
            <option value="students">Danh sách học sinh</option>
            <option value="subject-summary">Tỷ lệ học sinh đạt theo môn học</option>
            <option value="class-promotion-summary">Tỷ lệ học sinh lên lớp theo lớp</option>
            <option value="semester-promotion-summary">Tỷ lệ học sinh lên lớp theo học kỳ</option>
            <option value="year-promotion-summary">Tỷ lệ học sinh lên lớp theo năm học</option>
          </select>
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-sm font-semibold text-blue-900">{currentTargetMeta.label}</p>
            <p className="mt-1 text-sm text-blue-700">{currentTargetMeta.description}</p>
          </div>
        </div>

        {target === 'subject-summary' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Môn học</label>
              <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Chọn môn</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Học kỳ</label>
              <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                <option value="">Chọn học kỳ</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>{semester.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {target === 'class-promotion-summary' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lớp</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Chọn lớp</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Học kỳ</label>
              <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                <option value="">Chọn học kỳ</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>{semester.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {target === 'semester-promotion-summary' && (
          <div>
            <label className="label">Học kỳ</label>
            <select className="input" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">Chọn học kỳ</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>{semester.name}</option>
              ))}
            </select>
          </div>
        )}

        {target === 'year-promotion-summary' && (
          <div>
            <label className="label">Năm học</label>
            <select className="input" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="">Chọn năm học</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>{year.startYear}-{year.endYear}</option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-800">Hạng mục trong file</p>
          </div>
          <div className="divide-y divide-gray-100">
            {sectionOptions.map((section) => (
              <label key={section.value} className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-gray-700">{section.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary border-gray-300 rounded"
                  checked={sections.includes(section.value)}
                  onChange={() => toggleValue(section.value, setSections)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-800">Cột dữ liệu</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-auto">
            {columnOptions.map((column) => (
              <label key={column.value} className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-gray-700">{column.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary border-gray-300 rounded"
                  checked={columns.includes(column.value)}
                  onChange={() => toggleValue(column.value, setColumns)}
                />
              </label>
            ))}
          </div>
        </div>

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
