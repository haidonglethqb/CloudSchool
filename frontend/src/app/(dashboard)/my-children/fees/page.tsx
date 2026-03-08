'use client'

import { useEffect, useState } from 'react'
import { feeApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  DollarSign, Loader2, CheckCircle, Clock,
  AlertCircle, Ban, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

interface ParentStudentFee {
  id: string
  amount: number
  paidAmount: number
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'EXEMPT'
  paidAt: string | null
  note: string | null
  fee: {
    id: string
    name: string
    description: string | null
    category: string
    isRequired: boolean
    dueDate: string | null
    isActive: boolean
  }
  student: {
    id: string
    fullName: string
    studentCode: string
    class: { name: string } | null
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  PENDING: { label: 'Chưa nộp', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', icon: Clock },
  PAID: { label: 'Đã nộp', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle },
  PARTIAL: { label: 'Nộp 1 phần', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: DollarSign },
  OVERDUE: { label: 'Quá hạn', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: AlertCircle },
  EXEMPT: { label: 'Miễn phí', color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', icon: Ban },
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

export default function ParentFeesPage() {
  const { user } = useAuthStore()
  const [fees, setFees] = useState<ParentStudentFee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChild, setSelectedChild] = useState<string>('')

  useEffect(() => {
    feeApi.getParentFees()
      .then(res => setFees(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const childNames = [...new Map(fees.map(f => [f.student.id, f.student])).values()]
  const filteredFees = selectedChild ? fees.filter(f => f.student.id === selectedChild) : fees

  const totalDue = filteredFees
    .filter(f => f.status !== 'EXEMPT' && f.status !== 'PAID')
    .reduce((s, f) => s + (f.amount - f.paidAmount), 0)
  const totalPaid = filteredFees.reduce((s, f) => s + f.paidAmount, 0)
  const pendingCount = filteredFees.filter(f => f.status === 'PENDING' || f.status === 'OVERDUE').length

  // Group by student
  const groupedByStudent = filteredFees.reduce<Record<string, { student: ParentStudentFee['student']; fees: ParentStudentFee[] }>>((acc, sf) => {
    if (!acc[sf.student.id]) {
      acc[sf.student.id] = { student: sf.student, fees: [] }
    }
    acc[sf.student.id].fees.push(sf)
    return acc
  }, {})

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
      <div className="flex items-center gap-4">
        <Link href="/my-children" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Học phí</h1>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi các khoản phí của con em</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cần nộp</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalDue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Đã nộp</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Chưa nộp</p>
              <p className="text-lg font-bold text-red-600">{pendingCount} khoản</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      {childNames.length > 1 && (
        <div className="flex items-center gap-3">
          <select
            value={selectedChild}
            onChange={e => setSelectedChild(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Tất cả con em</option>
            {childNames.map(c => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Fee List */}
      {fees.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Chưa có khoản phí nào</p>
        </div>
      ) : (
        Object.values(groupedByStudent).map(({ student, fees: studentFees }) => (
          <div key={student.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              {student.fullName}
              {student.class && <span className="text-gray-400 font-normal">— {student.class.name}</span>}
            </h3>

            <div className="grid gap-3">
              {studentFees.map(sf => {
                const cfg = STATUS_CONFIG[sf.status]
                const StatusIcon = cfg.icon
                const isOverdue = sf.fee.dueDate && new Date(sf.fee.dueDate) < new Date() && sf.status !== 'PAID' && sf.status !== 'EXEMPT'
                const remaining = sf.amount - sf.paidAmount

                return (
                  <div key={sf.id} className={`bg-white rounded-xl border p-4 ${isOverdue ? 'border-red-200' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-gray-900">{sf.fee.name}</h4>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                          {sf.fee.isRequired && (
                            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Bắt buộc</span>
                          )}
                        </div>
                        {sf.fee.description && (
                          <p className="text-xs text-gray-400 mt-1">{sf.fee.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{CATEGORY_LABELS[sf.fee.category]}</span>
                          {sf.fee.dueDate && (
                            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                              Hạn: {new Date(sf.fee.dueDate).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                          {sf.paidAt && (
                            <span className="text-green-500">
                              Nộp ngày: {new Date(sf.paidAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(sf.amount)}</p>
                        {sf.status === 'PARTIAL' && (
                          <p className="text-xs text-orange-500 mt-0.5">Còn thiếu: {formatCurrency(remaining)}</p>
                        )}
                        {sf.status === 'PAID' && (
                          <p className="text-xs text-green-500 mt-0.5">Đã nộp đủ</p>
                        )}
                      </div>
                    </div>

                    {sf.note && (
                      <p className="text-xs text-gray-400 mt-2 pt-2 border-t">Ghi chú: {sf.note}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
