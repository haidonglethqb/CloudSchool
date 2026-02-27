'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { GraduationCap, Eye, EyeOff, Loader2, Building2 } from 'lucide-react'

const loginSchema = z.object({
  tenantCode: z.string().min(1, 'Vui lòng nhập mã trường'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantCode: 'THPT-DEMO' // Default for demo
    }
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      const response = await authApi.login(data.email, data.password, data.tenantCode)
      const { user, token, tenant } = response.data.data
      // Include tenant info in user object
      setAuth({ ...user, tenant }, token)
      toast.success('Đăng nhập thành công!')
      router.push('/dashboard')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Đăng nhập thất bại'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CloudSchool</h1>
          <p className="text-gray-600 mt-1">Hệ thống quản lý học sinh</p>
        </div>

        {/* Login form */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Đăng nhập</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Mã trường</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className={`input pl-10 uppercase ${errors.tenantCode ? 'border-red-500' : ''}`}
                  placeholder="VD: THPT-DEMO"
                  {...register('tenantCode')}
                />
              </div>
              {errors.tenantCode && (
                <p className="text-red-500 text-xs mt-1">{errors.tenantCode.message}</p>
              )}
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className={`input ${errors.email ? 'border-red-500' : ''}`}
                placeholder="example@school.edu.vn"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Nhập mật khẩu"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Đăng nhập
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="font-medium text-blue-800 mb-1">Tài khoản demo:</p>
            <p className="text-blue-600">Mã trường: THPT-DEMO</p>
            <p className="text-blue-600">Admin: admin@demo.school.vn / admin123</p>
            <p className="text-blue-600">Parent: parent1@demo.school.vn / parent123</p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              Chưa có tài khoản?{' '}
              <Link
                href="/register"
                className="text-primary font-medium hover:underline"
              >
                Đăng ký trường học
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2024 CloudSchool. All rights reserved.
        </p>
      </div>
    </div>
  )
}
