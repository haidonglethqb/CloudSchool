'use client'

import { useEffect, useState } from 'react'
import { settingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { Shield, Save, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const ROLES = [
  { key: 'STAFF', label: 'Nhân viên giáo vụ' },
  { key: 'TEACHER', label: 'Giáo viên' },
]

const MODULES = [
  { key: 'students', label: 'Học sinh' },
  { key: 'classes', label: 'Lớp học' },
  { key: 'subjects', label: 'Môn học' },
  { key: 'scores', label: 'Điểm số' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'parents', label: 'Phụ huynh' },
  { key: 'promotion', label: 'Xét lên lớp' },
  { key: 'export', label: 'Xuất dữ liệu' },
  { key: 'settings', label: 'Cài đặt' },
]

type Permissions = Record<string, string[]>

export default function PermissionsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [permissions, setPermissions] = useState<Permissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard')
      return
    }
    fetchPermissions()
  }, [user])

  const fetchPermissions = async () => {
    try {
      const res = await settingsApi.getRolePermissions()
      setPermissions(res.data.data)
    } catch {
      toast.error('Không thể tải phân quyền')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (role: string, module: string) => {
    setPermissions(prev => {
      const current = prev[role] || []
      const has = current.includes(module)
      return {
        ...prev,
        [role]: has ? current.filter(m => m !== module) : [...current, module]
      }
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await settingsApi.updateRolePermissions(permissions)
      toast.success('Lưu phân quyền thành công')
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lưu phân quyền thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân quyền vai trò</h1>
          <p className="text-gray-600 text-sm mt-1">
            Cấu hình quyền truy cập các module cho từng vai trò trong trường
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-48">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Module
                  </div>
                </th>
                {ROLES.map(role => (
                  <th key={role.key} className="text-center px-4 py-3 text-sm font-semibold text-gray-700 w-40">
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MODULES.map(mod => (
                <tr key={mod.key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {mod.label}
                  </td>
                  {ROLES.map(role => {
                    const checked = (permissions[role.key] || []).includes(mod.key)
                    return (
                      <td key={role.key} className="text-center px-4 py-3">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(role.key, mod.key)}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            SUPER_ADMIN luôn có toàn quyền. Thay đổi sẽ ảnh hưởng đến menu hiển thị của các tài khoản.
          </p>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Lưu phân quyền
          </button>
        </div>
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Hướng dẫn</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>Nhân viên giáo vụ (STAFF)</strong>: Quản lý học sinh, lớp, điểm, phụ huynh</li>
          <li>• <strong>Giáo viên (TEACHER)</strong>: Nhập điểm, xem lớp được phân công, báo cáo</li>
          <li>• Bỏ chọn module sẽ ẩn menu tương ứng khỏi sidebar của vai trò đó</li>
        </ul>
      </div>
    </div>
  )
}
