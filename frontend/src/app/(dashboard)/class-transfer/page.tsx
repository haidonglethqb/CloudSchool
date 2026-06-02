'use client'

import { useEffect, useState } from 'react'
import { classApi, studentApi } from '@/lib/api'
import { Loader2, ArrowRightLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface ClassItem {
  id: string
  name: string
  grade?: { name: string }
}

interface StudentItem {
  id: string
  fullName: string
  studentCode: string
  class?: { id: string; name: string } | null
}

interface TransferHistoryItem {
  id: string
  reason: string | null
  createdAt: string
  transferredBy?: string | null
  student?: { fullName: string; studentCode: string } | null
  fromClass?: { name: string } | null
  toClass?: { name: string } | null
  transferredByUser?: { fullName: string; email?: string } | null
}

export default function ClassTransferPage() {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])
  const [studentId, setStudentId] = useState('')
  const [targetClassId, setTargetClassId] = useState('')
  const [reason, setReason] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [history, setHistory] = useState<TransferHistoryItem[]>([])

  const selectedStudent = students.find((s) => s.id === studentId)

  const fetchData = async () => {
    try {
      const [classRes, studentRes, historyRes] = await Promise.all([
        classApi.list(),
        studentApi.list({ limit: 200 }),
        studentApi.getAllTransferHistory(),
      ])
      setClasses(classRes.data.data || [])
      setStudents(studentRes.data.data || [])
      setHistory(historyRes.data.data || [])
    } catch {
      toast.error('Không thể tải dữ liệu chuyển lớp')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedReason = reason.trim()
    if (!studentId || !targetClassId) {
      toast.error('Vui lòng chọn học sinh và lớp đích')
      return
    }
    if (!trimmedReason) {
      toast.error('Vui lòng nhập lý do chuyển lớp')
      return
    }

    try {
      setTransferring(true)
      await studentApi.transfer(studentId, { classId: targetClassId, reason: trimmedReason })
      toast.success('Chuyển lớp thành công')
      setReason('')
      setTargetClassId('')
      await fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Chuyển lớp thất bại')
    } finally {
      setTransferring(false)
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chuyển lớp</h1>
        <p className="text-sm text-gray-600 mt-1">Thực hiện chuyển lớp theo học sinh</p>
      </div>

      <form onSubmit={submitTransfer} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Học sinh</label>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Chọn học sinh</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.studentCode} - {student.fullName} {student.class?.name ? `(${student.class.name})` : '(Chưa có lớp)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Lớp đích</label>
          <select className="input" value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
            <option value="">Chọn lớp đích</option>
            {classes
              .filter((cls) => cls.id !== selectedStudent?.class?.id)
              .map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}{cls.grade?.name ? ` (${cls.grade.name})` : ''}</option>
              ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Lý do chuyển <span className="text-red-500">*</span></label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do chuyển lớp"
            required
          />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={transferring} className="btn-primary">
            {transferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
            Chuyển lớp
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Lịch sử chuyển lớp</h2>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Chưa có dữ liệu</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Học sinh</th>
                  <th className="table-header">Lớp cũ</th>
                  <th className="table-header">Lớp đích</th>
                  <th className="table-header">Thời gian</th>
                  <th className="table-header">Lý do chuyển</th>
                  <th className="table-header">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{item.student?.fullName || '-'}</div>
                      <div className="text-xs text-gray-500">{item.student?.studentCode || ''}</div>
                    </td>
                    <td className="table-cell">{item.fromClass?.name || '-'}</td>
                    <td className="table-cell">{item.toClass?.name || '-'}</td>
                    <td className="table-cell">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="table-cell">{item.reason || '-'}</td>
                    <td className="table-cell">{item.transferredByUser?.fullName || item.transferredBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
