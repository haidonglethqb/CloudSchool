'use client'

import { useEffect, useState } from 'react'
import { parentApi, studentApi } from '@/lib/api'
import { isValidVietnamPhone } from '@/lib/phone'
import { Edit2, Link2, Search, Trash2, Unlink, UserPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ParentChild {
  id: string
  fullName: string
  studentCode: string
  className: string | null
  relationship: string
}

interface Parent {
  id: string
  email: string
  fullName: string
  phone: string | null
  isActive: boolean
  children: ParentChild[]
  createdAt: string
}

interface StudentOption {
  id: string
  fullName: string
  studentCode: string
  class?: {
    name?: string | null
  } | null
}

interface ParentEditForm {
  fullName: string
  email: string
  phone: string
  isActive: boolean
  password: string
}

const emptyCreateForm = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  studentIds: [] as string[]
}

const emptyEditForm: ParentEditForm = {
  fullName: '',
  email: '',
  phone: '',
  isActive: true,
  password: ''
}

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')

  const [linkModal, setLinkModal] = useState<{ parentId: string; parentName: string } | null>(null)
  const [linkStudentId, setLinkStudentId] = useState('')

  const [editModal, setEditModal] = useState<Parent | null>(null)
  const [editForm, setEditForm] = useState<ParentEditForm>(emptyEditForm)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const fetchParents = async () => {
    try {
      const res = await parentApi.list({ search })
      setParents((res.data?.data || []) as Parent[])
    } catch (err) {
      console.error('Failed to fetch parents:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const res = await studentApi.list({ search: '', limit: 100 } as any)
      setStudents((res.data?.data || []) as StudentOption[])
    } catch (err) {
      console.error('Failed to fetch students:', err)
    }
  }

  useEffect(() => {
    fetchParents()
  }, [search])

  useEffect(() => {
    fetchStudents()
  }, [])

  const toggleStudentSelection = (studentId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId]
    }))
  }

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError('')

    try {
      await parentApi.create(createForm)
      toast.success('Đã tạo tài khoản phụ huynh')
      setShowCreateModal(false)
      setCreateForm(emptyCreateForm)
      fetchParents()
    } catch (err: any) {
      setCreateError(err.response?.data?.error?.message || err.message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const openEditModal = (parent: Parent) => {
    setEditModal(parent)
    setEditForm({
      fullName: parent.fullName,
      email: parent.email,
      phone: parent.phone || '',
      isActive: parent.isActive,
      password: ''
    })
  }

  const closeEditModal = () => {
    setEditModal(null)
    setEditForm(emptyEditForm)
  }

  const handleUpdateParent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModal) return

    const fullName = editForm.fullName.trim()
    const email = editForm.email.trim()
    const phone = editForm.phone.trim()
    const password = editForm.password

    if (!fullName || !email) {
      toast.error('Vui lòng nhập đầy đủ họ tên và email')
      return
    }
    if (phone && !isValidVietnamPhone(phone)) {
      toast.error('Số điện thoại không hợp lệ')
      return
    }
    if (password && password.length < 6) {
      toast.error('Mật khẩu mới tối thiểu 6 ký tự')
      return
    }

    setEditSubmitting(true)
    try {
      const payload: { fullName: string; email: string; phone: string; isActive: boolean; password?: string } = {
        fullName,
        email,
        phone,
        isActive: editForm.isActive
      }
      if (password) payload.password = password

      await parentApi.update(editModal.id, payload)
      toast.success('Đã cập nhật tài khoản phụ huynh')
      closeEditModal()
      fetchParents()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi cập nhật')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeleteParent = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài khoản phụ huynh này?')) return

    try {
      await parentApi.delete(id)
      toast.success('Đã xóa tài khoản phụ huynh')
      fetchParents()
    } catch (err) {
      console.error('Failed to delete parent:', err)
      toast.error('Không thể xóa phụ huynh')
    }
  }

  const handleUnlinkStudent = async (parentId: string, studentId: string) => {
    if (!confirm('Hủy liên kết phụ huynh với học sinh này?')) return

    try {
      await parentApi.unlinkStudent(parentId, studentId)
      toast.success('Đã hủy liên kết')
      fetchParents()
    } catch {
      toast.error('Lỗi hủy liên kết')
    }
  }

  const handleLinkStudent = async () => {
    if (!linkModal || !linkStudentId) return

    try {
      await parentApi.linkStudent(linkModal.parentId, linkStudentId)
      toast.success('Đã liên kết học sinh')
      setLinkModal(null)
      setLinkStudentId('')
      fetchParents()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi liên kết')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Phụ huynh</h1>
          <p className="text-gray-500 mt-1">Tạo và quản lý tài khoản phụ huynh xem điểm</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Thêm phụ huynh
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên, email, SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phụ huynh</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Liên hệ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Học sinh liên kết</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {parents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Chưa có phụ huynh nào</td>
                </tr>
              ) : (
                parents.map((parent) => (
                  <tr key={parent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{parent.fullName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{parent.email}</div>
                      <div className="text-sm text-gray-500">{parent.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {parent.children.map((child) => (
                          <div key={child.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{child.fullName}</span>
                            <span className="text-gray-500">({child.studentCode}) - {child.className}</span>
                            <button
                              onClick={() => handleUnlinkStudent(parent.id, child.id)}
                              className="p-0.5 text-red-400 hover:text-red-600"
                              title="Hủy liên kết"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        parent.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {parent.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(parent)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLinkModal({ parentId: parent.id, parentName: parent.fullName })}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Liên kết học sinh"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteParent(parent.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Thêm tài khoản phụ huynh</h2>
            </div>
            <form onSubmit={handleCreateParent} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{createError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chọn học sinh liên kết *</label>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={createForm.studentIds.includes(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="font-medium text-sm">{student.fullName}</div>
                        <div className="text-xs text-gray-500">
                          {student.studentCode} - {student.class?.name || 'Chưa xếp lớp'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {createForm.studentIds.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Vui lòng chọn ít nhất một học sinh</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting || createForm.studentIds.length === 0}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {createSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Cập nhật tài khoản phụ huynh</h2>
            </div>
            <form onSubmit={handleUpdateParent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới (bỏ trống để giữ nguyên)</label>
                <input
                  type="password"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                Tài khoản đang hoạt động
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {editSubmitting ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Liên kết học sinh cho {linkModal.parentName}</h2>
              <button onClick={() => { setLinkModal(null); setLinkStudentId('') }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn học sinh</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  value={linkStudentId}
                  onChange={(e) => setLinkStudentId(e.target.value)}
                >
                  <option value="">-- Chọn học sinh --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.studentCode}) - {s.class?.name || 'Chưa xếp lớp'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setLinkModal(null); setLinkStudentId('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLinkStudent}
                  disabled={!linkStudentId}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  Liên kết
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
