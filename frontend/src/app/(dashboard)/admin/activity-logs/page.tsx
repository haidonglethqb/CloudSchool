'use client'

import { useEffect, useState, useCallback } from 'react'
import { monitoringApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { FileText, Loader2, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

interface ActivityLog {
  id: string
  action: string
  entity: string
  entityId: string | null
  details: string | null
  userId: string | null
  tenantId: string | null
  tenant: { name: string; code: string } | null
  createdAt: string
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-purple-100 text-purple-700',
  LOGIN: 'bg-gray-100 text-gray-700',
  LOCK: 'bg-orange-100 text-orange-700',
  UNLOCK: 'bg-yellow-100 text-yellow-700',
}

function getActionColor(action: string) {
  for (const [key, cls] of Object.entries(actionColors)) {
    if (action.toUpperCase().includes(key)) return cls
  }
  return 'bg-gray-100 text-gray-600'
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await monitoringApi.activityLogs({
        page,
        limit: 30,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
      })
      setLogs(res.data.data || [])
      setTotalPages(res.data.meta?.totalPages || 1)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, entityFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nhật ký hoạt động</h1>
        <p className="text-gray-600 mt-1">Theo dõi hoạt động trên toàn hệ thống</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input pl-10" placeholder="Lọc theo hành động..."
            value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }} />
        </div>
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input pl-10" placeholder="Lọc theo đối tượng (Student, Score...)"
            value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1) }} />
        </div>
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Không có hoạt động nào</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {logs.map(log => (
            <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                  {log.entity && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{log.entity}</span>
                  )}
                  {log.tenant && (
                    <span className="text-xs text-blue-600">{log.tenant.name}</span>
                  )}
                </div>
                {log.details && (
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">{log.details}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{formatDate(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">Trang {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
