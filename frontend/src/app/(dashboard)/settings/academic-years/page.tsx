'use client'

import { useEffect, useState } from 'react'
import { academicYearApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { CalendarRange, Plus, Loader2, Trash2, Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface AcademicYear {
  id: string
  startYear: number
  endYear: number
  createdAt: string
}

export default function AcademicYearsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [form, setForm] = useState({ startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 })
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      const res = await academicYearApi.list()
      setYears(res.data.data)
    } catch {
      toast.error('Không thể tải danh sách năm học')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.startYear >= form.endYear) {
      toast.error('Năm bắt đầu phải nhỏ hơn năm kết thúc')
      return
    }
    try {
      setSaving(true)
      if (editing) {
        await academicYearApi.update(editing.id, form)
        toast.success('Cập nhật năm học thành công')
      } else {
        await academicYearApi.create(form)
        toast.success('Thêm năm học thành công')
      }
      setShowModal(false)
      setEditing(null)
      setForm({ startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 })
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Thao tác thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (year: AcademicYear) => {
    setEditing(year)
    setForm({ startYear: year.startYear, endYear: year.endYear })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa năm học này?')) return
    try {
      await academicYearApi.delete(id)
      toast.success('Xóa năm học thành công')
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Xóa năm học thất bại')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Năm học</h1>
          <p className="text-gray-600 text-sm mt-1">QĐ1 - Quản lý năm học và học kỳ</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setForm({ startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 }); setShowModal(true) }} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> Thêm năm học
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">STT</th>
                <th className="table-header">Năm học</th>
                <th className="table-header text-center">Năm bắt đầu</th>
                <th className="table-header text-center">Năm kết thúc</th>
                {isAdmin && <th className="table-header text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {years.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">Chưa có năm học nào</td></tr>
              ) : (
                years.map((year, idx) => (
                  <tr key={year.id} className="hover:bg-gray-50">
                    <td className="table-cell text-center">{idx + 1}</td>
                    <td className="table-cell font-medium">{year.startYear}-{year.endYear}</td>
                    <td className="table-cell text-center">{year.startYear}</td>
                    <td className="table-cell text-center">{year.endYear}</td>
                    {isAdmin && (
                      <td className="table-cell text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(year)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(year.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Sửa năm học' : 'Thêm năm học'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Năm bắt đầu</label>
                <input type="number" className="input" value={form.startYear} onChange={e => setForm({ ...form, startYear: parseInt(e.target.value) })} required />
              </div>
              <div>
                <label className="label">Năm kết thúc</label>
                <input type="number" className="input" value={form.endYear} onChange={e => setForm({ ...form, endYear: parseInt(e.target.value) })} required />
              </div>
              {form.startYear >= form.endYear && (
                <p className="text-red-500 text-sm">Năm bắt đầu phải nhỏ hơn năm kết thúc (QĐ1)</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Hủy</button>
                <button type="submit" disabled={saving || form.startYear >= form.endYear} className="btn-primary flex-1">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
