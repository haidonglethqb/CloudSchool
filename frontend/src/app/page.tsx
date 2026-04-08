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
  ChevronDown,
  Check,
  ArrowRight,
  School,
  Settings,
  Layers,
  Sparkles,
  Zap,
  Star,
  Building2,
  MessageSquareQuote,
  Play,
  Mail,
  Phone,
  Globe,
  Award,
  TrendingUp,
} from 'lucide-react'

// ==================== HOOKS ====================

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
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [ready, offset])

  return { ref, isVisible }
}

function useScrollReveal(options = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(el)
      }
    }, options)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// ==================== COMPONENTS ====================

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

function TestimonialCard({ quote, name, role, school }: {
  quote: string; name: string; role: string; school: string
}) {
  return (
    <div className="flex-shrink-0 w-80 sm:w-96 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 cursor-default">
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-gray-600 text-sm leading-relaxed mb-6">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {name.split(' ').pop()?.[0]}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{name}</p>
          <p className="text-xs text-gray-500">{role}, {school}</p>
        </div>
      </div>
    </div>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/80 transition-colors"
      >
        <span className="font-medium text-gray-900 pr-4 text-sm">{question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <p className="px-5 pb-5 text-gray-500 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

function CSSDashboardMockup() {
  return (
    <div className="w-full max-w-lg mx-auto bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl shadow-blue-500/10 overflow-hidden animate-float">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700/50">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        <div className="ml-3 flex-1 h-6 bg-gray-800 rounded-md" />
      </div>
      <div className="flex">
        <div className="w-16 sm:w-48 py-4 px-2 border-r border-gray-700/30 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`h-8 rounded-lg ${i === 0 ? 'bg-blue-500/20' : 'bg-gray-800'}`} />
          ))}
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-xl border border-gray-700/30" />
            ))}
          </div>
          <div className="h-32 bg-gray-800 rounded-xl border border-gray-700/30 p-3 flex items-end gap-2">
            {[40, 65, 50, 80, 55, 90, 70, 60, 75, 85].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-cyan-400 opacity-80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== DATA ====================

const testimonials = [
  {
    quote: "CloudSchool đã giúp chúng tôi tiết kiệm 70% thời gian quản lý điểm số. Giao diện trực quan, dễ sử dụng cho cả giáo viên lớn tuổi.",
    name: "Nguyễn Văn Hùng",
    role: "Hiệu trưởng",
    school: "THPT Nguyễn Trãi"
  },
  {
    quote: "Phụ huynh rất hài lòng vì có thể theo dõi kết quả học tập của con em theo thời gian thực. Tỷ lệ tương tác tăng gấp 3 lần.",
    name: "Trần Thị Mai",
    role: "Phó Hiệu trưởng",
    school: "THPT Lê Quý Đôn"
  },
  {
    quote: "Hệ thống multi-tenant giúp Sở GD&ĐT quản lý đồng bộ 12 trường mà không lo rò rỉ dữ liệu chéo giữa các trường.",
    name: "Lê Minh Tuấn",
    role: "Chuyên viên CNTT",
    school: "Sở GD&ĐT"
  },
  {
    quote: "Triển khai chỉ trong 2 ngày, không cần cài đặt phần mềm. Giáo viên ai cũng dùng được ngay từ đầu.",
    name: "Phạm Thị Hương",
    role: "Tổ trưởng CM",
    school: "THPT Marie Curie"
  },
  {
    quote: "Báo cáo trực quan giúp họp hội đồng sư phạm nhanh hơn. Số liệu chính xác, cập nhật real-time.",
    name: "Đỗ Quang Minh",
    role: "Hiệu phó",
    school: "THPT Chu Văn An"
  },
  {
    quote: "Trước đây dùng Excel rất mất thời gian. Từ khi có CloudSchool, mọi thứ tự động hóa gần như hoàn toàn.",
    name: "Hoàng Thị Lan",
    role: "GVCN",
    school: "THPT Võ Trường Toản"
  },
]

const schoolNames = [
  'THPT Nguyễn Trãi', 'THPT Lê Quý Đôn', 'THPT Chuyên Hà Nội',
  'THPT Marie Curie', 'THPT Chu Văn An', 'THPT Võ Trường Toản',
  'THPT Lương Thế Vinh', 'THPT Nguyễn Huệ'
]

const faqs = [
  { q: "CloudSchool có cần cài đặt phần mềm không?", a: "Không. CloudSchool là nền tảng SaaS chạy hoàn toàn trên nền tảng đám mây. Chỉ cần trình duyệt web là có thể sử dụng được ngay trên mọi thiết bị." },
  { q: "Dữ liệu của trường tôi có bảo mật không?", a: "Tuyệt đối bảo mật. Kiến trúc multi-tenant cách ly hoàn toàn dữ liệu giữa các trường. Hệ thống sử dụng mã hóa JWT, bcrypt và tuân thủ tiêu chuẩn bảo mật quốc tế." },
  { q: "Tôi có thể dùng thử trước khi mua không?", a: "Có! Gói Miễn phí cho phép tối đa 200 học sinh với đầy đủ tính năng. Gói Chuyên nghiệp có 14 ngày dùng thử miễn phí, không cần thẻ tín dụng." },
  { q: "Phụ huynh có cần trả phí để xem điểm không?", a: "Không. Tài khoản phụ huynh hoàn toàn miễn phí, được tạo tự động khi nhà trường thêm thông tin học sinh vào hệ thống." },
  { q: "Hệ thống có hỗ trợ mobile không?", a: "Có. CloudSchool tương thích hoàn toàn với điện thoại, máy tính bảng. Phụ huynh và giáo viên có thể sử dụng mọi tính năng trên mobile." },
  { q: "Tôi có thể xuất báo cáo ra Excel/PDF không?", a: "Gói Chuyên nghiệp và Enterprise hỗ trợ xuất báo cáo đa định dạng (Excel, PDF, CSV). Gói Miễn phí hỗ trợ xem trực tuyến." },
]

// ==================== MAIN PAGE ====================

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const statsSection = useScrollReveal()
  const features = useInView(100, mounted)
  const howItWorks = useInView(100, mounted)
  const multiTenant = useInView(100, mounted)
  const trustedBy = useScrollReveal()
  const testimonialsSection = useScrollReveal()
  const pricing = useInView(100, mounted)
  const faqSection = useScrollReveal()
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
      {/* ==================== NAVIGATION ==================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-gray-200/50 border-b border-gray-100'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className={`text-xl font-bold transition-colors duration-300 group-hover:text-primary ${scrolled ? 'text-gray-900' : 'text-white'}`}>CloudSchool</span>
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
                  className={`relative text-sm transition-colors py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 hover:after:w-full hover:text-primary ${
                    scrolled ? 'text-gray-600' : 'text-white/80'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className={`hidden sm:inline-flex px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:text-primary ${
                  scrolled ? 'text-gray-700 hover:bg-primary/5' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="group relative px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="relative z-10">Dùng thử miễn phí</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <span className={`block h-0.5 transition-all duration-300 ${scrolled ? 'bg-gray-600' : 'bg-white'} ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                  <span className={`block h-0.5 transition-all duration-300 ${scrolled ? 'bg-gray-600' : 'bg-white'} ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                  <span className={`block h-0.5 transition-all duration-300 ${scrolled ? 'bg-gray-600' : 'bg-white'} ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-64 border-t border-white/10' : 'max-h-0'}`}>
          <div className="bg-gray-950/95 backdrop-blur-md px-4 py-4 space-y-2">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Tính năng</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Cách hoạt động</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Bảng giá</a>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Đăng nhập</Link>
          </div>
        </div>
      </nav>

      {/* ==================== HERO — Dark Enhanced ==================== */}
      <section className="relative min-h-screen flex items-center pt-16 pb-24 px-4 overflow-hidden bg-[#070B14]">
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff07_1px,transparent_1px),linear-gradient(to_bottom,#ffffff07_1px,transparent_1px)] bg-[size:64px_64px]" />
        {/* Radial glow top */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,#1d4ed830,transparent)]" />
        {/* Blobs */}
        <div className="absolute top-1/4 -left-48 w-[700px] h-[700px] bg-blue-700/10 rounded-full blur-[130px] animate-blob" />
        <div className="absolute top-1/3 -right-48 w-[600px] h-[600px] bg-cyan-500/8 rounded-full blur-[110px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[900px] h-[200px] bg-indigo-600/8 rounded-full blur-[80px] animate-blob animation-delay-4000" />
        {/* Floating particles */}
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="particle animate-float"
            style={{
              top: `${10 + (i * 47) % 80}%`,
              left: `${5 + (i * 31) % 90}%`,
              width: `${2 + (i % 3) * 2}px`,
              height: `${2 + (i % 3) * 2}px`,
              opacity: 0.15 + (i % 4) * 0.08,
              animationDelay: `${(i * 0.4) % 6}s`,
              animationDuration: `${5 + (i % 3) * 2}s`,
            }}
          />
        ))}

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="text-center animate-hero-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-blue-300 mb-8 border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm hover:border-blue-400/40 hover:bg-blue-500/10 transition-all cursor-default group">
              <Sparkles className="w-4 h-4 text-blue-400 group-hover:animate-spin-slow" />
              Nền tảng SaaS Multi-Tenant cho Giáo dục
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-1" />
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold leading-tight max-w-5xl mx-auto text-white">
              Quản lý trường học{' '}
              <span className="relative bg-gradient-to-r from-blue-400 via-cyan-300 via-blue-500 to-purple-400 bg-clip-text text-transparent animate-gradient-x">
                thông minh
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none" aria-hidden="true">
                  <path d="M1 5.5Q50 1 100 5.5T199 5.5" strokeWidth="2" strokeLinecap="round" stroke="url(#heroGrad)" />
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#60a5fa" />
                      <stop offset="1" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <br className="hidden sm:block" />{' '}
              trên nền tảng đám mây
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed">
              CloudSchool giúp các trường THPT quản lý học sinh, điểm số, lớp học và báo cáo
              một cách hiệu quả. Mỗi trường có không gian riêng biệt, bảo mật tuyệt đối.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="group w-full sm:w-auto relative inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-blue-600 to-blue-500"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Đăng ký trường học
                  <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/login"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white/75 border border-white/15 rounded-xl transition-all duration-300 hover:bg-white/10 hover:border-white/30 hover:text-white hover:-translate-y-0.5 backdrop-blur-sm active:translate-y-0"
              >
                Đăng nhập
                <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center justify-center gap-8 text-sm text-white/35">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['🏫', '📚', '🎓', '👨‍🏫', '👩‍🎓'].map((emoji, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 border-2 border-[#070B14] flex items-center justify-center text-xs">
                      {emoji}
                    </div>
                  ))}
                </div>
                <span>100+ trường đã đăng ký</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
                <span>4.9/5</span>
              </div>
            </div>

            {/* Dashboard Mockup */}
            <div className="mt-16">
              <CSSDashboardMockup />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      </section>

      {/* ==================== STATS Enhanced ==================== */}
      <section ref={statsSection.ref} className={`py-16 bg-gradient-to-b from-white to-gray-50/50 border-b border-gray-100 bg-dot-pattern transition-all duration-700 ${statsSection.isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Trường đăng ký', value: '100+', icon: School },
            { label: 'Học sinh quản lý', value: '50,000+', icon: Users },
            { label: 'Điểm số nhập/năm', value: '1,000,000+', icon: BookOpen },
            { label: 'Uptime', value: '99.9%', icon: TrendingUp },
          ].map((stat) => (
            <div key={stat.label} className="group p-6 rounded-2xl hover:bg-white/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default text-center">
              <stat.icon className="w-6 h-6 text-primary/60 mx-auto mb-3 group-hover:text-primary transition-colors" />
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent transition-transform duration-300 group-hover:scale-110">
                <AnimatedCounter target={stat.value} />
              </p>
              <p className="mt-1 text-sm text-gray-500 transition-colors group-hover:text-gray-700">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== TRUSTED BY Marquee ==================== */}
      <section ref={trustedBy.ref} className={`py-16 bg-white border-y border-gray-100 overflow-hidden transition-all duration-700 ${trustedBy.isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm text-gray-400 mb-8 uppercase tracking-wider font-medium">
            Được tin tưởng bởi các trường hàng đầu
          </p>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex animate-marquee gap-12 items-center">
            {[...schoolNames, ...schoolNames].map((name, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-gray-600 transition-colors cursor-default">
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-semibold whitespace-nowrap">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FEATURES Enhanced ==================== */}
      <section id="features" ref={features.ref} className="py-24 px-4 bg-white bg-dot-pattern">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${features.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4 uppercase tracking-wider">Tính năng</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Tất cả tính năng bạn cần</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Từ tiếp nhận học sinh đến báo cáo tổng kết, CloudSchool đáp ứng toàn bộ quy trình quản lý trường học.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Quản lý học sinh', description: 'Tiếp nhận, tra cứu và quản lý thông tin học sinh theo khối và lớp. Kiểm tra tuổi tự động theo quy định.', tag: 'BM1 & BM3', gradient: 'from-blue-500 to-blue-600', iconCls: 'bg-blue-50 text-blue-600', tagCls: 'bg-blue-50 text-blue-600' },
              { icon: School, title: 'Quản lý lớp học', description: 'Lập danh sách lớp theo khối, theo dõi sĩ số, kiểm soát số lượng tối đa theo quy định.', tag: 'BM2', gradient: 'from-violet-500 to-purple-600', iconCls: 'bg-violet-50 text-violet-600', tagCls: 'bg-violet-50 text-violet-600' },
              { icon: BookOpen, title: 'Nhập điểm môn học', description: 'Nhập điểm 15 phút, 1 tiết, cuối kỳ. Tính trung bình theo hệ số tùy chỉnh. Kiểm tra 0-10.', tag: 'BM4', gradient: 'from-emerald-500 to-green-600', iconCls: 'bg-emerald-50 text-emerald-600', tagCls: 'bg-emerald-50 text-emerald-600' },
              { icon: BarChart3, title: 'Báo cáo tổng kết', description: 'Báo cáo tổng kết môn học và học kỳ. Tỉ lệ đạt/không đạt theo lớp, thống kê trực quan.', tag: 'BM5', gradient: 'from-orange-500 to-amber-500', iconCls: 'bg-orange-50 text-orange-600', tagCls: 'bg-orange-50 text-orange-600' },
              { icon: Settings, title: 'Tùy chỉnh quy định', description: 'Cấu hình độ tuổi cho phép, sĩ số tối đa, điểm đạt, hệ số điểm, môn học và học kỳ.', tag: 'QD1-QD6', gradient: 'from-rose-500 to-pink-600', iconCls: 'bg-rose-50 text-rose-600', tagCls: 'bg-rose-50 text-rose-600' },
              { icon: Shield, title: 'Tài khoản phụ huynh', description: 'Phụ huynh đăng nhập xem điểm con em. Liên kết nhiều học sinh, bảo mật theo trường.', tag: 'Parent Portal', gradient: 'from-teal-500 to-cyan-600', iconCls: 'bg-teal-50 text-teal-600', tagCls: 'bg-teal-50 text-teal-600' },
            ].map((feature, i) => (
              <div
                key={feature.title}
                style={{ transitionDelay: `${150 + i * 80}ms` }}
                className={`group relative p-6 bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200/40 hover:-translate-y-2 hover:border-blue-100 cursor-default overflow-hidden ${features.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />
                <div className="relative">
                  <div className={`w-12 h-12 ${feature.iconCls} rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:drop-shadow-lg`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-md mb-3 font-medium ${feature.tagCls}`}>{feature.tag}</span>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                </div>
                <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS Enhanced ==================== */}
      <section id="how-it-works" ref={howItWorks.ref} className="py-24 px-4 bg-gray-50/80">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${howItWorks.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4 uppercase tracking-wider">Cách hoạt động</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Bắt đầu trong 3 bước</h2>
            <p className="mt-4 text-lg text-gray-500">Triển khai hệ thống quản lý trường học chỉ trong vài phút</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
            {/* Shimmer connection line */}
            <div className="hidden md:block absolute top-7 left-[16.67%] right-[16.67%] h-[2px] overflow-hidden">
              <div className="w-full h-full bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
            </div>
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
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="relative w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-xl group-hover:shadow-blue-500/40">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 transition-colors group-hover:text-primary">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.description}</p>
                  {item.link && (
                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 mt-3 text-sm text-primary font-medium hover:gap-3 transition-all duration-200"
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

      {/* ==================== MULTI-TENANT Enhanced ==================== */}
      <section ref={multiTenant.ref} className="py-24 px-4 bg-gradient-to-br from-gray-50/50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className={`transition-all duration-700 ${multiTenant.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-600 mb-6 hover:bg-blue-100 transition-colors cursor-default">
                <Layers className="w-4 h-4" />
                Multi-Tenant Architecture
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Mỗi trường, một không gian riêng biệt</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Kiến trúc multi-tenant đảm bảo dữ liệu của mỗi trường được cách ly hoàn toàn.
                Trường A không thể truy cập dữ liệu trường B. Mỗi trường tùy chỉnh quy định, môn học, hệ số điểm theo nhu cầu riêng.
              </p>
              <ul className="space-y-4">
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
                    <div className="mt-0.5 w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-emerald-500 group-hover:scale-110">
                      <Check className="w-3 h-3 text-emerald-600 transition-colors group-hover:text-white" />
                    </div>
                    <span className="text-gray-600 text-sm group-hover:text-gray-900 transition-colors">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dark terminal card */}
            <div className={`transition-all duration-700 delay-200 ${multiTenant.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
              <div className="bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 rounded-2xl p-6 border border-gray-700/50 shadow-2xl shadow-gray-900/30 animate-pulse-glow">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-xs text-gray-500 font-mono">cloudschool.vn — tenant dashboard</span>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'THPT Nguyễn Trãi', code: 'NT-HS', students: 1250, classes: 36, gradient: 'from-blue-500 to-blue-600' },
                    { name: 'THPT Lê Quý Đôn', code: 'LQD-HS', students: 890, classes: 27, gradient: 'from-violet-500 to-purple-600' },
                    { name: 'THPT Demo', code: 'THPT-DEMO', students: 120, classes: 9, gradient: 'from-emerald-500 to-teal-600' },
                  ].map((school, i) => (
                    <div
                      key={school.code}
                      style={{ transitionDelay: `${350 + i * 100}ms` }}
                      className={`bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-300 cursor-default group ${multiTenant.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 bg-gradient-to-br ${school.gradient} rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg`}>
                            <School className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">{school.name}</p>
                            <p className="text-xs text-gray-500 font-mono">{school.code}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p className="text-white/70">{school.students} HS</p>
                          <p>{school.classes} lớp</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section ref={testimonialsSection.ref} className={`py-24 px-4 bg-white overflow-hidden transition-all duration-700 ${testimonialsSection.isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4 uppercase tracking-wider">Đánh giá</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Nhà trường nói gì về chúng tôi</h2>
          </div>
          <div className="flex gap-6 animate-marquee" style={{ animationDuration: '40s' }}>
            {[...testimonials, ...testimonials].map((t, i) => (
              <TestimonialCard key={i} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PRICING Enhanced ==================== */}
      <section id="pricing" ref={pricing.ref} className="py-24 px-4 bg-gray-50/80">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${pricing.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4 uppercase tracking-wider">Bảng giá</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Bảng giá đơn giản</h2>
            <p className="mt-4 text-lg text-gray-500">Chọn gói phù hợp với quy mô trường học của bạn</p>
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
                  ? 'bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white shadow-2xl shadow-blue-500/30 scale-105 hover:shadow-blue-500/50 animate-pulse-glow'
                  : 'bg-white border border-gray-200 hover:shadow-xl hover:border-gray-300'
                } ${pricing.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                {plan.highlighted && (
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#3b82f620,transparent)]" />
                  </div>
                )}
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 text-xs font-bold rounded-full flex items-center gap-1 shadow-lg whitespace-nowrap">
                    <Star className="w-3 h-3 fill-current" />
                    Phổ biến nhất
                  </div>
                )}
                <div className="relative">
                  <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                    {plan.unit && <span className={`text-sm ${plan.highlighted ? 'text-white/70' : 'text-gray-500'}`}>{plan.unit}</span>}
                  </div>
                  <p className={`mt-2 text-sm ${plan.highlighted ? 'text-white/75' : 'text-gray-500'}`}>{plan.description}</p>
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
                    className={`mt-8 block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-gray-50 hover:shadow-white/20'
                      : 'bg-primary text-white hover:bg-blue-600 hover:shadow-primary/25'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section ref={faqSection.ref} className={`py-24 px-4 bg-white transition-all duration-700 ${faqSection.isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4 uppercase tracking-wider">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Câu hỏi thường gặp</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CTA Enhanced ==================== */}
      <section ref={cta.ref} className="py-24 px-4 bg-[#070B14] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,#1d4ed825,transparent)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-blue-600/10 rounded-full blur-[90px]" />
        {/* Floating particles */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="particle animate-float"
            style={{
              top: `${15 + (i * 37) % 70}%`,
              left: `${10 + (i * 29) % 80}%`,
              width: `${3 + (i % 3) * 2}px`,
              height: `${3 + (i % 3) * 2}px`,
              opacity: 0.1 + (i % 3) * 0.05,
              animationDelay: `${(i * 0.6) % 6}s`,
            }}
          />
        ))}
        <div className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-700 ${cta.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="p-12 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm text-blue-400 mb-6">
              <Zap className="w-4 h-4" />
              Bắt đầu ngay hôm nay
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              Sẵn sàng chuyển đổi số trường học?
            </h2>
            <p className="text-lg text-white/45 mb-10 max-w-2xl mx-auto">
              Đăng ký ngay hôm nay và trải nghiệm hệ thống quản lý trường học hiện đại nhất.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="group relative inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-blue-600 to-blue-500"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Đăng ký miễn phí
                  <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white/65 border border-white/15 rounded-xl transition-all duration-300 hover:bg-white/10 hover:border-white/30 hover:text-white hover:-translate-y-0.5 active:translate-y-0"
              >
                Dùng thử demo
                <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER Enhanced ==================== */}
      <footer className="bg-gray-950 border-t border-white/5 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Logo & Description */}
            <div>
              <Link href="/" className="flex items-center gap-2 group mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white group-hover:text-primary transition-colors">CloudSchool</span>
              </Link>
              <p className="text-sm text-gray-500 leading-relaxed">
                Nền tảng quản lý trường học SaaS đa tổ chức, giúp các trường THPT quản lý học sinh, điểm số và báo cáo hiệu quả.
              </p>
            </div>
            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Liên kết</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-sm text-gray-500 hover:text-white transition-colors">Tính năng</a>
                <a href="#pricing" className="block text-sm text-gray-500 hover:text-white transition-colors">Bảng giá</a>
                <Link href="/login" className="block text-sm text-gray-500 hover:text-white transition-colors">Đăng nhập</Link>
                <Link href="/register" className="block text-sm text-gray-500 hover:text-white transition-colors">Đăng ký</Link>
              </div>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Liên hệ</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="w-4 h-4" />
                  <span>support@cloudschool.vn</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="w-4 h-4" />
                  <span>+84 123 456 789</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Globe className="w-4 h-4" />
                  <span>cloudschool.vn</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} CloudSchool. Nền tảng quản lý trường học SaaS.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Được xây dựng với ❤️ cho giáo dục Việt Nam</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
