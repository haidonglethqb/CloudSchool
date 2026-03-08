'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { adminApi, exportApi, downloadBlob } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Search, Plus, Building2, Loader2, MoreVertical,
  Pause, Play, Trash2, Eye, X, Download,
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  price: number
  studentLimit: number
  teacherLimit: number
  classLimit: number
  isActive: boolean
}

interface School {
  id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  plan: { id: string; name: string } | null
  _count?: { users: number; students: number; classes: number }
  createdAt: string
}

const statusMap: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Hoạt động', cls: 'bg-green-100 text-green-700' },
  SUSPENDED: { label: 'Tạm ngưng', cls: 'bg-red-100 text-red-700' },
  INACTIVE: { label: 'Ngưng', cls: 'bg-gray-100 text-gray-600' },
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', adminEmail: '', adminName: '', adminPassword: '', planId: '' })

  const fetchSchools = useCallback(() => {
    setLoading(true)
    adminApi.listSchools({ search: search || undefined, status: statusFilter || undefined })
      .then(res => setSchools(res.data.data?.schools || res.data.data || []))
      .catch(() => toast.error('Lỗi tải danh sách'))
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { fetchSchools() }, [fetchSchools])

  useEffect(() => {
    adminApi.listSubscriptions()
      .then(res => setPlans((res.data.data || []).filter((p: Plan) => p.isActive)))
      .catch(() => {})
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.adminEmail || !form.adminName) {
      toast.error('Vui lòng điền đủ thông tin bắt buộc')
      return
    }
    setCreating(true)
    try {
      await adminApi.createSchool({
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        adminEmail: form.adminEmail,
        adminName: form.adminName,
        adminPassword: form.adminPassword || undefined,
        planId: form.planId || undefined,
      })
      toast.success('Tạo trường thành công!')
      setShowCreate(false)
      setForm({ name: '', address: '', phone: '', email: '', adminEmail: '', adminName: '', adminPassword: '', planId: '' })
      fetchSchools()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi tạo trường')
    } finally {
      setCreating(false)
    }
  }

  const handleSuspend = async (id: string) => {
    if (!confirm('Tạm ngưng trường này?')) return
    try {
      await adminApi.suspendSchool(id)
      toast.success('Đã tạm ngưng')
      fetchSchools()
    } catch { toast.error('Lỗi') }
  }

  const handleActivate = async (id: string) => {
    try {
      await adminApi.activateSchool(id)
      toast.success('Đã kích hoạt')
      fetchSchools()
    } catch { toast.error('Lỗi') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa trường này? Hành động này không thể hoàn tác.')) return
    try {
      await adminApi.deleteSchool(id)
      toast.success('Đã xóa')
      fetchSchools()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi xóa')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý trường học</h1>
          <p className="text-gray-600 mt-1">Danh sách tất cả trường trong hệ thống</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Thêm trường
        </button>
        <button onClick={async () => {
          try {
            const res = await exportApi.schools({ format: 'xlsx' })
            downloadBlob(res.data, 'schools.xlsx')
            toast.success('Đã xuất file')
          } catch { toast.error('Lỗi xuất file') }
        }} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input pl-10" placeholder="Tìm theo tên, mã trường..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="SUSPENDED">Tạm ngưng</option>
          <option value="INACTIVE">Ngưng</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : schools.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Không tìm thấy trường nào</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Trường</th>
                <th className="table-header">Mã</th>
                <th className="table-header">Gói</th>
                <th className="table-header text-center">HS</th>
                <th className="table-header text-center">Lớp</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell">
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      {s.email && <p className="text-xs text-gray-500">{s.email}</p>}
                    </div>
                  </td>
                  <td className="table-cell font-mono text-sm">{s.code}</td>
                  <td className="table-cell">{s.plan?.name || '—'}</td>
                  <td className="table-cell text-center">{s._count?.students ?? 0}</td>
                  <td className="table-cell text-center">{s._count?.classes ?? 0}</td>
                  <td className="table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusMap[s.status]?.cls}`}>
                      {statusMap[s.status]?.label}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/schools/${s.id}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Chi tiết">
                        <Eye className="w-4 h-4" />
                      </Link>
                      {s.status === 'ACTIVE' ? (
                        <button onClick={() => handleSuspend(s.id)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Tạm ngưng">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(s.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Kích hoạt">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Thêm trường mới</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="label">Tên trường *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Trường THPT ABC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Địa chỉ</label>
                  <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <label className="label">SĐT</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Email trường</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <hr />
              <p className="text-sm font-medium text-gray-700">Tài khoản quản trị</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Họ tên admin *</label>
                  <input className="input" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email admin *</label>
                  <input type="email" className="input" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Mật khẩu (mặc định: Admin@123)</label>
                <input type="password" className="input" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="Admin@123" />
              </div>
              <hr />
              <div>
                <label className="label">Gói dịch vụ</label>
                <select className="input" value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
                  <option value="">— Không chọn —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.price.toLocaleString('vi-VN')}đ (HS: {p.studentLimit}, GV: {p.teacherLimit}, Lớp: {p.classLimit})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Tạo trường
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
