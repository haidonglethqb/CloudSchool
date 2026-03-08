'use client'

import { useEffect, useState } from 'react'
import { monitoringApi } from '@/lib/api'
import {
  Activity, Server, Database, HardDrive, Loader2, RefreshCw,
  TrendingUp, Users, GraduationCap, Building2, Cpu, Clock,
} from 'lucide-react'

interface SystemStats {
  overview: {
    totalSchools: number
    activeSchools: number
    inactiveSchools: number
    suspendedSchools: number
    totalUsers: number
    totalStudents: number
    totalTeachers: number
    totalClasses: number
    totalStaff: number
  }
  charts: {
    schoolGrowth: Array<{ month: string; label: string; count: number }>
    studentGrowth: Array<{ month: string; label: string; count: number }>
  }
  topSchools: Array<{
    id: string; name: string; code: string; status: string
    plan: string | null; students: number; users: number; classes: number
  }>
  health: {
    database: { status: string; latencyMs: number }
    server: { status: string; uptime: number; memoryUsage: { rss: number; heapUsed: number; heapTotal: number } }
    timestamp: string
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export default function MonitoringPage() {
  const [data, setData] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await monitoringApi.systemStats()
      setData(res.data.data)
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!data) return <p className="text-center text-gray-500 py-8">Không thể tải dữ liệu</p>

  const { overview, charts, topSchools, health } = data

  const maxSchoolGrowth = Math.max(...charts.schoolGrowth.map(g => g.count), 1)
  const maxStudentGrowth = Math.max(...charts.studentGrowth.map(g => g.count), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giám sát hệ thống</h1>
          <p className="text-gray-600 mt-1">Theo dõi trạng thái và hiệu suất hệ thống</p>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      {/* Health Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${health.server.status === 'healthy' ? 'bg-green-100' : 'bg-red-100'}`}>
            <Server className={`w-6 h-6 ${health.server.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Server</p>
            <p className="font-semibold text-gray-900 capitalize">{health.server.status}</p>
            <p className="text-xs text-gray-400">Uptime: {formatUptime(health.server.uptime)}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${health.database.status === 'healthy' ? 'bg-green-100' : 'bg-red-100'}`}>
            <Database className={`w-6 h-6 ${health.database.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Database</p>
            <p className="font-semibold text-gray-900 capitalize">{health.database.status}</p>
            <p className="text-xs text-gray-400">Latency: {health.database.latencyMs}ms</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Cpu className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Memory</p>
            <p className="font-semibold text-gray-900">{formatBytes(health.server.memoryUsage.heapUsed)}</p>
            <p className="text-xs text-gray-400">/ {formatBytes(health.server.memoryUsage.heapTotal)} heap</p>
          </div>
        </div>
      </div>

      {/* System Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'Trường học', value: overview.totalSchools, icon: Building2, color: 'text-blue-600' },
          { label: 'Người dùng', value: overview.totalUsers, icon: Users, color: 'text-indigo-600' },
          { label: 'Học sinh', value: overview.totalStudents, icon: GraduationCap, color: 'text-green-600' },
          { label: 'Giáo viên', value: overview.totalTeachers, icon: Users, color: 'text-amber-600' },
          { label: 'Lớp học', value: overview.totalClasses, icon: Building2, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tăng trưởng trường học (12 tháng)</h3>
          <div className="flex items-end gap-1 h-48">
            {charts.schoolGrowth.map((g, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-600">{g.count}</span>
                <div className="w-full rounded-t" style={{
                  height: `${Math.max((g.count / maxSchoolGrowth) * 100, 4)}%`,
                  minHeight: '4px',
                  backgroundColor: '#3b82f6'
                }} />
                <span className="text-[10px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">{g.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tăng trưởng học sinh (12 tháng)</h3>
          <div className="flex items-end gap-1 h-48">
            {charts.studentGrowth.map((g, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-600">{g.count}</span>
                <div className="w-full rounded-t" style={{
                  height: `${Math.max((g.count / maxStudentGrowth) * 100, 4)}%`,
                  minHeight: '4px',
                  backgroundColor: '#22c55e'
                }} />
                <span className="text-[10px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Schools */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Top trường theo số học sinh</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">#</th>
                <th className="table-header">Trường</th>
                <th className="table-header">Mã</th>
                <th className="table-header">Gói</th>
                <th className="table-header text-center">Học sinh</th>
                <th className="table-header text-center">Users</th>
                <th className="table-header text-center">Lớp</th>
              </tr>
            </thead>
            <tbody>
              {topSchools.map((s, i) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell text-gray-500">{i + 1}</td>
                  <td className="table-cell font-medium text-gray-900">{s.name}</td>
                  <td className="table-cell text-sm font-mono">{s.code}</td>
                  <td className="table-cell text-sm">{s.plan || '—'}</td>
                  <td className="table-cell text-center font-semibold">{s.students}</td>
                  <td className="table-cell text-center">{s.users}</td>
                  <td className="table-cell text-center">{s.classes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-right">
        Cập nhật lúc: {new Date(health.timestamp).toLocaleString('vi-VN')}
      </p>
    </div>
  )
}
