'use client'

import { useEffect, useState, useCallback } from 'react'
import { userApi, classApi, subjectApi } from '@/lib/api'
import { getRoleLabel } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Search, Plus, Loader2, X, Trash2, Pencil, Users,
  UserX, BookOpen,
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

interface Assignment {
  id: string
  classId: string
  subjectId: string
  isHomeroom: boolean
  class: { id: string; name: string }
  subject: { id: string; name: string }
}

interface ClassItem { id: string; name: string }
interface SubjectItem { id: string; name: string }

const MANAGE_ROLES = ['SUPER_ADMIN', 'STAFF', 'TEACHER'] as const
const FILTER_ROLES = ['SUPER_ADMIN', 'STAFF', 'TEACHER'] as const

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

  // Teacher assignment state
  const [showAssignments, setShowAssignments] = useState(false)
  const [assignUserId, setAssignUserId] = useState<string | null>(null)
  const [assignUserName, setAssignUserName] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [allClasses, setAllClasses] = useState<ClassItem[]>([])
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([])
  const [newAssign, setNewAssign] = useState({ classId: '', subjectId: '', isHomeroom: false })
  const [savingAssign, setSavingAssign] = useState(false)

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

  const openAssignments = async (u: UserItem) => {
    setAssignUserId(u.id)
    setAssignUserName(u.fullName)
    setNewAssign({ classId: '', subjectId: '', isHomeroom: false })
    try {
      const [userRes, classesRes, subjectsRes] = await Promise.all([
        userApi.get(u.id),
        classApi.list(),
        subjectApi.list(),
      ])
      setAssignments(userRes.data.data.teacherAssignments || [])
      setAllClasses(classesRes.data.data || [])
      setAllSubjects(subjectsRes.data.data || [])
      setShowAssignments(true)
    } catch {
      toast.error('Lỗi tải dữ liệu phân công')
    }
  }

  const addAssignment = () => {
    if (!newAssign.classId || !newAssign.subjectId) {
      return toast.error('Chọn lớp và môn học')
    }
    const exists = assignments.some(
      a => a.classId === newAssign.classId && a.subjectId === newAssign.subjectId
    )
    if (exists) return toast.error('Phân công này đã tồn tại')

    const cls = allClasses.find(c => c.id === newAssign.classId)
    const subj = allSubjects.find(s => s.id === newAssign.subjectId)
    if (!cls || !subj) return

    setAssignments(prev => [...prev, {
      id: `new-${Date.now()}`,
      classId: newAssign.classId,
      subjectId: newAssign.subjectId,
      isHomeroom: newAssign.isHomeroom,
      class: cls,
      subject: subj,
    }])
    setNewAssign({ classId: '', subjectId: '', isHomeroom: false })
  }

  const removeAssignment = (idx: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== idx))
  }

  const saveAssignments = async () => {
    if (!assignUserId) return
    setSavingAssign(true)
    try {
      await userApi.updateAssignments(
        assignUserId,
        assignments.map(a => ({
          classId: a.classId,
          subjectId: a.subjectId,
          isHomeroom: a.isHomeroom,
        }))
      )
      toast.success('Lưu phân công thành công')
      setShowAssignments(false)
    } catch {
      toast.error('Lỗi lưu phân công')
    } finally {
      setSavingAssign(false)
    }
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
          department: form.role === 'TEACHER' ? undefined : (form.department || undefined),
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
          department: form.role === 'TEACHER' ? undefined : (form.department || undefined),
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
    if (!confirm('Xóa người dùng này? Thao tác này không thể hoàn tác.')) return
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
          <p className="text-gray-600 mt-1">Quản lý tài khoản nhân viên và giáo viên</p>
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
          {FILTER_ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
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
                      {u.role === 'TEACHER' && (
                        <button onClick={() => openAssignments(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Phân công giảng dạy">
                          <BookOpen className="w-4 h-4" />
                        </button>
                      )}
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

      {/* Create/Edit User Modal */}
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
                    {MANAGE_ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">SĐT</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              {form.role !== 'TEACHER' && (
                <div>
                  <label className="label">Phòng ban</label>
                  <input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="VD: Phòng Đào tạo, Ban Giám hiệu" />
                </div>
              )}
              {form.role === 'TEACHER' && !editing && (
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
                  Sau khi tạo, bấm biểu tượng 📖 trong danh sách để phân công lớp/môn cho giáo viên.
                </p>
              )}
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

      {/* Teacher Assignment Modal */}
      {showAssignments && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold">Phân công giảng dạy</h2>
                <p className="text-sm text-gray-500">{assignUserName}</p>
              </div>
              <button onClick={() => setShowAssignments(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* Current assignments */}
              {assignments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Chưa có phân công nào</p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((a, idx) => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-900">{a.class.name}</span>
                        <span className="text-gray-400">—</span>
                        <span className="text-gray-700">{a.subject.name}</span>
                        {a.isHomeroom && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">CN</span>
                        )}
                      </div>
                      <button onClick={() => removeAssignment(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new assignment */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Thêm phân công</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newAssign.classId}
                    onChange={e => setNewAssign(p => ({ ...p, classId: e.target.value }))}
                    className="input text-sm"
                  >
                    <option value="">Chọn lớp</option>
                    {allClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={newAssign.subjectId}
                    onChange={e => setNewAssign(p => ({ ...p, subjectId: e.target.value }))}
                    className="input text-sm"
                  >
                    <option value="">Chọn môn</option>
                    {allSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newAssign.isHomeroom}
                      onChange={e => setNewAssign(p => ({ ...p, isHomeroom: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-gray-600">Chủ nhiệm</span>
                  </label>
                  <button
                    type="button"
                    onClick={addAssignment}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />Thêm
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowAssignments(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                Hủy
              </button>
              <button onClick={saveAssignments} disabled={savingAssign} className="btn-primary">
                {savingAssign && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Lưu phân công
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
