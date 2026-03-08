'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { useEffect, useState, useMemo } from 'react'
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Search,
  ClipboardEdit,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
  Menu,
  X,
  UserCheck,
  BookOpen,
  Building2,
  CreditCard,
  Shield,
  Layers,
  ArrowUpDown,
  Activity,
  FileText,
  Download,
} from 'lucide-react'

// Platform Admin menu
const platformAdminMenu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/admin/schools', icon: Building2, label: 'Quản lý trường' },
  { href: '/admin/subscriptions', icon: CreditCard, label: 'Gói đăng ký' },
  { href: '/admin/monitoring', icon: Activity, label: 'Giám sát hệ thống' },
  { href: '/admin/activity-logs', icon: FileText, label: 'Nhật ký hoạt động' },
]

// School Admin (SUPER_ADMIN) menu
const superAdminMenu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/users', icon: Shield, label: 'Quản lý người dùng' },
  { href: '/students/new', icon: UserPlus, label: 'Tiếp nhận HS' },
  { href: '/students', icon: Search, label: 'Tra cứu HS' },
  { href: '/classes', icon: Users, label: 'Danh sách lớp' },
  { href: '/subjects', icon: BookOpen, label: 'Môn học' },
  { href: '/scores', icon: ClipboardEdit, label: 'Nhập điểm' },
  { href: '/promotion', icon: ArrowUpDown, label: 'Xét lên lớp' },
  { href: '/reports', icon: BarChart3, label: 'Báo cáo' },
  { href: '/parents', icon: UserCheck, label: 'Quản lý Phụ huynh' },
  { href: '/fees', icon: CreditCard, label: 'Quản lý học phí' },
  { href: '/settings', icon: Settings, label: 'Quy định' },
  { href: '/settings/permissions', icon: Layers, label: 'Phân quyền' },
]

// Staff menu
const staffMenu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/students/new', icon: UserPlus, label: 'Tiếp nhận HS' },
  { href: '/students', icon: Search, label: 'Tra cứu HS' },
  { href: '/classes', icon: Users, label: 'Danh sách lớp' },
  { href: '/subjects', icon: BookOpen, label: 'Môn học' },
  { href: '/scores', icon: ClipboardEdit, label: 'Nhập điểm' },
  { href: '/reports', icon: BarChart3, label: 'Báo cáo' },
  { href: '/parents', icon: UserCheck, label: 'Quản lý Phụ huynh' },
  { href: '/fees', icon: CreditCard, label: 'Quản lý học phí' },
]

// Teacher menu
const teacherMenu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/classes', icon: Users, label: 'Lớp của tôi' },
  { href: '/students', icon: Search, label: 'Tra cứu HS' },
  { href: '/scores', icon: ClipboardEdit, label: 'Nhập điểm' },
  { href: '/reports', icon: BarChart3, label: 'Báo cáo' },
]

// Student menu
const studentMenu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/my-scores', icon: BookOpen, label: 'Xem điểm' },
]

// Parent menu
const parentMenu = [
  { href: '/my-children', icon: GraduationCap, label: 'Con em của tôi' },
  { href: '/my-children/fees', icon: CreditCard, label: 'Học phí' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Get menu items based on user role
  const menuItems = useMemo(() => {
    switch (user?.role) {
      case 'PLATFORM_ADMIN':
        return platformAdminMenu
      case 'SUPER_ADMIN':
        return superAdminMenu
      case 'STAFF':
        return staffMenu
      case 'TEACHER':
        return teacherMenu
      case 'STUDENT':
        return studentMenu
      case 'PARENT':
        return parentMenu
      default:
        return []
    }
  }, [user?.role])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push('/login')
    }
  }, [mounted, isAuthenticated, router])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-light flex-shrink-0">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">CloudSchool</h1>
              <p className="text-gray-400 text-xs truncate max-w-[140px]">
                {user?.tenant?.name || 'Quản lý học sinh'}
              </p>
            </div>
            <button
              className="ml-auto lg:hidden text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const isExact = pathname === item.href
              const isPrefix = item.href !== '/dashboard' && pathname.startsWith(item.href + '/')
              const matches = isExact || isPrefix
              // Only highlight this item if no other menu item is a more specific match
              const hasBetterMatch = matches && menuItems.some(
                (other) => other.href !== item.href && other.href.length > item.href.length &&
                  (pathname === other.href || pathname.startsWith(other.href + '/'))
              )
              const isActive = matches && !hasBetterMatch
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('sidebar-item', isActive && 'active')}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User info & Logout */}
          <div className="p-4 border-t border-sidebar-light flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {user?.fullName}
                </p>
                <p className="text-gray-400 text-xs truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-sidebar-light rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-gray-900">CloudSchool</h1>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
