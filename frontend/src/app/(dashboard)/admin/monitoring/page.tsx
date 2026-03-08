'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { monitoringApi } from '@/lib/api'
import {
  Server, Database, Loader2, RefreshCw,
  Users, GraduationCap, Building2, Cpu, MemoryStick,
  Activity, Gauge, HardDrive, Wifi, WifiOff,
} from 'lucide-react'

interface HealthData {
  server: {
    status: string
    uptime: number
    nodeVersion: string
    platform: string
    hostname: string
    pid: number
  }
  cpu: {
    model: string
    cores: number
    usagePercent: number
    loadAvg: { '1m': number; '5m': number; '15m': number }
  }
  memory: {
    system: { total: number; used: number; free: number; usagePercent: number }
    process: { rss: number; heapUsed: number; heapTotal: number; external: number }
  }
  database: {
    status: string
    latencyMs: number
    version: string
    tables: number
    activeConnections: number
  }
  timestamp: string
}

interface SystemStats {
  overview: {
    totalSchools: number
    activeSchools: number
    totalUsers: number
    totalStudents: number
    totalTeachers: number
    totalClasses: number
  }
  charts: {
    schoolGrowth: Array<{ month: string; label: string; count: number }>
    studentGrowth: Array<{ month: string; label: string; count: number }>
  }
  topSchools: Array<{
    id: string; name: string; code: string; status: string
    plan: string | null; students: number; users: number; classes: number
  }>
  health: HealthData
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
      healthy ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
    }`} />
  )
}

function UsageBar({ percent, color }: { percent: number; color: string }) {
  const capped = Math.min(percent, 100)
  const barColor = capped > 90 ? 'bg-red-500' : capped > 70 ? 'bg-yellow-500' : color
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${capped}%` }} />
    </div>
  )
}

const AUTO_REFRESH_INTERVAL = 10000

export default function MonitoringPage() {
  const [data, setData] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await monitoringApi.systemStats()
      setData(res.data.data)
      setLastFetched(new Date())
      setIsOnline(true)
    } catch {
      setIsOnline(false)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchData(false), AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchData])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!data) return <p className="text-center text-gray-500 py-8">Không thể tải dữ liệu</p>

  const { overview, charts, topSchools, health } = data
  const maxSchoolGrowth = Math.max(...charts.schoolGrowth.map(g => g.count), 1)
  const maxStudentGrowth = Math.max(...charts.studentGrowth.map(g => g.count), 1)

  const serverHealthy = health.server.status === 'healthy'
  const dbHealthy = health.database.status === 'healthy'
  const memPercent = health.memory.system.usagePercent
  const cpuPercent = health.cpu.usagePercent

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giám sát hệ thống</h1>
          <p className="text-gray-600 mt-1">Theo dõi trạng thái và hiệu suất hệ thống</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isOnline ? 'Kết nối' : 'Mất kết nối'}
            </span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">Tự động (10s)</span>
          </label>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
      </div>

      {/* === REAL-TIME HEALTH CARDS === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className={`w-5 h-5 ${serverHealthy ? 'text-green-600' : 'text-red-600'}`} />
              <span className="font-semibold text-gray-900">Server</span>
            </div>
            <StatusDot healthy={serverHealthy} />
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Trạng thái</span>
              <span className={`font-medium ${serverHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {serverHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Uptime</span>
              <span className="font-mono text-gray-900">{formatUptime(health.server.uptime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Node.js</span>
              <span className="text-gray-700">{health.server.nodeVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">PID</span>
              <span className="font-mono text-gray-700">{health.server.pid}</span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className={`w-5 h-5 ${dbHealthy ? 'text-green-600' : 'text-red-600'}`} />
              <span className="font-semibold text-gray-900">Database</span>
            </div>
            <StatusDot healthy={dbHealthy} />
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Trạng thái</span>
              <span className={`font-medium ${dbHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {dbHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Latency</span>
              <span className="font-mono text-gray-900">{health.database.latencyMs}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Kết nối</span>
              <span className="text-gray-700">{health.database.activeConnections} active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bảng</span>
              <span className="text-gray-700">{health.database.tables}</span>
            </div>
          </div>
        </div>

        {/* CPU */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">CPU</span>
            </div>
            <span className="text-lg font-bold text-gray-900">{cpuPercent}%</span>
          </div>
          <UsageBar percent={cpuPercent} color="bg-blue-500" />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Cores</span>
              <span className="text-gray-700">{health.cpu.cores}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Load (1m/5m/15m)</span>
              <span className="font-mono text-xs text-gray-700">
                {health.cpu.loadAvg['1m']} / {health.cpu.loadAvg['5m']} / {health.cpu.loadAvg['15m']}
              </span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryStick className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-gray-900">Memory</span>
            </div>
            <span className="text-lg font-bold text-gray-900">{memPercent}%</span>
          </div>
          <UsageBar percent={memPercent} color="bg-purple-500" />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sử dụng</span>
              <span className="text-gray-700">{formatBytes(health.memory.system.used)} / {formatBytes(health.memory.system.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Node Heap</span>
              <span className="font-mono text-xs text-gray-700">
                {formatBytes(health.memory.process.heapUsed)} / {formatBytes(health.memory.process.heapTotal)}
              </span>
            </div>
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
        <div className="card p-6 overflow-hidden">
          <h3 className="font-semibold text-gray-900 mb-4">Tăng trưởng trường học (12 tháng)</h3>
          <div className="relative h-52 pl-6">
            {[0, 25, 50, 75, 100].map(p => (
              <div key={p} className="absolute left-6 right-0 border-t border-dashed border-gray-100" style={{ bottom: `${p}%` }} />
            ))}
            <span className="absolute left-0 top-0 text-[10px] text-gray-400">{maxSchoolGrowth}</span>
            <span className="absolute left-0 bottom-0 text-[10px] text-gray-400">0</span>
            <div className="relative flex items-end gap-1 h-full">
              {charts.schoolGrowth.map((g, i) => {
                const pct = maxSchoolGrowth > 0 ? (g.count / maxSchoolGrowth) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <span className={`text-[10px] font-semibold mb-1 ${g.count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{g.count}</span>
                    <div
                      className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: g.count > 0 ? `${Math.max(pct, 8)}%` : '3px',
                        background: g.count > 0 ? 'linear-gradient(to top, #3b82f6, #60a5fa)' : '#e5e7eb',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-1 mt-2 pl-6">
            {charts.schoolGrowth.map((g, i) => (
              <div key={i} className="flex-1 text-center"><span className="text-[10px] text-gray-500">{g.label}</span></div>
            ))}
          </div>
        </div>

        <div className="card p-6 overflow-hidden">
          <h3 className="font-semibold text-gray-900 mb-4">Tăng trưởng học sinh (12 tháng)</h3>
          <div className="relative h-52 pl-6">
            {[0, 25, 50, 75, 100].map(p => (
              <div key={p} className="absolute left-6 right-0 border-t border-dashed border-gray-100" style={{ bottom: `${p}%` }} />
            ))}
            <span className="absolute left-0 top-0 text-[10px] text-gray-400">{maxStudentGrowth}</span>
            <span className="absolute left-0 bottom-0 text-[10px] text-gray-400">0</span>
            <div className="relative flex items-end gap-1 h-full">
              {charts.studentGrowth.map((g, i) => {
                const pct = maxStudentGrowth > 0 ? (g.count / maxStudentGrowth) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <span className={`text-[10px] font-semibold mb-1 ${g.count > 0 ? 'text-green-600' : 'text-gray-300'}`}>{g.count}</span>
                    <div
                      className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: g.count > 0 ? `${Math.max(pct, 8)}%` : '3px',
                        background: g.count > 0 ? 'linear-gradient(to top, #22c55e, #4ade80)' : '#e5e7eb',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-1 mt-2 pl-6">
            {charts.studentGrowth.map((g, i) => (
              <div key={i} className="flex-1 text-center"><span className="text-[10px] text-gray-500">{g.label}</span></div>
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

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Platform: {health.server.platform}</span>
          <span>Host: {health.server.hostname}</span>
          {health.database.version && (
            <span>DB: {health.database.version.split(' ').slice(0, 2).join(' ')}</span>
          )}
        </div>
        <div>
          {lastFetched && (
            <span>Cập nhật lúc: {lastFetched.toLocaleTimeString('vi-VN')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
