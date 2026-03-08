'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { GraduationCap, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Check, Users, BookOpen, Building2 } from 'lucide-react'

interface Plan {
  id: string
  name: string
  price: number
  description: string | null
  studentLimit: number
  teacherLimit: number
  classLimit: number
  features: string[]
}

const registerSchema = z
  .object({
    schoolName: z.string().min(3, 'Tên trường ít nhất 3 ký tự'),
    adminEmail: z.string().email('Email không hợp lệ'),
    adminName: z.string().min(2, 'Họ tên ít nhất 2 ký tự'),
    adminPassword: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.adminPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

const formatPrice = (n: number) =>
  n === 0 ? 'Miễn phí' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  useEffect(() => {
    authApi.getPlans()
      .then(res => {
        const data = res.data.data || []
        setPlans(data)
        if (data.length > 0) setSelectedPlan(data[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false))
  }, [])

  const goToStep2 = async () => {
    const valid = await trigger()
    if (valid) setStep(2)
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true)
      const response = await authApi.registerSchool({
        schoolName: data.schoolName,
        adminEmail: data.adminEmail,
        adminName: data.adminName,
        adminPassword: data.adminPassword,
        planId: selectedPlan || undefined,
      })
      const { user, token, tenant } = response.data.data
      setAuth({ ...user, tenant }, token)
      toast.success(`Đăng ký thành công! Mã trường: ${tenant.code}`)
      router.push('/dashboard')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Đăng ký thất bại'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CloudSchool</h1>
          <p className="text-gray-600 mt-1">Đăng ký trường học mới</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 1 ? 'bg-primary text-white' : 'bg-green-100 text-green-700'
          }`}>
            {step > 1 ? <Check className="w-4 h-4" /> : <span>1</span>}
            <span>Thông tin trường</span>
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <span>2</span>
            <span>Chọn gói</span>
          </div>
        </div>

        {/* Step 1: School Info */}
        {step === 1 && (
          <div className="card p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Thông tin đăng ký</h2>
            <p className="text-sm text-gray-500 mb-5">Mã trường sẽ được tạo tự động sau khi đăng ký.</p>

            <form onSubmit={(e) => { e.preventDefault(); goToStep2() }} className="space-y-4">
              <div>
                <label className="label">Tên trường học</label>
                <input
                  type="text"
                  className={`input ${errors.schoolName ? 'border-red-500' : ''}`}
                  placeholder="VD: Trường THPT ABC"
                  {...register('schoolName')}
                />
                {errors.schoolName && <p className="text-red-500 text-xs mt-1">{errors.schoolName.message}</p>}
              </div>

              <div>
                <label className="label">Họ tên quản trị viên</label>
                <input
                  type="text"
                  className={`input ${errors.adminName ? 'border-red-500' : ''}`}
                  placeholder="VD: Nguyễn Văn A"
                  {...register('adminName')}
                />
                {errors.adminName && <p className="text-red-500 text-xs mt-1">{errors.adminName.message}</p>}
              </div>

              <div>
                <label className="label">Email quản trị viên</label>
                <input
                  type="email"
                  className={`input ${errors.adminEmail ? 'border-red-500' : ''}`}
                  placeholder="admin@school.edu.vn"
                  {...register('adminEmail')}
                />
                {errors.adminEmail && <p className="text-red-500 text-xs mt-1">{errors.adminEmail.message}</p>}
              </div>

              <div>
                <label className="label">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`input pr-10 ${errors.adminPassword ? 'border-red-500' : ''}`}
                    placeholder="Ít nhất 6 ký tự"
                    {...register('adminPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.adminPassword && <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>}
              </div>

              <div>
                <label className="label">Xác nhận mật khẩu</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="Nhập lại mật khẩu"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" className="btn-primary w-full py-2.5 flex items-center justify-center">
                Tiếp theo <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-600">
                Đã có tài khoản?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">Đăng nhập</Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </button>

            {loadingPlans ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : plans.length === 0 ? (
              <div className="card p-8 text-center max-w-md mx-auto">
                <p className="text-gray-500 mb-4">Chưa có gói dịch vụ nào.</p>
                <button onClick={handleSubmit(onSubmit)} disabled={isLoading} className="btn-primary py-2.5 px-6">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Đăng ký trường học
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {plans.map(plan => {
                    const isSelected = selectedPlan === plan.id
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`card p-5 cursor-pointer transition-all border-2 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20 shadow-md'
                            : 'border-transparent hover:border-gray-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                            {plan.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>

                        <p className="text-2xl font-bold text-primary mb-4">
                          {formatPrice(plan.price)}
                          {plan.price > 0 && <span className="text-sm font-normal text-gray-500">/tháng</span>}
                        </p>

                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            <span>Tối đa <strong>{plan.studentLimit}</strong> học sinh</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-green-500" />
                            <span>Tối đa <strong>{plan.teacherLimit}</strong> giáo viên</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-500" />
                            <span>Tối đa <strong>{plan.classLimit}</strong> lớp học</span>
                          </div>
                        </div>

                        {plan.features.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                            {plan.features.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                <span className="text-gray-600">{f}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isLoading}
                    className="btn-primary py-2.5 px-8 flex items-center justify-center text-base"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Đăng ký trường học
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
