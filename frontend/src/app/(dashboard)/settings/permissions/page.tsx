'use client'

import { useEffect, useMemo, useState } from 'react'
import { settingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { Shield, Save, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const ROLES = [
  { key: 'STAFF', label: 'Nhan vien giao vu' },
  { key: 'TEACHER', label: 'Giao vien' },
]

const MODULES = [
  { key: 'student-admission', label: 'Tiep nhan hoc sinh' },
  { key: 'student-lookup', label: 'Tra cuu hoc sinh' },
  { key: 'classes', label: 'Lop hoc' },
  { key: 'class-transfer', label: 'Chuyen lop' },
  { key: 'subjects', label: 'Mon hoc' },
  { key: 'scores', label: 'Diem so' },
  { key: 'reports', label: 'Bao cao' },
  { key: 'parents', label: 'Phu huynh' },
  { key: 'academic-calendar', label: 'Nam hoc & hoc ky' },
  { key: 'fees', label: 'Hoc phi' },
  { key: 'export', label: 'Xuat du lieu' },
  { key: 'settings', label: 'Cai dat' },
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
    settingsApi.getRolePermissions()
      .then((res) => setPermissions(res.data.data || {}))
      .catch(() => toast.error('Khong the tai phan quyen'))
      .finally(() => setLoading(false))
  }, [user, router])

  const roleStats = useMemo(() => {
    return ROLES.map((role) => ({
      ...role,
      count: (permissions[role.key] || []).length,
    }))
  }, [permissions])

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
      toast.success('Luu phan quyen thanh cong')
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Luu phan quyen that bai')
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
          <h1 className="text-2xl font-bold text-gray-900">Phan quyen vai tro</h1>
          <p className="text-sm text-gray-600 mt-1">Bo tri quyen theo vai tro, giao dien gon va de quan sat hon.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roleStats.map((role) => (
          <div key={role.key} className="card p-4">
            <p className="text-sm text-gray-500">{role.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{role.count}/{MODULES.length}</p>
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
              {MODULES.map((module) => {
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
          SUPER_ADMIN luon co toan quyen. Menu sidebar cua STAFF/TEACHER se doi theo cau hinh nay.
        </p>
        <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Luu phan quyen
        </button>
      </div>
    </div>
  )
}
