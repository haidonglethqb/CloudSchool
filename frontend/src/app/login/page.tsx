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
import { GraduationCap, Eye, EyeOff, Loader2, Building2, Shield } from 'lucide-react'

const loginSchema = z.object({
  tenantCode: z.string().optional(),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    if (!isPlatformAdmin && !data.tenantCode) {
      toast.error('Vui lòng nhập mã trường')
      return
    }
    try {
      setIsLoading(true)
      const payload: { email: string; password: string; tenantCode?: string } = {
        email: data.email,
        password: data.password,
      }
      if (!isPlatformAdmin && data.tenantCode) {
        payload.tenantCode = data.tenantCode
      }
      const response = await authApi.login(payload)
      const { user, token, tenant } = response.data.data
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

  const togglePlatformAdmin = () => {
    setIsPlatformAdmin(!isPlatformAdmin)
    if (!isPlatformAdmin) {
      setValue('tenantCode', '')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CloudSchool</h1>
          <p className="text-gray-600 mt-1">Hệ thống quản lý trường học</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Đăng nhập</h2>
            <button
              type="button"
              onClick={togglePlatformAdmin}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${
                isPlatformAdmin
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Shield className="w-3 h-3" />
              {isPlatformAdmin ? 'Platform Admin' : 'Trường học'}
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!isPlatformAdmin && (
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
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className={`input ${errors.email ? 'border-red-500' : ''}`}
                placeholder={isPlatformAdmin ? 'admin@cloudschool.vn' : 'example@school.edu.vn'}
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 flex items-center justify-center"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Đăng nhập
            </button>
          </form>

          {!isPlatformAdmin && (
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-600">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Đăng ký trường học
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2024 CloudSchool. All rights reserved.
        </p>
      </div>
    </div>
  )
}
