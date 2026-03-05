'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Loader2, X, Trash2, Pencil, CreditCard } from 'lucide-react'

interface Plan {
  id: string
  name: string
  maxStudents: number
  maxTeachers: number
  maxClasses: number
  price: number
  features: string[]
  _count?: { tenants: number }
}

const emptyForm = { name: '', maxStudents: 500, maxTeachers: 50, maxClasses: 30, price: 0, features: '' }

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    adminApi.listSubscriptions()
      .then(res => setPlans(res.data.data || []))
      .catch(() => toast.error('Lỗi tải danh sách'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (p: Plan) => {
    setEditing(p.id)
    setForm({
      name: p.name,
      maxStudents: p.maxStudents,
      maxTeachers: p.maxTeachers,
      maxClasses: p.maxClasses,
      price: p.price,
      features: (p.features || []).join(', '),
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { toast.error('Vui lòng nhập tên gói'); return }
    setSaving(true)
    try {
      const data = {
        name: form.name,
        maxStudents: Number(form.maxStudents),
        maxTeachers: Number(form.maxTeachers),
        maxClasses: Number(form.maxClasses),
        price: Number(form.price),
        features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : [],
      }
      if (editing) {
        await adminApi.updateSubscription(editing, data)
        toast.success('Cập nhật thành công')
      } else {
        await adminApi.createSubscription(data)
        toast.success('Tạo gói thành công')
      }
      setShowForm(false)
      fetch()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa gói dịch vụ này?')) return
    try {
      await adminApi.deleteSubscription(id)
      toast.success('Đã xóa')
      fetch()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi xóa')
    }
  }

  const formatPrice = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gói dịch vụ</h1>
          <p className="text-gray-600 mt-1">Quản lý các gói subscription</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Thêm gói
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : plans.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có gói dịch vụ nào</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(p => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <p className="text-2xl font-bold text-primary mb-4">{formatPrice(p.price)}<span className="text-sm font-normal text-gray-500">/tháng</span></p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Học sinh tối đa: <strong>{p.maxStudents}</strong></p>
                <p>Giáo viên tối đa: <strong>{p.maxTeachers}</strong></p>
                <p>Lớp tối đa: <strong>{p.maxClasses}</strong></p>
              </div>
              {p.features && p.features.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Tính năng:</p>
                  <div className="flex flex-wrap gap-1">
                    {p.features.map((f, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Sửa gói' : 'Thêm gói mới'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Tên gói *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Basic, Pro, Enterprise" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Max HS</label>
                  <input type="number" className="input" value={form.maxStudents} onChange={e => setForm({ ...form, maxStudents: +e.target.value })} />
                </div>
                <div>
                  <label className="label">Max GV</label>
                  <input type="number" className="input" value={form.maxTeachers} onChange={e => setForm({ ...form, maxTeachers: +e.target.value })} />
                </div>
                <div>
                  <label className="label">Max Lớp</label>
                  <input type="number" className="input" value={form.maxClasses} onChange={e => setForm({ ...form, maxClasses: +e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Giá (VNĐ/tháng)</label>
                <input type="number" className="input" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} />
              </div>
              <div>
                <label className="label">Tính năng (cách nhau bởi dấu phẩy)</label>
                <input className="input" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder="Quản lý điểm, Báo cáo, SMS" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Cập nhật' : 'Tạo gói'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
