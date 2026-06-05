'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { academicYearApi, classApi, downloadBlob, settingsApi, studentApi, subjectApi } from '@/lib/api'
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Save, Upload } from 'lucide-react'

const studentSchema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự'),
  gender: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'Vui lòng chọn giới tính' })
  ) as z.ZodType<'MALE' | 'FEMALE' | 'OTHER'>,
  dateOfBirth: z.string().min(1, 'Chọn ngày sinh'),
  address: z.string().min(5, 'Địa chỉ ít nhất 5 ký tự'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  admissionDate: z.string().optional(),
  parentName: z.string().optional().or(z.literal('')),
  parentPhone: z.string().optional().or(z.literal('')),
  classId: z.string().uuid('Chọn lớp'),
})

type StudentFormData = z.infer<typeof studentSchema>

interface ClassOption {
  id: string
  name: string
  capacity: number
  grade: { name: string; level: number }
  _count: { students: number }
}

interface Settings {
  minAge: number
  maxAge: number
  maxClassSize: number
}

interface ImportBatch {
  id: string
  fileName: string
  importedBy: string | null
  totalRows: number
  validRows: number
  invalidRows: number
  createdRows: number
  status: string
  createdAt: string
}

interface ImportRow {
  id: string
  rowNumber: number
  fullName: string | null
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null
  dateOfBirth: string | null
  address: string | null
  classId: string | null
  status: 'VALID' | 'INVALID' | 'IMPORTED'
  errorMessage: string | null
}

const getGenderLabel = (gender?: string | null) => {
  if (gender === 'MALE') return 'Nam'
  if (gender === 'FEMALE') return 'Nữ'
  if (gender === 'OTHER') return 'Khác'
  return '-'
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

const readFileBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    resolve(result.includes(',') ? result.split(',')[1] : result)
  }
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export default function NewStudentPage() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([])

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      gender: undefined,
      email: '',
      admissionDate: new Date().toISOString().split('T')[0],
      parentName: '',
      parentPhone: '',
    },
  })

  const selectedClassId = watch('classId')
  const dateOfBirth = watch('dateOfBirth')
  const selectedClass = classes.find((item) => item.id === selectedClassId)
  const isClassFull = selectedClass ? selectedClass._count.students >= selectedClass.capacity : false

  const fetchImportHistory = async () => {
    const res = await studentApi.listImportBatches()
    setImportHistory(res.data.data || [])
  }

  const fetchData = async () => {
    try {
      const [yearsRes, semestersRes, settingsRes, historyRes] = await Promise.all([
        academicYearApi.list(),
        subjectApi.getSemesters(),
        settingsApi.get(),
        studentApi.listImportBatches(),
      ])
      const years = yearsRes.data.data || []
      const semesters = semestersRes.data.data || []
      const activeSemester = semesters.find((semester: { isActive: boolean; academicYearId?: string }) => semester.isActive)
      const activeYear = years.find((year: { id: string; isActive: boolean }) => year.isActive) || years[0]
      const academicYearId = activeSemester?.academicYearId || activeYear?.id
      const classRes = await classApi.list(academicYearId ? { academicYearId } : undefined)
      setClasses(classRes.data.data || [])
      setSettings(settingsRes.data.data)
      setImportHistory(historyRes.data.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const calculateAge = (dob: string) => {
    if (!dob) return null
    const today = new Date()
    const birth = new Date(dob)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDelta = today.getMonth() - birth.getMonth()
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const age = dateOfBirth ? calculateAge(dateOfBirth) : null
  const ageWarning =
    age !== null && settings && (age < settings.minAge || age > settings.maxAge)
      ? `Tuổi học sinh (${age}) không nằm trong khoảng ${settings.minAge}-${settings.maxAge}`
      : null

  const onSubmit = async (data: StudentFormData) => {
    if (isClassFull) {
      toast.error('Lớp đã đầy, không thể thêm học sinh')
      return
    }

    try {
      setSubmitting(true)
      await studentApi.create({
        ...data,
        email: data.email || undefined,
        admissionDate: data.admissionDate || undefined,
        parentName: data.parentName || undefined,
        parentPhone: data.parentPhone || undefined,
      })
      toast.success('Tiếp nhận học sinh thành công')
      reset()
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Tiếp nhận học sinh thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await studentApi.downloadImportTemplate()
      downloadBlob(res.data, 'student-import-template.csv')
    } catch {
      toast.error('Không thể tải file mẫu')
    }
  }

  const handleImportFile = async (file?: File | null) => {
    if (!file) return
    try {
      setUploading(true)
      const contentBase64 = await readFileBase64(file)
      const res = await studentApi.createImportBatch({
        fileName: file.name,
        fileType: file.type || file.name.split('.').pop() || 'csv',
        contentBase64,
      })
      const batch = res.data.data
      setActiveBatch(batch)
      setImportRows(batch.rows || [])
      await fetchImportHistory()
      toast.success('Đã đọc file import')
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Import thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleAssignImportRow = async (rowId: string, classId: string) => {
    if (!activeBatch || !classId) return
    try {
      const res = await studentApi.updateImportRow(activeBatch.id, rowId, { classId })
      setImportRows((prev) => prev.map((row) => row.id === rowId ? res.data.data : row))
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Không thể cập nhật lớp')
    }
  }

  const handleCommitImport = async () => {
    if (!activeBatch) return
    try {
      setCommitting(true)
      const res = await studentApi.commitImportBatch(activeBatch.id)
      setActiveBatch(res.data.data)
      setImportRows(res.data.data.rows || [])
      await Promise.all([fetchImportHistory(), fetchData()])
      toast.success('Đã tạo học sinh từ danh sách import')
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Không thể tạo học sinh từ import')
    } finally {
      setCommitting(false)
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
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/students" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tiếp nhận học sinh</h1>
          <p className="text-gray-600 text-sm mt-1">Nhập từng học sinh hoặc nhập nhanh bằng CSV/Excel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Nhập một học sinh</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Họ và tên <span className="text-red-500">*</span></label>
              <input type="text" className={`input ${errors.fullName ? 'border-red-500' : ''}`} placeholder="Nguyễn Văn A" {...register('fullName')} />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Giới tính <span className="text-red-500">*</span></label>
                <select className={`input ${errors.gender ? 'border-red-500' : ''}`} {...register('gender')}>
                  <option value="">Chọn giới tính</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
              </div>
              <div>
                <label className="label">Ngày sinh <span className="text-red-500">*</span></label>
                <input type="date" className={`input ${errors.dateOfBirth ? 'border-red-500' : ''}`} {...register('dateOfBirth')} />
                {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>}
                {ageWarning && <p className="text-amber-600 text-xs mt-1">{ageWarning}</p>}
              </div>
            </div>

            <div>
              <label className="label">Địa chỉ <span className="text-red-500">*</span></label>
              <input type="text" className={`input ${errors.address ? 'border-red-500' : ''}`} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" {...register('address')} />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input type="email" className={`input ${errors.email ? 'border-red-500' : ''}`} placeholder="email@example.com" {...register('email')} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label">Ngày tiếp nhận</label>
                <input type="date" className="input" {...register('admissionDate')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tên phụ huynh</label>
                <input type="text" className="input" placeholder="Nguyễn Văn B" {...register('parentName')} />
              </div>
              <div>
                <label className="label">SĐT phụ huynh</label>
                <input type="text" className="input" placeholder="0901234567" {...register('parentPhone')} />
              </div>
            </div>

            <div>
              <label className="label">Lớp <span className="text-red-500">*</span></label>
              <select className={`input ${errors.classId ? 'border-red-500' : ''}`} {...register('classId')}>
                <option value="">Chọn lớp</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id} disabled={cls._count.students >= cls.capacity}>
                    {cls.name} ({cls.grade.name}) - {cls._count.students}/{cls.capacity} học sinh{cls._count.students >= cls.capacity ? ' (Đầy)' : ''}
                  </option>
                ))}
              </select>
              {errors.classId && <p className="text-red-500 text-xs mt-1">{errors.classId.message}</p>}
              {isClassFull && <p className="text-red-500 text-xs mt-1">Lớp đã đầy, sĩ số tối đa: {selectedClass?.capacity}</p>}
            </div>

            {settings && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Tuổi hợp lệ: {settings.minAge}-{settings.maxAge}. Sĩ số tối đa: {settings.maxClassSize} học sinh/lớp.
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t">
              <Link href="/students" className="btn-outline flex-1 justify-center">Hủy</Link>
              <button type="submit" disabled={submitting || isClassFull} className="btn-primary flex-1">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Lưu học sinh
              </button>
            </div>
          </form>
        </section>

        <section className="card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nhập nhanh CSV/Excel</h2>
              <p className="text-sm text-gray-500 mt-1">Cột bắt buộc: fullName, gender, dateOfBirth, address.</p>
            </div>
            <button type="button" onClick={handleDownloadTemplate} className="btn-outline">
              <Download className="w-4 h-4 mr-2" />
              Tải CSV mẫu
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:bg-gray-100">
            {uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <FileSpreadsheet className="w-8 h-8 text-primary" />}
            <span className="mt-3 text-sm font-medium text-gray-900">Chọn file CSV hoặc Excel</span>
            <span className="mt-1 text-xs text-gray-500">Hỗ trợ .csv và .xlsx</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              disabled={uploading}
              onChange={(event) => handleImportFile(event.target.files?.[0])}
            />
          </label>

          {activeBatch && (
            <div className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
              File đang xử lý: <span className="font-medium">{activeBatch.fileName}</span> - {activeBatch.validRows} hợp lệ, {activeBatch.invalidRows} lỗi, {activeBatch.createdRows} đã tạo.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-header">Dòng</th>
                  <th className="table-header">Họ tên</th>
                  <th className="table-header">Giới tính</th>
                  <th className="table-header">Ngày sinh</th>
                  <th className="table-header">Địa chỉ</th>
                  <th className="table-header">Lớp</th>
                  <th className="table-header">Trạng thái</th>
                  <th className="table-header">Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importRows.length === 0 ? (
                  <tr>
                    <td className="table-cell text-center text-gray-500" colSpan={8}>Chưa có dữ liệu import</td>
                  </tr>
                ) : importRows.map((row) => (
                  <tr key={row.id} className={row.status === 'INVALID' ? 'bg-red-50/50' : row.status === 'IMPORTED' ? 'bg-green-50/50' : ''}>
                    <td className="table-cell">{row.rowNumber}</td>
                    <td className="table-cell font-medium">{row.fullName || '-'}</td>
                    <td className="table-cell">{getGenderLabel(row.gender)}</td>
                    <td className="table-cell">{formatDate(row.dateOfBirth)}</td>
                    <td className="table-cell">{row.address || '-'}</td>
                    <td className="table-cell">
                      <select
                        className="input min-w-[180px] py-1.5 text-sm"
                        value={row.classId || ''}
                        disabled={row.status === 'INVALID' || row.status === 'IMPORTED'}
                        onChange={(event) => handleAssignImportRow(row.id, event.target.value)}
                      >
                        <option value="">Chọn lớp</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id} disabled={cls._count.students >= cls.capacity}>
                            {cls.name} ({cls.grade.name})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        row.status === 'IMPORTED' ? 'bg-green-100 text-green-700' : row.status === 'VALID' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.status === 'IMPORTED' ? 'Đã tạo' : row.status === 'VALID' ? 'Hợp lệ' : 'Lỗi'}
                      </span>
                    </td>
                    <td className="table-cell text-red-600">{row.errorMessage || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={handleCommitImport} disabled={!activeBatch || committing} className="btn-primary">
            {committing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Tạo học sinh từ danh sách
          </button>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Lịch sử import</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">File</th>
                <th className="table-header">Người import</th>
                <th className="table-header">Thời gian</th>
                <th className="table-header">Tổng dòng</th>
                <th className="table-header">Hợp lệ</th>
                <th className="table-header">Lỗi</th>
                <th className="table-header">Đã tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {importHistory.length === 0 ? (
                <tr>
                  <td className="table-cell text-center text-gray-500" colSpan={7}>Chưa có lịch sử import</td>
                </tr>
              ) : importHistory.map((batch) => (
                <tr key={batch.id}>
                  <td className="table-cell font-medium">{batch.fileName}</td>
                  <td className="table-cell">{batch.importedBy || '-'}</td>
                  <td className="table-cell">{new Date(batch.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="table-cell">{batch.totalRows}</td>
                  <td className="table-cell">{batch.validRows}</td>
                  <td className="table-cell">{batch.invalidRows}</td>
                  <td className="table-cell">{batch.createdRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
