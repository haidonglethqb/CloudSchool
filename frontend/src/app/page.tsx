'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import {
  GraduationCap,
  Users,
  BookOpen,
  BarChart3,
  Shield,
  Globe,
  ChevronRight,
  Check,
  ArrowRight,
  School,
  Settings,
  Layers,
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [mounted, isAuthenticated, router])

  if (!mounted) return null
  if (isAuthenticated) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">CloudSchool</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Tính năng
              </a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Cách hoạt động
              </a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Bảng giá
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Đăng nhập
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-700 transition-colors">
                Dùng thử miễn phí
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/10 rounded-full text-sm text-primary mb-8">
            <Globe className="w-4 h-4" />
            Nền tảng SaaS Multi-Tenant cho Giáo dục
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight max-w-4xl mx-auto">
            Quản lý trường học{' '}
            <span className="text-primary">thông minh</span>{' '}
            trên nền tảng đám mây
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            CloudSchool giúp các trường THPT quản lý học sinh, điểm số, lớp học và báo cáo
            một cách hiệu quả. Mỗi trường có không gian riêng biệt, bảo mật tuyệt đối.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-primary rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-primary/25">
              Đăng ký trường học
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
              Đăng nhập
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Dùng thử demo: Mã trường <code className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">THPT-DEMO</code>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Trường đăng ký', value: '100+' },
            { label: 'Học sinh quản lý', value: '50,000+' },
            { label: 'Điểm số nhập/năm', value: '1M+' },
            { label: 'Uptime', value: '99.9%' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Tất cả tính năng bạn cần</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Từ tiếp nhận học sinh đến báo cáo tổng kết, CloudSchool đáp ứng toàn bộ quy trình quản lý trường học.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Users, title: 'Quản lý học sinh', description: 'Tiếp nhận, tra cứu và quản lý thông tin học sinh theo khối và lớp. Kiểm tra tuổi tự động theo quy định.', tag: 'BM1 & BM3' },
              { icon: School, title: 'Quản lý lớp học', description: 'Lập danh sách lớp theo khối, theo dõi sĩ số, kiểm soát số lượng tối đa theo quy định.', tag: 'BM2' },
              { icon: BookOpen, title: 'Nhập điểm môn học', description: 'Nhập điểm 15 phút, 1 tiết, cuối kỳ. Tính trung bình theo hệ số tùy chỉnh. Kiểm tra 0-10.', tag: 'BM4' },
              { icon: BarChart3, title: 'Báo cáo tổng kết', description: 'Báo cáo tổng kết môn học và học kỳ. Tỉ lệ đạt/không đạt theo lớp, thống kê trực quan.', tag: 'BM5' },
              { icon: Settings, title: 'Tùy chỉnh quy định', description: 'Cấu hình độ tuổi cho phép, sĩ số tối đa, điểm đạt, hệ số điểm, môn học và học kỳ.', tag: 'QD1-QD6' },
              { icon: Shield, title: 'Tài khoản phụ huynh', description: 'Phụ huynh đăng nhập xem điểm con em. Liên kết nhiều học sinh, bảo mật theo trường.', tag: 'Parent Portal' },
            ].map((feature) => (
              <div key={feature.title} className="group relative p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:border-primary/20 transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md mb-3">{feature.tag}</span>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Bắt đầu trong 3 bước</h2>
            <p className="mt-4 text-lg text-gray-600">Triển khai hệ thống quản lý trường học chỉ trong vài phút</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Đăng ký trường', description: 'Tạo tài khoản admin với tên trường và mã trường duy nhất.' },
              { step: '2', title: 'Cấu hình hệ thống', description: 'Thiết lập khối, lớp, môn học, học kỳ và các quy định riêng.' },
              { step: '3', title: 'Bắt đầu sử dụng', description: 'Tiếp nhận học sinh, nhập điểm, tạo báo cáo và mời phụ huynh.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-primary/25">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Tenant */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full text-sm text-primary mb-6">
                <Layers className="w-4 h-4" />
                Multi-Tenant Architecture
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Mỗi trường, một không gian riêng biệt</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Kiến trúc multi-tenant đảm bảo dữ liệu của mỗi trường được cách ly hoàn toàn.
                Trường A không thể truy cập dữ liệu trường B. Mỗi trường tùy chỉnh quy định, môn học, hệ số điểm theo nhu cầu riêng.
              </p>
              <ul className="space-y-3">
                {[
                  'Dữ liệu cách ly hoàn toàn theo trường',
                  'Mỗi trường có mã tenant code riêng',
                  'Tùy chỉnh quy định và cấu hình độc lập',
                  'Phân quyền 4 vai trò: Admin, Giáo viên, Phụ huynh, Super Admin',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-gray-700 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/10">
              <div className="space-y-4">
                {[
                  { name: 'THPT Nguyễn Trãi', code: 'NT-HS', students: 1250, classes: 36 },
                  { name: 'THPT Lê Quý Đôn', code: 'LQD-HS', students: 890, classes: 27 },
                  { name: 'THPT Demo', code: 'THPT-DEMO', students: 120, classes: 9 },
                ].map((school) => (
                  <div key={school.code} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <School className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{school.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{school.code}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{school.students} HS</p>
                        <p>{school.classes} lớp</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Bảng giá đơn giản</h2>
            <p className="mt-4 text-lg text-gray-600">Chọn gói phù hợp với quy mô trường học của bạn</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Miễn phí', price: '0', unit: 'đ/mãi mãi', description: 'Dùng thử đầy đủ tính năng', features: ['Tối đa 200 học sinh', 'Tối đa 10 lớp', 'Quản lý điểm & báo cáo', 'Tài khoản phụ huynh', 'Email hỗ trợ'], cta: 'Bắt đầu miễn phí', highlighted: false },
              { name: 'Chuyên nghiệp', price: '500K', unit: 'đ/tháng', description: 'Cho trường quy mô trung bình', features: ['Tối đa 2,000 học sinh', 'Không giới hạn lớp', 'Tất cả tính năng miễn phí', 'Export PDF/Excel', 'Hỗ trợ ưu tiên 24/7', 'Backup hàng ngày'], cta: 'Dùng thử 14 ngày', highlighted: true },
              { name: 'Enterprise', price: 'Liên hệ', unit: '', description: 'Cho hệ thống trường lớn', features: ['Không giới hạn học sinh', 'Không giới hạn lớp', 'Tất cả tính năng Pro', 'API tích hợp', 'Dedicated support', 'Custom deployment'], cta: 'Liên hệ tư vấn', highlighted: false },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl p-8 ${plan.highlighted ? 'bg-primary text-white shadow-xl shadow-primary/25 scale-105' : 'bg-white border border-gray-200'}`}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full">
                    Phổ biến nhất
                  </div>
                )}
                <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                  {plan.unit && <span className={plan.highlighted ? 'text-white/70' : 'text-gray-500'}>{plan.unit}</span>}
                </div>
                <p className={`mt-2 text-sm ${plan.highlighted ? 'text-white/80' : 'text-gray-500'}`}>{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-white' : 'text-primary'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-white/90' : 'text-gray-600'}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-8 block w-full text-center py-3 rounded-xl font-medium text-sm transition-all ${plan.highlighted ? 'bg-white text-primary hover:bg-gray-100' : 'bg-primary text-white hover:bg-blue-700'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Sẵn sàng chuyển đổi số trường học?</h2>
          <p className="text-lg text-gray-600 mb-8">Đăng ký ngay hôm nay và trải nghiệm hệ thống quản lý trường học hiện đại nhất.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-primary rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-primary/25">
              Đăng ký miễn phí
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-gray-700 hover:text-gray-900 transition-colors">
              Dùng thử demo
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">CloudSchool</span>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} CloudSchool. Nền tảng quản lý trường học SaaS.
          </p>
        </div>
      </footer>
    </div>
  )
}
