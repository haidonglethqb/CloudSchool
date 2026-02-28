'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import {
  GraduationCap,
  Users,
  BookOpen,
  BarChart3,
  Shield,
  ChevronRight,
  Check,
  ArrowRight,
  School,
  Settings,
  Layers,
  Sparkles,
  Zap,
  Star,
} from 'lucide-react'

// Scroll-triggered visibility using getBoundingClientRect (reliable cross-browser)
// `ready` must be true (i.e. mounted) for the effect to run — ensures ref is attached
function useInView(offset = 100, ready = true) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!ready) return
    const el = ref.current
    if (!el) return
    let triggered = false
    const check = () => {
      if (triggered) return
      if (el.getBoundingClientRect().top < window.innerHeight - offset) {
        triggered = true
        setIsVisible(true)
      }
    }
    check() // check immediately — catches elements already in viewport
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [ready, offset]) // re-runs when ready flips false→true (after mount)

  return { ref, isVisible }
}

// Animated number counter, starts when scrolled into view
function AnimatedCounter({ target }: { target: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState('0')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      if (started) return
      if (el.getBoundingClientRect().top < window.innerHeight - 50) setStarted(true)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [started])

  useEffect(() => {
    if (!started) return
    const num = parseInt(target.replace(/[^0-9]/g, ''))
    if (isNaN(num)) { setDisplay(target); return }
    const suffix = target.replace(/[0-9]/g, '')
    const steps = 40
    let step = 0
    const timer = setInterval(() => {
      step++
      const current = Math.min(Math.round((num / steps) * step), num)
      setDisplay(current.toLocaleString('vi-VN') + suffix)
      if (step >= steps) clearInterval(timer)
    }, 1500 / steps)
    return () => clearInterval(timer)
  }, [started, target])

  return <span ref={ref}>{display}</span>
}

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const features = useInView(100, mounted)
  const howItWorks = useInView(100, mounted)
  const multiTenant = useInView(100, mounted)
  const pricing = useInView(100, mounted)
  const cta = useInView(100, mounted)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [mounted, isAuthenticated, router])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])



  if (!mounted) return null
  if (isAuthenticated) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-white border-b border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">CloudSchool</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              {[
                { href: '#features', label: 'Tính năng' },
                { href: '#how-it-works', label: 'Cách hoạt động' },
                { href: '#pricing', label: 'Bảng giá' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="relative text-sm text-gray-600 hover:text-primary transition-colors py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary rounded-lg hover:bg-primary/5 transition-all duration-200"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="group relative px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="relative z-10">Dùng thử miễn phí</span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <span className={`block h-0.5 bg-gray-600 transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                  <span className={`block h-0.5 bg-gray-600 transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                  <span className={`block h-0.5 bg-gray-600 transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-64 border-t border-gray-100' : 'max-h-0'}`}>
          <div className="bg-white/95 backdrop-blur-md px-4 py-4 space-y-2">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">Tính năng</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">Cách hoạt động</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">Bảng giá</a>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">Đăng nhập</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-20 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-40 -right-32 w-96 h-96 bg-blue-400/5 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-400/5 rounded-full blur-3xl animate-blob animation-delay-4000" />

        <div className="max-w-7xl mx-auto text-center animate-hero-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/10 rounded-full text-sm text-primary mb-8 animate-fade-in hover:bg-primary/10 hover:border-primary/20 transition-colors cursor-default group">
            <Sparkles className="w-4 h-4 group-hover:animate-spin-slow" />
            Nền tảng SaaS Multi-Tenant cho Giáo dục
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight max-w-4xl mx-auto">
            Quản lý trường học{' '}
            <span className="text-primary relative">
              thông minh
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M1 5.5Q50 1 100 5.5T199 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
              </svg>
            </span>{' '}
            trên nền tảng đám mây
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            CloudSchool giúp các trường THPT quản lý học sinh, điểm số, lớp học và báo cáo
            một cách hiệu quả. Mỗi trường có không gian riêng biệt, bảo mật tuyệt đối.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-primary rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 hover:bg-blue-600 active:translate-y-0 active:shadow-md"
            >
              Đăng ký trường học
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-gray-700 bg-gray-100 rounded-xl transition-all duration-300 hover:bg-gray-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              Đăng nhập
              <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Dùng thử demo: Mã trường <code className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono hover:bg-primary/10 hover:text-primary transition-colors cursor-help" title="Sử dụng mã này khi đăng nhập">THPT-DEMO</code>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Trường đăng ký', value: '100+' },
            { label: 'Học sinh quản lý', value: '50,000+' },
            { label: 'Điểm số nhập/năm', value: '1,000,000+' },
            { label: 'Uptime', value: '99.9%' },
          ].map((stat) => (
            <div key={stat.label} className="group cursor-default">
              <p className="text-3xl font-bold text-primary transition-transform duration-300 group-hover:scale-110">
                <AnimatedCounter target={stat.value} />
              </p>
              <p className="mt-1 text-sm text-gray-500 transition-colors group-hover:text-gray-700">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" ref={features.ref} className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${features.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl font-bold text-gray-900">Tất cả tính năng bạn cần</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Từ tiếp nhận học sinh đến báo cáo tổng kết, CloudSchool đáp ứng toàn bộ quy trình quản lý trường học.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Users, title: 'Quản lý học sinh', description: 'Tiếp nhận, tra cứu và quản lý thông tin học sinh theo khối và lớp. Kiểm tra tuổi tự động theo quy định.', tag: 'BM1 & BM3', color: 'blue' },
              { icon: School, title: 'Quản lý lớp học', description: 'Lập danh sách lớp theo khối, theo dõi sĩ số, kiểm soát số lượng tối đa theo quy định.', tag: 'BM2', color: 'purple' },
              { icon: BookOpen, title: 'Nhập điểm môn học', description: 'Nhập điểm 15 phút, 1 tiết, cuối kỳ. Tính trung bình theo hệ số tùy chỉnh. Kiểm tra 0-10.', tag: 'BM4', color: 'green' },
              { icon: BarChart3, title: 'Báo cáo tổng kết', description: 'Báo cáo tổng kết môn học và học kỳ. Tỉ lệ đạt/không đạt theo lớp, thống kê trực quan.', tag: 'BM5', color: 'orange' },
              { icon: Settings, title: 'Tùy chỉnh quy định', description: 'Cấu hình độ tuổi cho phép, sĩ số tối đa, điểm đạt, hệ số điểm, môn học và học kỳ.', tag: 'QD1-QD6', color: 'rose' },
              { icon: Shield, title: 'Tài khoản phụ huynh', description: 'Phụ huynh đăng nhập xem điểm con em. Liên kết nhiều học sinh, bảo mật theo trường.', tag: 'Parent Portal', color: 'teal' },
            ].map((feature, i) => (
              <div
                key={feature.title}
                style={{ transitionDelay: `${150 + i * 80}ms` }}
                className={`group relative p-6 bg-white border border-gray-100 rounded-2xl transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-2 cursor-default ${features.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.02] to-primary/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-primary/25">
                    <feature.icon className="w-6 h-6 text-primary transition-colors duration-300 group-hover:text-white" />
                  </div>
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md mb-3 transition-colors group-hover:bg-primary/10 group-hover:text-primary">{feature.tag}</span>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 transition-colors group-hover:text-primary">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" ref={howItWorks.ref} className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${howItWorks.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl font-bold text-gray-900">Bắt đầu trong 3 bước</h2>
            <p className="mt-4 text-lg text-gray-600">Triển khai hệ thống quản lý trường học chỉ trong vài phút</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-7 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            {[
              { step: '1', title: 'Đăng ký trường', description: 'Tạo tài khoản admin với tên trường và mã trường duy nhất.', link: '/register' },
              { step: '2', title: 'Cấu hình hệ thống', description: 'Thiết lập khối, lớp, môn học, học kỳ và các quy định riêng.', link: null },
              { step: '3', title: 'Bắt đầu sử dụng', description: 'Tiếp nhận học sinh, nhập điểm, tạo báo cáo và mời phụ huynh.', link: null },
            ].map((item, i) => (
              <div
                key={item.step}
                style={{ transitionDelay: `${i * 150}ms` }}
                className={`text-center relative transition-all duration-700 ${howItWorks.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className="group cursor-default">
                  <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-primary/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-xl group-hover:shadow-primary/30 relative z-10">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 transition-colors group-hover:text-primary">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                  {item.link && (
                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 mt-3 text-sm text-primary font-medium hover:gap-2 transition-all duration-200"
                    >
                      Bắt đầu ngay <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Tenant */}
      <section ref={multiTenant.ref} className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className={`transition-all duration-700 ${multiTenant.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full text-sm text-primary mb-6 hover:bg-primary/10 transition-colors cursor-default">
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
                ].map((item, i) => (
                  <li
                    key={item}
                    style={{ transitionDelay: `${300 + i * 80}ms` }}
                    className={`flex items-start gap-3 group transition-all duration-500 ${multiTenant.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}
                  >
                    <div className="mt-0.5 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-green-500 group-hover:scale-110">
                      <Check className="w-3 h-3 text-green-600 transition-colors group-hover:text-white" />
                    </div>
                    <span className="text-gray-700 text-sm group-hover:text-gray-900 transition-colors">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/10 transition-all duration-700 delay-200 ${multiTenant.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
              <div className="space-y-4">
                {[
                  { name: 'THPT Nguyễn Trãi', code: 'NT-HS', students: 1250, classes: 36 },
                  { name: 'THPT Lê Quý Đôn', code: 'LQD-HS', students: 890, classes: 27 },
                  { name: 'THPT Demo', code: 'THPT-DEMO', students: 120, classes: 9 },
                ].map((school, i) => (
                  <div
                    key={school.code}
                    style={{ transitionDelay: `${350 + i * 100}ms` }}
                    className={`bg-white rounded-xl p-4 shadow-sm transition-all duration-500 hover:shadow-md hover:-translate-y-1 hover:border-primary/20 border border-transparent cursor-default group ${multiTenant.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-primary group-hover:rotate-6">
                          <School className="w-5 h-5 text-primary transition-colors group-hover:text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm group-hover:text-primary transition-colors">{school.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{school.code}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p className="transition-colors group-hover:text-primary">{school.students} HS</p>
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
      <section id="pricing" ref={pricing.ref} className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${pricing.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl font-bold text-gray-900">Bảng giá đơn giản</h2>
            <p className="mt-4 text-lg text-gray-600">Chọn gói phù hợp với quy mô trường học của bạn</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Miễn phí', price: '0', unit: 'đ/mãi mãi', description: 'Dùng thử đầy đủ tính năng', features: ['Tối đa 200 học sinh', 'Tối đa 10 lớp', 'Quản lý điểm & báo cáo', 'Tài khoản phụ huynh', 'Email hỗ trợ'], cta: 'Bắt đầu miễn phí', highlighted: false },
              { name: 'Chuyên nghiệp', price: '500K', unit: 'đ/tháng', description: 'Cho trường quy mô trung bình', features: ['Tối đa 2,000 học sinh', 'Không giới hạn lớp', 'Tất cả tính năng miễn phí', 'Export PDF/Excel', 'Hỗ trợ ưu tiên 24/7', 'Backup hàng ngày'], cta: 'Dùng thử 14 ngày', highlighted: true },
              { name: 'Enterprise', price: 'Liên hệ', unit: '', description: 'Cho hệ thống trường lớn', features: ['Không giới hạn học sinh', 'Không giới hạn lớp', 'Tất cả tính năng Pro', 'API tích hợp', 'Dedicated support', 'Custom deployment'], cta: 'Liên hệ tư vấn', highlighted: false },
            ].map((plan, i) => (
              <div
                key={plan.name}
                style={{ transitionDelay: `${i * 120}ms` }}
                className={`group relative rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 ${plan.highlighted
                  ? 'bg-primary text-white shadow-xl shadow-primary/25 scale-105 hover:shadow-2xl hover:shadow-primary/30'
                  : 'bg-white border border-gray-200 hover:shadow-xl hover:border-primary/20'
                } ${pricing.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full flex items-center gap-1 shadow-lg animate-bounce-subtle">
                    <Star className="w-3 h-3" />
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
                    <li key={feature} className="flex items-start gap-2 group/item">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-transform duration-200 group-hover/item:scale-125 ${plan.highlighted ? 'text-white' : 'text-primary'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-white/90' : 'text-gray-600'}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-8 block w-full text-center py-3 rounded-xl font-medium text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${plan.highlighted
                    ? 'bg-white text-primary hover:bg-gray-50 hover:shadow-white/20'
                    : 'bg-primary text-white hover:bg-blue-600 hover:shadow-primary/25'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section ref={cta.ref} className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02]" />
        <div className={`max-w-4xl mx-auto text-center relative transition-all duration-700 ${cta.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full text-sm text-primary mb-6">
            <Zap className="w-4 h-4" />
            Bắt đầu ngay hôm nay
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Sẵn sàng chuyển đổi số trường học?</h2>
          <p className="text-lg text-gray-600 mb-8">Đăng ký ngay hôm nay và trải nghiệm hệ thống quản lý trường học hiện đại nhất.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-primary rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 hover:bg-blue-600 active:translate-y-0"
            >
              Đăng ký miễn phí
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-gray-700 hover:text-primary transition-all duration-300 rounded-xl hover:bg-primary/5"
            >
              Dùng thử demo
              <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 group-hover:text-primary transition-colors">CloudSchool</span>
            </Link>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-500 hover:text-primary transition-colors">Tính năng</a>
              <a href="#pricing" className="text-sm text-gray-500 hover:text-primary transition-colors">Bảng giá</a>
              <Link href="/login" className="text-sm text-gray-500 hover:text-primary transition-colors">Đăng nhập</Link>
              <Link href="/register" className="text-sm text-gray-500 hover:text-primary transition-colors">Đăng ký</Link>
            </div>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} CloudSchool. Nền tảng quản lý trường học SaaS.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
