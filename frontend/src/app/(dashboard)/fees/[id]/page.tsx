'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { feeApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft, DollarSign, Loader2, CheckCircle, Clock,
  AlertCircle, Ban, Search, Save, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface StudentFee {
  id: string
  feeId: string
  studentId: string
  amount: number
  paidAmount: number
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'EXEMPT'
  paidAt: string | null
  note: string | null
  student: {
    id: string
    fullName: string
    studentCode: string
    class: { name: string } | null
  }
}

interface FeeDetail {
  id: string
  name: string
  description: string | null
  amount: number
  category: string
  isRequired: boolean
  dueDate: string | null
  isActive: boolean
  grade: { id: string; name: string } | null
  class: { id: string; name: string } | null
  semester: { id: string; name: string } | null
  studentFees: StudentFee[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING: { label: 'Chưa nộp', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  PAID: { label: 'Đã nộp', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  PARTIAL: { label: 'Nộp 1 phần', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
  OVERDUE: { label: 'Quá hạn', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  EXEMPT: { label: 'Miễn', color: 'bg-gray-100 text-gray-500', icon: Ban },
}

const CATEGORY_LABELS: Record<string, string> = {
  TUITION: 'Học phí',
  ACTIVITY: 'Hoạt động',
  FACILITY: 'Cơ sở vật chất',
  OTHER: 'Khác',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export default function FeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [fee, setFee] = useState<FeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ status: '', paidAmount: 0, note: '' })
  const [saving, setSaving] = useState(false)

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF'

  const fetchFee = useCallback(async () => {
    try {
      setLoading(true)
      const res = await feeApi.get(id)
      setFee(res.data.data)
    } catch {
      toast.error('Không tìm thấy khoản phí')
      router.push('/fees')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchFee()
  }, [fetchFee])

  const startEdit = (sf: StudentFee) => {
    setEditingId(sf.id)
    setEditForm({
      status: sf.status,
      paidAmount: sf.paidAmount,
      note: sf.note || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const savePayment = async (sf: StudentFee) => {
    setSaving(true)
    try {
      await feeApi.updateStudentPayment(sf.feeId, sf.studentId, {
        status: editForm.status,
        paidAmount: Number(editForm.paidAmount),
        note: editForm.note || undefined,
      })
      toast.success(`Cập nhật thanh toán cho ${sf.student.fullName}`)
      setEditingId(null)
      fetchFee()
    } catch {
      toast.error('Lỗi khi cập nhật thanh toán')
    } finally {
      setSaving(false)
    }
  }

  const markAllPaid = async (studentFees: StudentFee[]) => {
    const unpaid = studentFees.filter(sf => sf.status !== 'PAID' && sf.status !== 'EXEMPT')
    if (unpaid.length === 0) return toast('Tất cả đã thanh toán')
    if (!confirm(`Đánh dấu ${unpaid.length} học sinh đã nộp đầy đủ?`)) return

    try {
      await Promise.all(
        unpaid.map(sf =>
          feeApi.updateStudentPayment(sf.feeId, sf.studentId, {
            status: 'PAID',
            paidAmount: sf.amount,
          })
        )
      )
      toast.success(`Đã cập nhật ${unpaid.length} học sinh`)
      fetchFee()
    } catch {
      toast.error('Lỗi khi cập nhật hàng loạt')
    }
  }

  if (loading || !fee) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const filteredStudentFees = fee.studentFees.filter(sf => {
    const matchSearch = !searchQuery ||
      sf.student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sf.student.studentCode.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = !filterStatus || sf.status === filterStatus
    return matchSearch && matchStatus
  })

  const paidCount = fee.studentFees.filter(sf => sf.status === 'PAID').length
  const totalStudents = fee.studentFees.length
  const totalCollected = fee.studentFees.reduce((s, sf) => s + sf.paidAmount, 0)
  const totalExpected = fee.studentFees.reduce((s, sf) => s + sf.amount, 0)

  return (
    <div className="space-y-6">
      {/* Back & Header */}
      <div className="flex items-center gap-4">
        <Link href="/fees" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{fee.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {CATEGORY_LABELS[fee.category] || fee.category}
            {fee.description && ` — ${fee.description}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Số tiền / học sinh</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(fee.amount)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Đã thu</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Cần thu thêm</p>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(totalExpected - totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Hoàn thành</p>
          <p className="text-lg font-bold text-blue-600">
            {paidCount}/{totalStudents} ({totalStudents > 0 ? Math.round((paidCount / totalStudents) * 100) : 0}%)
          </p>
        </div>
      </div>

      {/* Info pills */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {fee.isRequired ? (
          <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">Bắt buộc</span>
        ) : (
          <span className="bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full font-medium">Không bắt buộc</span>
        )}
        {fee.dueDate && (
          <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
            Hạn nộp: {new Date(fee.dueDate).toLocaleDateString('vi-VN')}
          </span>
        )}
        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          Áp dụng: {fee.class ? fee.class.name : fee.grade ? fee.grade.name : 'Toàn trường'}
        </span>
      </div>

      {/* Student Fees Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm học sinh..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {canManage && (
            <button
              onClick={() => markAllPaid(filteredStudentFees)}
              className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <CheckCircle className="w-4 h-4" />
              Đánh dấu tất cả đã nộp
            </button>
          )}
        </div>

        {filteredStudentFees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Không có dữ liệu</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Mã HS</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Họ tên</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Lớp</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Cần nộp</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Đã nộp</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Ghi chú</th>
                  {canManage && <th className="text-center px-4 py-3 font-semibold text-gray-600">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudentFees.map(sf => {
                  const isEditing = editingId === sf.id
                  const statusCfg = STATUS_CONFIG[sf.status]
                  const StatusIcon = statusCfg.icon

                  return (
                    <tr key={sf.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{sf.student.studentCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{sf.student.fullName}</td>
                      <td className="px-4 py-3 text-gray-600">{sf.student.class?.name || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(sf.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.paidAmount}
                            onChange={e => setEditForm(f => ({ ...f, paidAmount: Number(e.target.value) }))}
                            min={0}
                            max={sf.amount}
                            className="w-28 border rounded px-2 py-1 text-right text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <span className={sf.paidAmount >= sf.amount ? 'text-green-600 font-medium' : 'text-gray-900'}>
                            {formatCurrency(sf.paidAmount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                            className="border rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.note}
                            onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                            placeholder="Ghi chú..."
                            className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">{sf.note || '—'}</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => savePayment(sf)}
                                disabled={saving}
                                className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(sf)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Cập nhật
                            </button>
                          )}
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
