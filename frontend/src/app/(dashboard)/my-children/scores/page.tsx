'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'
import { BookOpen, User, ChevronRight } from 'lucide-react'

interface Child {
  id: string
  studentCode: string
  fullName: string
  class: { name: string; grade: string } | null
}

export default function MyChildrenScoresPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Xem điểm</h1>
        <p className="text-gray-500 mt-1">Chọn học sinh để xem bảng điểm chi tiết</p>
      </div>

      {children.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có học sinh liên kết</h3>
          <p className="text-gray-500">Vui lòng liên hệ nhà trường để liên kết tài khoản với học sinh.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/my-children/${child.id}/scores`}
              className="block bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-primary/20 transition-all"
            >
              <div className="flex items-center gap-4">
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
                  <span className="font-medium">Xem điểm</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
