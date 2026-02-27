'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'
import { Users, BookOpen, GraduationCap } from 'lucide-react'

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
  const { token } = useAuthStore()
  const [children, setChildren] = useState<Child[]>([])
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
      } catch (err) {
        console.error('Failed to fetch children:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchChildren()
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Học sinh của tôi</h1>
        <p className="text-gray-500 mt-1">Danh sách con em được liên kết với tài khoản của bạn</p>
      </div>

      {children.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có học sinh liên kết</h3>
          <p className="text-gray-500">Vui lòng liên hệ nhà trường để liên kết tài khoản với học sinh.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <div
              key={child.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-lg">{child.fullName}</h3>
                  <p className="text-sm text-gray-500">{child.studentCode}</p>
                  {child.isPrimary && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                      Liên hệ chính
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lớp:</span>
                  <span className="font-medium">{child.class?.name || 'Chưa xếp lớp'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Khối:</span>
                  <span className="font-medium">{child.class?.grade || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Giới tính:</span>
                  <span className="font-medium">{child.gender === 'MALE' ? 'Nam' : 'Nữ'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quan hệ:</span>
                  <span className="font-medium">
                    {child.relationship === 'PARENT' ? 'Phụ huynh' : 
                     child.relationship === 'GUARDIAN' ? 'Người giám hộ' : 'Khác'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/my-children/${child.id}/scores`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
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
