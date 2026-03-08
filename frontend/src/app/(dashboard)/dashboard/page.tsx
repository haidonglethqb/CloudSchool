'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { reportApi, adminApi, classApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { formatDate } from '@/lib/utils'
import {
  Users,
  GraduationCap,
  BookOpen,
  Building2,
  UserPlus,
  TrendingUp,
  ArrowRight,
  Loader2,
  User,
  School,
  CreditCard,
  Shield,
  ClipboardList,
  Activity,
} from 'lucide-react'

/* ============================== Types ============================== */
interface SchoolDashboardData {
  stats: {
    totalStudents: number
    totalClasses: number
    totalSubjects: number
    maxClassSize: number
  }
  activeSemester: { id: string; name: string; year: number; term: number } | null
  recentStudents: Array<{
    id: string; fullName: string; studentCode: string; createdAt: string
    class: { name: string } | null
  }>
  gradeStats: Array<{ grade: string; level: number; classCount: number; studentCount: number }>
}

interface PlatformDashboardData {
  totalSchools: number
  activeSchools: number
  inactiveSchools: number
  suspendedSchools: number
  totalUsers: number
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  totalPlans: number
  schoolGrowth: Array<{ month: string; count: number }>
  studentGrowth: Array<{ month: string; count: number }>
}


interface TeacherClass {
  id: string
  class: { id: string; name: string; grade: { name: string } }
  subject: { id: string; name: string } | null
  isHomeroom: boolean
}

/* =================== Platform Admin Dashboard =================== */
function PlatformAdminDashboard() {
  const [data, setData] = useState<PlatformDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.dashboard()
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const stats = [
    { label: 'Tổng trường học', value: data?.totalSchools || 0, icon: School, color: 'bg-blue-500', href: '/admin/schools' },
    { label: 'Đang hoạt động', value: data?.activeSchools || 0, icon: Building2, color: 'bg-green-500', href: '/admin/schools' },
    { label: 'Tạm ngưng', value: data?.suspendedSchools || 0, icon: Shield, color: 'bg-red-500', href: '/admin/schools' },
    { label: 'Gói dịch vụ', value: data?.totalPlans || 0, icon: CreditCard, color: 'bg-purple-500', href: '/admin/subscriptions' },
  ]

  const secondaryStats = [
    { label: 'Tổng người dùng', value: data?.totalUsers || 0, icon: Users, color: 'bg-indigo-500' },
    { label: 'Tổng học sinh', value: data?.totalStudents || 0, icon: GraduationCap, color: 'bg-cyan-500' },
    { label: 'Tổng giáo viên', value: data?.totalTeachers || 0, icon: User, color: 'bg-amber-500' },
    { label: 'Tổng lớp học', value: data?.totalClasses || 0, icon: BookOpen, color: 'bg-emerald-500' },
  ]

  const maxSchoolGrowth = Math.max(...(data?.schoolGrowth?.map(g => g.count) || [1]), 1)
  const maxStudentGrowth = Math.max(...(data?.studentGrowth?.map(g => g.count) || [1]), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
          <p className="text-gray-600 mt-1">Tổng quan hệ thống CloudSchool</p>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryStats.map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 ${s.color} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* School Growth Chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tăng trưởng trường học (6 tháng)</h3>
          <div className="relative h-44">
            {[0, 25, 50, 75, 100].map(p => (
              <div key={p} className="absolute left-0 right-0 border-t border-dashed border-gray-100" style={{ bottom: `${p}%` }} />
            ))}
            <div className="relative flex items-end gap-2 h-full">
              {data?.schoolGrowth?.map((g, i) => {
                const pct = maxSchoolGrowth > 0 ? (g.count / maxSchoolGrowth) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <span className={`text-xs font-semibold mb-1 ${g.count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{g.count}</span>
                    <div
                      className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: g.count > 0 ? `${Math.max(pct, 10)}%` : '3px',
                        background: g.count > 0 ? 'linear-gradient(to top, #3b82f6, #60a5fa)' : '#e5e7eb',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {data?.schoolGrowth?.map((g, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-xs text-gray-500">{g.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Student Growth Chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tăng trưởng học sinh (6 tháng)</h3>
          <div className="relative h-44">
            {[0, 25, 50, 75, 100].map(p => (
              <div key={p} className="absolute left-0 right-0 border-t border-dashed border-gray-100" style={{ bottom: `${p}%` }} />
            ))}
            <div className="relative flex items-end gap-2 h-full">
              {data?.studentGrowth?.map((g, i) => {
                const pct = maxStudentGrowth > 0 ? (g.count / maxStudentGrowth) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <span className={`text-xs font-semibold mb-1 ${g.count > 0 ? 'text-green-600' : 'text-gray-300'}`}>{g.count}</span>
                    <div
                      className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: g.count > 0 ? `${Math.max(pct, 10)}%` : '3px',
                        background: g.count > 0 ? 'linear-gradient(to top, #22c55e, #4ade80)' : '#e5e7eb',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {data?.studentGrowth?.map((g, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-xs text-gray-500">{g.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ====================== Parent Dashboard ====================== */
function ParentDashboard() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/my-children')
  }, [router])
  return <LoadingSpinner />
}

/* ===================== Student Dashboard ===================== */
function StudentDashboard() {
  const { user } = useAuthStore()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xin chào, {user?.fullName}!</h1>
        <p className="text-gray-600 mt-1">Cổng thông tin học sinh</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/my-scores" className="card p-6 hover:shadow-md transition-shadow">
          <BookOpen className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-semibold text-gray-900">Xem điểm</h3>
          <p className="text-sm text-gray-500 mt-1">Xem bảng điểm các môn học</p>
        </Link>
        <Link href="/my-scores" className="card p-6 hover:shadow-md transition-shadow">
          <ClipboardList className="w-8 h-8 text-green-500 mb-3" />
          <h3 className="font-semibold text-gray-900">Kết quả học tập</h3>
          <p className="text-sm text-gray-500 mt-1">Xem tổng kết và xếp hạng</p>
        </Link>
      </div>
    </div>
  )
}

/* ===================== Teacher Dashboard ===================== */
function TeacherDashboard() {
  const { user } = useAuthStore()
  const [assignments, setAssignments] = useState<TeacherClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    classApi.list()
      .then(res => {
        const classes = res.data.data || []
        // Transform class data to show teacher's assignments  
        const mapped = classes.map((c: any) => ({
          id: c.id,
          class: { id: c.id, name: c.name, grade: c.grade || { name: '' } },
          subject: null,
          isHomeroom: false,
        }))
        setAssignments(mapped)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xin chào, {user?.fullName}!</h1>
        <p className="text-gray-600 mt-1">Bảng điều khiển giáo viên</p>
      </div>

      <div className="card p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-white/80">Lớp được phân công</p>
            <p className="text-3xl font-bold">{assignments.length}</p>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900">Lớp học của bạn</h2>
      {assignments.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa được phân công lớp</h3>
          <p className="text-gray-500">Vui lòng liên hệ quản trị viên.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(a => (
            <Link key={a.id} href={`/classes/${a.class.id}`}
              className="card p-4 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">{a.class.name}</h3>
              <p className="text-sm text-gray-500">{a.class.grade?.name}</p>
              {a.subject && <p className="text-sm text-primary mt-1">{a.subject.name}</p>}
              {a.isHomeroom && (
                <span className="inline-block mt-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Chủ nhiệm</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/* ======================= Loading Spinner ======================= */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

/* =================== Main Dashboard (School Admin/Staff) =================== */
export default function DashboardPage() {
  const { user } = useAuthStore()
  const [data, setData] = useState<SchoolDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const role = user?.role

  useEffect(() => {
    if (role === 'PLATFORM_ADMIN' || role === 'PARENT' || role === 'STUDENT' || role === 'TEACHER') {
      setLoading(false)
      return
    }
    reportApi.dashboard()
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [role])

  if (role === 'PLATFORM_ADMIN') return <PlatformAdminDashboard />
  if (role === 'PARENT') return <ParentDashboard />
  if (role === 'STUDENT') return <StudentDashboard />
  if (role === 'TEACHER') return <TeacherDashboard />

  if (loading) return <LoadingSpinner />

  const stats = [
    { label: 'Tổng học sinh', value: data?.stats.totalStudents || 0, icon: Users, color: 'bg-blue-500', href: '/students' },
    { label: 'Số lớp học', value: data?.stats.totalClasses || 0, icon: Building2, color: 'bg-green-500', href: '/classes' },
    { label: 'Môn học', value: data?.stats.totalSubjects || 0, icon: BookOpen, color: 'bg-purple-500', href: '/subjects' },
    { label: 'Sĩ số tối đa/lớp', value: data?.stats.maxClassSize || 0, icon: GraduationCap, color: 'bg-orange-500', href: '/settings' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xin chào, {user?.fullName}!</h1>
          <p className="text-gray-600 mt-1">{user?.tenant?.name || 'Tổng quan hệ thống'}</p>
        </div>
        {(role === 'SUPER_ADMIN' || role === 'STAFF') && (
          <Link href="/students/new" className="btn-primary">
            <UserPlus className="w-4 h-4 mr-2" />
            Tiếp nhận học sinh
          </Link>
        )}
      </div>

      {data?.activeSemester && (
        <div className="card p-4 bg-gradient-to-r from-primary to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-white/80">Học kỳ hiện tại</p>
              <p className="font-semibold">{data.activeSemester.name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Phân bố theo khối</h2>
          </div>
          <div className="p-4">
            {data?.gradeStats && data.gradeStats.length > 0 ? (
              <div className="space-y-4">
                {data.gradeStats.map(g => (
                  <div key={g.level} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-gray-700">{g.grade}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <span>{g.classCount} lớp</span>
                        <span className="text-gray-400">•</span>
                        <span>{g.studentCount} học sinh</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min((g.studentCount / (data?.stats.totalStudents || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Chưa có dữ liệu phân bố</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Học sinh mới nhất</h2>
            <Link href="/students" className="text-sm text-primary hover:underline flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.recentStudents && data.recentStudents.length > 0 ? (
              data.recentStudents.map(s => (
                <Link key={s.id} href={`/students/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {s.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{s.fullName}</p>
                    <p className="text-xs text-gray-500">{s.studentCode} • {s.class?.name || 'Chưa xếp lớp'}</p>
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(s.createdAt)}</div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">Chưa có học sinh nào</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
