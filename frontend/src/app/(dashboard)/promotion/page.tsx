'use client'

import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'

export default function PromotionPage() {
  return (
    <div className="card p-8 max-w-2xl">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-primary mt-0.5" />
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-gray-900">Xét lên lớp đã chuyển sang Báo cáo tổng kết</h1>
          <p className="text-sm text-gray-600">Vui lòng sử dụng mục Báo cáo tổng kết để xét lên lớp theo năm học.</p>
          <Link href="/reports" className="btn-primary inline-flex items-center">
            Mở báo cáo tổng kết
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  )
}
