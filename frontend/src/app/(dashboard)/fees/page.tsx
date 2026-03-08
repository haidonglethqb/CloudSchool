'use client'

import { useEffect, useState, useCallback } from 'react'
import { feeApi, settingsApi, classApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  DollarSign, Plus, Edit2, Trash2, Eye, Loader2,
  Users, CheckCircle, AlertCircle, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Grade { id: string; name: string; level: number }
interface ClassItem { id: string; name: string; gradeId: string }
interface Semester { id: string; name: string; year: string }

interface Fee {
  id: string
  name: string
  description: string | null
  amount: number
  category: 'TUITION' | 'ACTIVITY' | 'FACILITY' | 'OTHER'
  isRequired: boolean
  dueDate: string | null
  isActive: boolean
  grade: { id: string; name: string } | null
  class: { id: string; name: string } | null
  semester: { id: string; name: string } | null
  _count: { studentFees: number }
  stats: { totalStudents: number; totalAmount: number; totalPaid: number; paidCount: number }
}

const CATEGORY_LABELS: Record<string, string> = {
  TUITION: 'Học phí',
  ACTIVITY: 'Hoạt động',
  FACILITY: 'Cơ sở vật chất',
  OTHER: 'Khác',
}

const CATEGORY_COLORS: Record<string, string> = {
  TUITION: 'bg-blue-100 text-blue-700',
  ACTIVITY: 'bg-green-100 text-green-700',
  FACILITY: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

export default function FeesPage() {
  const { user } = useAuthStore()
  const [fees, setFees] = useState<Fee[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    amount: 0,
    category: 'TUITION' as string,
    isRequired: true,
    dueDate: '',
    gradeId: '',
    classId: '',
  })

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF'

  const fetchFees = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (filterCategory) params.category = filterCategory

      const [feesRes, gradesRes, classesRes] = await Promise.all([
        feeApi.list(params),
        settingsApi.getGrades(),
        classApi.list(),
      ])

      setFees(feesRes.data.data)
      setGrades(gradesRes.data.data)
      setClasses(classesRes.data.data)
    } catch {
      toast.error('Lỗi khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [filterCategory])

  useEffect(() => {
    fetchFees()
  }, [fetchFees])

  const resetForm = () => {
    setForm({ name: '', description: '', amount: 0, category: 'TUITION', isRequired: true, dueDate: '', gradeId: '', classId: '' })
    setEditingFee(null)
    setShowForm(false)
  }

  const openEdit = (fee: Fee) => {
    setEditingFee(fee)
    setForm({
      name: fee.name,
      description: fee.description || '',
      amount: fee.amount,
      category: fee.category,
      isRequired: fee.isRequired,
      dueDate: fee.dueDate ? fee.dueDate.split('T')[0] : '',
      gradeId: fee.grade?.id || '',
      classId: fee.class?.id || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên khoản phí')
    if (form.amount <= 0) return toast.error('Số tiền phải lớn hơn 0')

    setSaving(true)
    try {
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount),
        category: form.category,
        isRequired: form.isRequired,
        dueDate: form.dueDate || null,
        gradeId: form.gradeId || null,
        classId: form.classId || null,
      }

      if (editingFee) {
        await feeApi.update(editingFee.id, data)
        toast.success('Cập nhật khoản phí thành công')
      } else {
        const res = await feeApi.create(data)
        toast.success(`Tạo khoản phí thành công - Đã gán cho ${res.data.assignedCount} học sinh`)
      }

      resetForm()
      fetchFees()
    } catch {
      toast.error('Lỗi khi lưu khoản phí')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (fee: Fee) => {
    if (!confirm(`Xoá khoản phí "${fee.name}"? Điều này sẽ xoá tất cả dữ liệu thanh toán liên quan.`)) return
    try {
      await feeApi.delete(fee.id)
      toast.success('Đã xoá khoản phí')
      fetchFees()
    } catch {
      toast.error('Lỗi khi xoá')
    }
  }

  const handleToggleActive = async (fee: Fee) => {
    try {
      await feeApi.update(fee.id, { isActive: !fee.isActive })
      toast.success(fee.isActive ? 'Đã tạm dừng khoản phí' : 'Đã kích hoạt khoản phí')
      fetchFees()
    } catch {
      toast.error('Lỗi khi cập nhật')
    }
  }

  const filteredClasses = form.gradeId
    ? classes.filter(c => c.gradeId === form.gradeId)
    : classes

  const totalAmount = fees.reduce((sum, f) => sum + f.stats.totalAmount, 0)
  const totalPaid = fees.reduce((sum, f) => sum + f.stats.totalPaid, 0)
  const totalStudentFees = fees.reduce((sum, f) => sum + f.stats.totalStudents, 0)
  const totalPaidCount = fees.reduce((sum, f) => sum + f.stats.paidCount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý học phí</h1>
          <p className="text-sm text-gray-500 mt-1">Tạo và quản lý các khoản thu phí của trường</p>
        </div>
        {canManage && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus className="w-4 h-4" />
            Tạo khoản phí
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tổng cần thu</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Đã thu</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Còn thiếu</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalAmount - totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Đã hoàn thành</p>
              <p className="text-lg font-bold text-gray-900">
                {totalPaidCount}/{totalStudentFees}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">Tất cả loại</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Fee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{editingFee ? 'Chỉnh sửa khoản phí' : 'Tạo khoản phí mới'}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khoản phí *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Học phí Học kỳ 1"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Mô tả chi tiết về khoản phí..."
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ) *</label>
                  <input
                    type="number"
                    value={form.amount || ''}
                    onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    min={0}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại phí</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hạn nộp</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isRequired}
                      onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Bắt buộc</span>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Áp dụng cho</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Khối</label>
                    <select
                      value={form.gradeId}
                      onChange={e => setForm(f => ({ ...f, gradeId: e.target.value, classId: '' }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Tất cả khối</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Lớp</label>
                    <select
                      value={form.classId}
                      onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Tất cả lớp</option>
                      {filteredClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Để trống = áp dụng cho toàn trường</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t">
              <button onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingFee ? 'Cập nhật' : 'Tạo khoản phí'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fees Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {fees.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Chưa có khoản phí nào</p>
            <p className="text-sm text-gray-400 mt-1">Nhấn &quot;Tạo khoản phí&quot; để bắt đầu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Khoản phí</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Loại</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Số tiền</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Hạn nộp</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Áp dụng</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Tiến độ</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Trạng thái</th>
                  {canManage && <th className="text-center px-4 py-3 font-semibold text-gray-600">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {fees.map(fee => {
                  const progressPct = fee.stats.totalAmount > 0
                    ? Math.round((fee.stats.totalPaid / fee.stats.totalAmount) * 100)
                    : 0
                  const isOverdue = fee.dueDate && new Date(fee.dueDate) < new Date() && progressPct < 100
                  return (
                    <tr key={fee.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div>
                          <Link href={`/fees/${fee.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                            {fee.name}
                          </Link>
                          {fee.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{fee.description}</p>}
                          {!fee.isRequired && (
                            <span className="inline-block text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded mt-1">
                              Không bắt buộc
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${CATEGORY_COLORS[fee.category]}`}>
                          {CATEGORY_LABELS[fee.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(fee.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {formatDate(fee.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {fee.class ? fee.class.name : fee.grade ? fee.grade.name : 'Toàn trường'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {fee.stats.paidCount}/{fee.stats.totalStudents}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fee.isActive ? (
                          <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            Đang thu
                          </span>
                        ) : (
                          <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">
                            Tạm dừng
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/fees/${fee.id}`}
                              className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => openEdit(fee)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(fee)}
                              className={`p-1.5 rounded-lg transition ${fee.isActive ? 'hover:bg-orange-50 text-orange-500' : 'hover:bg-green-50 text-green-500'}`}
                              title={fee.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                            >
                              {fee.isActive ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            {user?.role === 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handleDelete(fee)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition"
                                title="Xoá"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
