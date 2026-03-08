'use client'

import { useState, useEffect } from 'react'
import { parentApi } from '@/lib/api'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Users, BookOpen, GraduationCap, Loader2 } from 'lucide-react'

interface Child {
  id: string
  studentCode: string
  fullName: string
  gender: string
  dateOfBirth: string
  class: {
    id: string
    name: string
    grade: string
  } | null
  relationship: string
  isPrimary: boolean
}

export default function MyChildrenPage() {
  const { user } = useAuthStore()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    parentApi.getMyChildren()
      .then(res => setChildren(res.data?.data || []))
      .catch(err => console.error('Failed to fetch children:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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
        <p className="text-gray-500 mt-1">Theo dõi thông tin và kết quả học tập của con em</p>
      </div>

      {children.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có học sinh liên kết</h3>
          <p className="text-gray-500">Vui lòng liên hệ nhà trường để liên kết tài khoản với học sinh.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <div
              key={child.id}
              className="card flex flex-col overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 flex items-center gap-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-lg truncate">{child.fullName}</h3>
                  <p className="text-sm text-gray-500">{child.studentCode}</p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lớp</span>
                  <span className="font-medium text-gray-900">{child.class?.name || 'Chưa xếp lớp'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Khối</span>
                  <span className="font-medium text-gray-900">{child.class?.grade || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Giới tính</span>
                  <span className="font-medium text-gray-900">{child.gender === 'MALE' ? 'Nam' : 'Nữ'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quan hệ</span>
                  <span className="font-medium text-gray-900">
                    {child.relationship === 'PARENT' ? 'Phụ huynh' :
                     child.relationship === 'GUARDIAN' ? 'Người giám hộ' : 'Khác'}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 pb-5">
                <Link
                  href={`/my-children/${child.id}/scores`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  Xem điểm
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
