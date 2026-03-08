'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Loader2, X, Trash2, Pencil, CreditCard, Check, Users, BookOpen, Building2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Plan {
  id: string
  name: string
  description: string | null
  maxStudents: number
  maxTeachers: number
  maxClasses: number
  price: number
  features: string[]
  isActive: boolean
  _count?: { tenants: number }
}

const PREDEFINED_FEATURES = [
  'Quản lý học sinh',
  'Nhập điểm',
  'Báo cáo chi tiết',
  'Quản lý phụ huynh',
  'Xuất Excel',
  'Xếp loại tự động',
  'Hỗ trợ ưu tiên',
  'Hỗ trợ 24/7',
  'API tích hợp',
  'Tùy chỉnh thương hiệu',
]

const emptyForm = {
  name: '',
  description: '',
  maxStudents: 500,
  maxTeachers: 50,
  maxClasses: 30,
  price: 0,
  features: [] as string[],
  customFeature: '',
  isActive: true,
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchPlans = useCallback(() => {
    setLoading(true)
    adminApi.listSubscriptions()
      .then(res => setPlans(res.data.data || []))
      .catch(() => toast.error('Lỗi tải danh sách'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (p: Plan) => {
    setEditing(p.id)
    const predefined = p.features.filter(f => PREDEFINED_FEATURES.includes(f))
    const custom = p.features.filter(f => !PREDEFINED_FEATURES.includes(f))
    setForm({
      name: p.name,
      description: p.description || '',
      maxStudents: p.maxStudents,
      maxTeachers: p.maxTeachers,
      maxClasses: p.maxClasses,
      price: p.price,
      features: predefined,
      customFeature: custom.join(', '),
      isActive: p.isActive,
    })
    setShowForm(true)
  }

  const toggleFeature = (f: string) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(f)
        ? prev.features.filter(x => x !== f)
        : [...prev.features, f]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { toast.error('Vui lòng nhập tên gói'); return }
    setSaving(true)
    try {
      const customFeatures = form.customFeature ? form.customFeature.split(',').map(f => f.trim()).filter(Boolean) : []
      const allFeatures = [...form.features, ...customFeatures]
      const data = {
        name: form.name,
        description: form.description || null,
        maxStudents: Number(form.maxStudents),
        maxTeachers: Number(form.maxTeachers),
        maxClasses: Number(form.maxClasses),
        price: Number(form.price),
        features: allFeatures,
        isActive: form.isActive,
      }
      if (editing) {
        await adminApi.updateSubscription(editing, data)
        toast.success('Cập nhật thành công')
      } else {
        await adminApi.createSubscription(data)
        toast.success('Tạo gói thành công')
      }
      setShowForm(false)
      fetchPlans()
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
      fetchPlans()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi xóa')
    }
  }

  const handleToggleActive = async (p: Plan) => {
    try {
      await adminApi.updateSubscription(p.id, { isActive: !p.isActive })
      toast.success(p.isActive ? 'Đã ẩn gói' : 'Đã kích hoạt gói')
      fetchPlans()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi cập nhật')
    }
  }

  const formatPrice = (n: number) =>
    n === 0 ? 'Miễn phí' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map(p => (
            <div key={p.id} className={`card p-5 relative ${!p.isActive ? 'opacity-60' : ''}`}>
              {!p.isActive && (
                <span className="absolute top-3 right-3 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Ẩn</span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                  {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleToggleActive(p)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title={p.isActive ? 'Ẩn gói' : 'Kích hoạt'}>
                    {p.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <p className="text-2xl font-bold text-primary mb-4">
                {formatPrice(p.price)}
                {p.price > 0 && <span className="text-sm font-normal text-gray-500">/tháng</span>}
              </p>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /><span>Tối đa <strong>{p.maxStudents}</strong> học sinh</span></div>
                <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-500" /><span>Tối đa <strong>{p.maxTeachers}</strong> giáo viên</span></div>
                <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-500" /><span>Tối đa <strong>{p.maxClasses}</strong> lớp học</span></div>
              </div>

              {p._count && (
                <p className="text-xs text-gray-400 mt-3">{p._count.tenants} trường đang sử dụng</p>
              )}

              {p.features && p.features.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-lg font-semibold">{editing ? 'Sửa gói' : 'Thêm gói mới'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Tên gói *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Basic, Pro, Enterprise" />
              </div>
              <div>
                <label className="label">Mô tả</label>
                <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="VD: Phù hợp trường quy mô vừa" />
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

              {/* Feature toggles */}
              <div>
                <label className="label mb-2">Tính năng</label>
                <div className="grid grid-cols-2 gap-2">
                  {PREDEFINED_FEATURES.map(f => {
                    const active = form.features.includes(f)
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFeature(f)}
                        className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                          active
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {active ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
                          {f}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label">Tính năng tùy chỉnh (phẩy phân cách)</label>
                <input className="input" value={form.customFeature} onChange={e => setForm({ ...form, customFeature: e.target.value })} placeholder="VD: SMS thông báo, Lịch biểu" />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-2">
                <label className="text-sm font-medium text-gray-700">Hiển thị gói cho trường đăng ký</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
                </button>
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
