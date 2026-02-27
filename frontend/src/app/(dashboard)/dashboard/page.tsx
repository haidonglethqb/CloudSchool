'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { reportApi } from '@/lib/api'
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
  ChevronRight,
} from 'lucide-react'

interface DashboardData {
  stats: {
    totalStudents: number
    totalClasses: number
    totalSubjects: number
    maxClassSize: number
  }
  activeSemester: {
    id: string
    name: string
    year: number
    term: number
  } | null
  recentStudents: Array<{
    id: string
    fullName: string
    studentCode: string
    createdAt: string
    class: { name: string } | null
  }>
  gradeStats: Array<{
    grade: string
    level: number
    classCount: number
    studentCount: number
  }>
}

interface ParentChild {
  id: string
  studentCode: string
  fullName: string
  class: { name: string; grade: string } | null
}

// Parent Dashboard Component
function ParentDashboard() {
  const { user, token } = useAuthStore()
  const [children, setChildren] = useState<ParentChild[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parents/my-children`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.data) {
          setChildren(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch children:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchChildren()
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Xin chào, {user?.fullName}!
        </h1>
        <p className="text-gray-600 mt-1">
          Cổng thông tin phụ huynh - {user?.tenant?.name}
        </p>
      </div>

      <div className="card p-6 bg-gradient-to-r from-primary to-primary-600 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-white/80">Số học sinh liên kết</p>
            <p className="text-3xl font-bold">{children.length}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Học sinh của bạn</h2>
        {children.length === 0 ? (
          <div className="card p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có học sinh liên kết</h3>
            <p className="text-gray-500">Vui lòng liên hệ nhà trường để liên kết tài khoản.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/my-children/${child.id}/scores`}
                className="card p-4 flex items-center gap-4 hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{child.fullName}</h3>
                  <p className="text-sm text-gray-500">
                    {child.studentCode} - Lớp {child.class?.name || 'Chưa xếp lớp'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium hidden sm:inline">Xem điểm</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Admin/Teacher Dashboard Component
export default function DashboardPage() {
  const { user, token } = useAuthStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const isParent = user?.role === 'PARENT'

  useEffect(() => {
    // Only fetch dashboard data for non-parents
    if (isParent) {
      setLoading(false)
      return
    }
    
    const fetchData = async () => {
      try {
        const response = await reportApi.dashboard()
        setData(response.data.data)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isParent])

  // If user is a parent, show parent dashboard
  if (isParent) {
    return <ParentDashboard />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const stats = [
    {
      label: 'Tổng học sinh',
      value: data?.stats.totalStudents || 0,
      icon: Users,
      color: 'bg-blue-500',
      href: '/students',
    },
    {
      label: 'Số lớp học',
      value: data?.stats.totalClasses || 0,
      icon: Building2,
      color: 'bg-green-500',
      href: '/classes',
    },
    {
      label: 'Môn học',
      value: data?.stats.totalSubjects || 0,
      icon: BookOpen,
      color: 'bg-purple-500',
      href: '/settings',
    },
    {
      label: 'Sĩ số tối đa/lớp',
      value: data?.stats.maxClassSize || 0,
      icon: GraduationCap,
      color: 'bg-orange-500',
      href: '/settings',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Xin chào, {user?.fullName}!
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.tenant?.name || 'Tổng quan hệ thống quản lý học sinh'}
          </p>
        </div>
        <Link href="/students/new" className="btn-primary">
          <UserPlus className="w-4 h-4 mr-2" />
          Tiếp nhận học sinh
        </Link>
      </div>

      {/* Active Semester Banner */}
      {data?.activeSemester && (
        <div className="card p-4 bg-gradient-to-r from-primary to-primary-600 text-white">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Grade Distribution & Recent Students */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Phân bố theo khối</h2>
          </div>
          <div className="p-4">
            {data?.gradeStats && data.gradeStats.length > 0 ? (
              <div className="space-y-4">
                {data.gradeStats.map((grade) => (
                  <div key={grade.level} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-gray-700">
                      {grade.grade}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <span>{grade.classCount} lớp</span>
                        <span className="text-gray-400">•</span>
                        <span>{grade.studentCount} học sinh</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min((grade.studentCount / (data?.stats.totalStudents || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Chưa có dữ liệu phân bố
              </p>
            )}
          </div>
        </div>

        {/* Recent Students */}
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Học sinh mới nhất</h2>
            <Link
              href="/students"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.recentStudents && data.recentStudents.length > 0 ? (
              data.recentStudents.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary font-medium">
                    {student.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {student.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {student.studentCode} • {student.class?.name || 'Chưa xếp lớp'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(student.createdAt)}
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                Chưa có học sinh nào
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
