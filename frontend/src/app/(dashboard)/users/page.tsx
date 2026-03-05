'use client'

import { useEffect, useState, useCallback } from 'react'
import { userApi } from '@/lib/api'
import { getRoleLabel } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Search, Plus, Loader2, X, Trash2, Pencil, Users,
  UserX, Shield,
} from 'lucide-react'

interface UserItem {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: string
  department: string | null
  isActive: boolean
  createdAt: string
}

const ROLES = ['SUPER_ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT'] as const

const emptyForm = { email: '', password: '', fullName: '', phone: '', role: 'TEACHER' as string, department: '' }

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    userApi.list({ search: search || undefined, role: roleFilter || undefined })
      .then(res => setUsers(res.data.data?.users || res.data.data || []))
      .catch(() => toast.error('Lỗi tải danh sách'))
      .finally(() => setLoading(false))
  }, [search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (u: UserItem) => {
    setEditing(u.id)
    setForm({
      email: u.email,
      password: '',
      fullName: u.fullName,
      phone: u.phone || '',
      role: u.role,
      department: u.department || '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.fullName || !form.role) {
      toast.error('Vui lòng điền đủ thông tin')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const data: Record<string, unknown> = {
          fullName: form.fullName,
          phone: form.phone || undefined,
          role: form.role,
          department: form.department || undefined,
        }
        if (form.password) data.password = form.password
        await userApi.update(editing, data)
        toast.success('Cập nhật thành công')
      } else {
        if (!form.password) { toast.error('Vui lòng nhập mật khẩu'); setSaving(false); return }
        await userApi.create({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone || undefined,
          role: form.role,
          department: form.department || undefined,
        })
        toast.success('Tạo người dùng thành công')
      }
      setShowForm(false)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async (id: string) => {
    if (!confirm('Vô hiệu hóa người dùng này?')) return
    try {
      await userApi.disable(id)
      toast.success('Đã vô hiệu hóa')
      fetchUsers()
    } catch { toast.error('Lỗi') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa người dùng này?')) return
    try {
      await userApi.delete(id)
      toast.success('Đã xóa')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi xóa')
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-700',
      STAFF: 'bg-blue-100 text-blue-700',
      TEACHER: 'bg-green-100 text-green-700',
      STUDENT: 'bg-yellow-100 text-yellow-700',
      PARENT: 'bg-orange-100 text-orange-700',
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[role] || 'bg-gray-100 text-gray-600'}`}>
        {getRoleLabel(role)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
          <p className="text-gray-600 mt-1">Tạo và quản lý tài khoản trong trường</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Thêm người dùng
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input pl-10" placeholder="Tìm theo tên, email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-40" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Không tìm thấy người dùng nào</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Họ tên</th>
                <th className="table-header">Email</th>
                <th className="table-header">Vai trò</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell">
                    <div>
                      <p className="font-medium text-gray-900">{u.fullName}</p>
                      {u.department && <p className="text-xs text-gray-500">{u.department}</p>}
                    </div>
                  </td>
                  <td className="table-cell text-sm">{u.email}</td>
                  <td className="table-cell">{roleBadge(u.role)}</td>
                  <td className="table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Sửa">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.isActive && (
                        <button onClick={() => handleDisable(u.id)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Vô hiệu hóa">
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Xóa">
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Sửa người dùng' : 'Thêm người dùng'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Họ tên *</label>
                <input className="input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
              </div>
              <div>
                <label className="label">{editing ? 'Mật khẩu mới (bỏ trống = giữ nguyên)' : 'Mật khẩu *'}</label>
                <input type="password" className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vai trò *</label>
                  <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">SĐT</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Phòng ban</label>
                <input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="VD: Tổ Toán, Phòng Đào tạo" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Cập nhật' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
