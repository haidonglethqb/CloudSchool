'use client'

import { useEffect, useMemo, useState } from 'react'
import { settingsApi } from '@/lib/api'
import { getUiModuleLabel, getUiRoleLabel } from '@/lib/ui-copy'
import { resolveUiErrorMessage } from '@/lib/ui-error'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { Shield, Save, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const ROLES = [
  { key: 'STAFF', label: getUiRoleLabel('STAFF'), usageKey: 'staff' },
  { key: 'TEACHER', label: getUiRoleLabel('TEACHER'), usageKey: 'teachers' },
] as const

// Phải đồng bộ với backend/src/constants/module-registry.js (MODULE_KEYS & ROLE_MODULE_KEYS)
const ALL_MODULES = [
  { key: 'users', label: getUiModuleLabel('users') },
  { key: 'student-admission', label: getUiModuleLabel('student-admission') },
  { key: 'student-lookup', label: getUiModuleLabel('student-lookup') },
  { key: 'classes', label: getUiModuleLabel('classes') },
  { key: 'class-transfer', label: getUiModuleLabel('class-transfer') },
  { key: 'subjects', label: getUiModuleLabel('subjects') },
  { key: 'scores', label: getUiModuleLabel('scores') },
  { key: 'reports', label: getUiModuleLabel('reports') },
  { key: 'parents', label: getUiModuleLabel('parents') },
  { key: 'academic-calendar', label: getUiModuleLabel('academic-calendar') },
  { key: 'settings', label: getUiModuleLabel('settings') },
  { key: 'export', label: getUiModuleLabel('export') },
]

// Chỉ hiển thị các module mà role đó được phép cấu hình (khớp với ROLE_MODULE_KEYS ở backend)
const ROLE_MODULES: Record<string, typeof ALL_MODULES> = {
  STAFF: ALL_MODULES, // STAFF có thể được cấp tất cả modules
  TEACHER: ALL_MODULES.filter((m) =>
    ['student-lookup', 'classes', 'scores', 'reports'].includes(m.key)
  ), // TEACHER chỉ có 5 modules phù hợp
}

type Permissions = Record<string, string[]>
type RoleLimitKey = 'staff' | 'teachers'

interface PermissionMeta {
  roleUsage?: Partial<Record<RoleLimitKey, number>>
  planLimits?: Partial<Record<RoleLimitKey, number | null>>
}

export default function PermissionsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [permissions, setPermissions] = useState<Permissions>({})
  const [permissionMeta, setPermissionMeta] = useState<PermissionMeta>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard')
      return
    }
    settingsApi.getRolePermissions()
      .then((res) => {
        setPermissions(res.data.data || {})
        setPermissionMeta(res.data.meta || {})
      })
      .catch(() => toast.error('Không thể tải phân quyền.'))
      .finally(() => setLoading(false))
  }, [user, router])

  const roleStats = useMemo(() => {
    return ROLES.map((role) => {
      const used = permissionMeta.roleUsage?.[role.usageKey] ?? 0
      const limit = permissionMeta.planLimits?.[role.usageKey]
      return { ...role, used, limit }
    })
  }, [permissionMeta])

  const togglePermission = (role: string, module: string) => {
    setPermissions((prev) => {
      const current = prev[role] || []
      const has = current.includes(module)
      return {
        ...prev,
        [role]: has ? current.filter((item) => item !== module) : [...current, module],
      }
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await settingsApi.updateRolePermissions(permissions)
      toast.success('Lưu phân quyền thành công.')
    } catch (error: any) {
      toast.error(resolveUiErrorMessage(error, 'Lưu phân quyền thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân quyền vai trò</h1>
          <p className="text-sm text-gray-600 mt-1">Bố trí quyền theo vai trò, giao diện gọn và dễ quan sát hơn.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roleStats.map((role) => (
          <div key={role.key} className="card p-4">
            <p className="text-sm text-gray-500">{role.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {role.used}/{role.limit ?? '-'}
            </p>
            <p className="mt-1 text-xs text-gray-500">Số người đang hoạt động theo giới hạn gói</p>
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-4">
        {ROLES.map((role) => (
          <section key={role.key} className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-gray-900">{role.label}</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(ROLE_MODULES[role.key] || ALL_MODULES).map((module) => {
                const checked = (permissions[role.key] || []).includes(module.key)
                return (
                  <label key={module.key} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(role.key, module.key)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-800">{module.label}</span>
                  </label>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="card p-4 bg-gray-50 flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          Quản trị viên trường luôn có toàn quyền. Menu sidebar của Nhân viên giáo vụ và Giáo viên sẽ đổi theo cấu hình này.
        </p>
        <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Lưu phân quyền
        </button>
      </div>
    </div>
  )
}
