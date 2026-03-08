'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminApi } from '@/lib/api'
import { formatDate, getRoleLabel } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Building2, Users, BarChart3, CreditCard, FileText,
  Loader2, Shield, Mail, Phone, MapPin, Calendar, Edit, Pause, Play,
} from 'lucide-react'

const tabs = [
  { key: 'overview', label: 'Tổng quan', icon: Building2 },
  { key: 'users', label: 'Người dùng', icon: Users },
  { key: 'stats', label: 'Thống kê', icon: BarChart3 },
  { key: 'subscription', label: 'Gói dịch vụ', icon: CreditCard },
  { key: 'activity', label: 'Nhật ký', icon: FileText },
]

const statusMap: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Hoạt động', cls: 'bg-green-100 text-green-700' },
  SUSPENDED: { label: 'Tạm ngưng', cls: 'bg-red-100 text-red-700' },
  INACTIVE: { label: 'Ngưng', cls: 'bg-gray-100 text-gray-600' },
}

export default function SchoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [school, setSchool] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '' })

  // Tab-specific data
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [activity, setActivity] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const fetchSchool = useCallback(async () => {
    try {
      const res = await adminApi.getSchool(id)
      setSchool(res.data.data)
      const s = res.data.data
      setEditForm({ name: s.name || '', email: s.email || '', phone: s.phone || '', address: s.address || '' })
    } catch {
      toast.error('Không tìm thấy trường')
      router.push('/admin/schools')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { fetchSchool() }, [fetchSchool])

  // Fetch tab data on tab change
  useEffect(() => {
    if (!id) return
    if (activeTab === 'users' && users.length === 0) {
      setUsersLoading(true)
      adminApi.getSchoolUsers(id, { limit: 50 })
        .then(res => setUsers(res.data.data || []))
        .catch(() => {})
        .finally(() => setUsersLoading(false))
    }
    if (activeTab === 'stats' && !stats) {
      setStatsLoading(true)
      adminApi.getSchoolStats(id)
        .then(res => setStats(res.data.data))
        .catch(() => {})
        .finally(() => setStatsLoading(false))
    }
    if (activeTab === 'activity' && activity.length === 0) {
      setActivityLoading(true)
      adminApi.getSchoolActivity(id, { limit: 50 })
        .then(res => setActivity(res.data.data || []))
        .catch(() => {})
        .finally(() => setActivityLoading(false))
    }
  }, [activeTab, id, users.length, stats, activity.length])

  const handleUpdate = async () => {
    try {
      await adminApi.updateSchool(id, editForm)
      toast.success('Đã cập nhật')
      setEditing(false)
      fetchSchool()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lỗi cập nhật')
    }
  }

  const handleToggleStatus = async () => {
    try {
      if (school.status === 'ACTIVE') {
        await adminApi.suspendSchool(id)
        toast.success('Đã tạm ngưng')
      } else {
        await adminApi.activateSchool(id)
        toast.success('Đã kích hoạt')
      }
      fetchSchool()
    } catch { toast.error('Lỗi thao tác') }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!school) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/schools" className="mt-1 p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusMap[school.status]?.cls}`}>
              {statusMap[school.status]?.label}
            </span>
          </div>
          <p className="text-gray-500 mt-1">Mã trường: <span className="font-mono">{school.code}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <Edit className="w-4 h-4" /> Sửa
          </button>
          <button onClick={handleToggleStatus} className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 ${school.status === 'ACTIVE' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
            {school.status === 'ACTIVE' ? <><Pause className="w-4 h-4" /> Tạm ngưng</> : <><Play className="w-4 h-4" /> Kích hoạt</>}
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tên trường</label>
              <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="label">SĐT</label>
              <input className="input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Địa chỉ</label>
              <input className="input" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
            <button onClick={handleUpdate} className="btn-primary text-sm">Lưu</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab school={school} />}
      {activeTab === 'users' && <UsersTab users={users} loading={usersLoading} />}
      {activeTab === 'stats' && <StatsTab stats={stats} loading={statsLoading} />}
      {activeTab === 'subscription' && <SubscriptionTab school={school} />}
      {activeTab === 'activity' && <ActivityTab activity={activity} loading={activityLoading} />}
    </div>
  )
}

function OverviewTab({ school }: { school: any }) {
  const info = [
    { icon: Mail, label: 'Email', value: school.email },
    { icon: Phone, label: 'SĐT', value: school.phone },
    { icon: MapPin, label: 'Địa chỉ', value: school.address },
    { icon: Calendar, label: 'Ngày tạo', value: formatDate(school.createdAt) },
  ]

  const counts = [
    { label: 'Người dùng', value: school._count?.users ?? 0, color: 'bg-blue-500' },
    { label: 'Học sinh', value: school._count?.students ?? 0, color: 'bg-green-500' },
    { label: 'Lớp học', value: school._count?.classes ?? 0, color: 'bg-purple-500' },
    { label: 'Môn học', value: school._count?.subjects ?? 0, color: 'bg-orange-500' },
  ]

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Thông tin trường</h3>
        {info.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <item.icon className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 w-20">{item.label}</span>
            <span className="text-sm text-gray-900">{item.value || '—'}</span>
          </div>
        ))}
        {school.usersByRole && (
          <div className="pt-3 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2">Phân bố vai trò</p>
            <div className="flex flex-wrap gap-2">
              {school.usersByRole.map((r: any) => (
                <span key={r.role} className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {getRoleLabel(r.role)}: {r._count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {counts.map(c => (
            <div key={c.label} className="card p-4">
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
            </div>
          ))}
        </div>
        {school.settings && (
          <div className="card p-4">
            <h4 className="font-medium text-gray-900 mb-2">Quy định</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">Tuổi tối thiểu:</span> <span className="font-medium">{school.settings.minAge}</span></div>
              <div><span className="text-gray-500">Tuổi tối đa:</span> <span className="font-medium">{school.settings.maxAge}</span></div>
              <div><span className="text-gray-500">Sĩ số tối đa:</span> <span className="font-medium">{school.settings.maxClassSize}</span></div>
              <div><span className="text-gray-500">Điểm đạt:</span> <span className="font-medium">{school.settings.passScore}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UsersTab({ users, loading }: { users: any[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="table-header">Họ tên</th>
            <th className="table-header">Email</th>
            <th className="table-header">Vai trò</th>
            <th className="table-header">Trạng thái</th>
            <th className="table-header">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={5} className="table-cell text-center text-gray-500">Không có dữ liệu</td></tr>
          ) : users.map(u => (
            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="table-cell font-medium">{u.fullName}</td>
              <td className="table-cell text-sm text-gray-600">{u.email}</td>
              <td className="table-cell">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{getRoleLabel(u.role)}</span>
              </td>
              <td className="table-cell">
                <span className={`text-xs px-2 py-0.5 rounded ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                </span>
              </td>
              <td className="table-cell text-sm text-gray-500">{formatDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatsTab({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  if (!stats) return <p className="text-gray-500 text-center py-8">Không có dữ liệu</p>

  const overview = [
    { label: 'Học sinh', value: stats.studentCount },
    { label: 'Giáo viên', value: stats.teacherCount },
    { label: 'Lớp học', value: stats.classCount },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {overview.map(o => (
          <div key={o.label} className="card p-4 text-center">
            <p className="text-sm text-gray-500">{o.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{o.value}</p>
          </div>
        ))}
      </div>

      {/* Score stats */}
      {stats.scoreStats && stats.scoreStats._count > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Thống kê điểm</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Tổng điểm</p>
              <p className="text-xl font-bold">{stats.scoreStats._count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ĐTB</p>
              <p className="text-xl font-bold">{stats.scoreStats._avg?.value?.toFixed(2) || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Thấp nhất</p>
              <p className="text-xl font-bold text-red-600">{stats.scoreStats._min?.value ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cao nhất</p>
              <p className="text-xl font-bold text-green-600">{stats.scoreStats._max?.value ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Grade distribution */}
      {stats.grades && stats.grades.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Phân bố theo khối</h3>
          <div className="space-y-3">
            {stats.grades.map((g: any) => {
              const totalStudents = g.classes.reduce((sum: number, c: any) => sum + (c._count?.students || 0), 0)
              return (
                <div key={g.id} className="flex items-center gap-4">
                  <span className="w-20 text-sm font-medium text-gray-700">{g.name}</span>
                  <div className="flex-1">
                    <div className="flex gap-2 text-xs text-gray-500 mb-1">
                      <span>{g.classes.length} lớp</span>
                      <span>•</span>
                      <span>{totalStudents} HS</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((totalStudents / Math.max(stats.studentCount, 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* User role distribution */}
      {stats.usersByRole && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Phân bố người dùng</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.usersByRole.map((r: any) => (
              <div key={r.role} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{r._count}</p>
                <p className="text-xs text-gray-500">{getRoleLabel(r.role)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SubscriptionTab({ school }: { school: any }) {
  return (
    <div className="card p-6">
      {school.plan ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">{school.plan.name}</h3>
          {school.plan.description && <p className="text-gray-600">{school.plan.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Giá</p>
              <p className="text-lg font-bold">{school.plan.price?.toLocaleString('vi-VN')} đ</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Giới hạn HS</p>
              <p className="text-lg font-bold">{school.plan.studentLimit}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Giới hạn GV</p>
              <p className="text-lg font-bold">{school.plan.teacherLimit}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Giới hạn lớp</p>
              <p className="text-lg font-bold">{school.plan.classLimit}</p>
            </div>
          </div>
          {school.plan.features && school.plan.features.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tính năng</p>
              <div className="flex flex-wrap gap-2">
                {school.plan.features.map((f: string, i: number) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Trường chưa có gói dịch vụ</p>
        </div>
      )}
    </div>
  )
}

function ActivityTab({ activity, loading }: { activity: any[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>

  return (
    <div className="card">
      {activity.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Chưa có hoạt động nào</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {activity.map(log => (
            <div key={log.id} className="px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{log.action}</span>
                  {log.entity && <span className="text-gray-500"> — {log.entity}</span>}
                </p>
                {log.details && <p className="text-xs text-gray-500 mt-0.5 truncate">{log.details}</p>}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
