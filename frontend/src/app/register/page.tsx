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
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react'

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

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true)
      const response = await authApi.registerSchool({
        schoolName: data.schoolName,
        adminEmail: data.adminEmail,
        adminName: data.adminName,
        adminPassword: data.adminPassword,
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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CloudSchool</h1>
          <p className="text-gray-600 mt-1">Đăng ký trường học mới</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Thông tin đăng ký</h2>
          <p className="text-sm text-gray-500 mb-4">Mã trường sẽ được tạo tự động sau khi đăng ký.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Tên trường học</label>
              <input
                type="text"
                className={`input ${errors.schoolName ? 'border-red-500' : ''}`}
                placeholder="VD: Trường THPT ABC"
                {...register('schoolName')}
              />
              {errors.schoolName && (
                <p className="text-red-500 text-xs mt-1">{errors.schoolName.message}</p>
              )}
            </div>

            <div>
              <label className="label">Họ tên quản trị viên</label>
              <input
                type="text"
                className={`input ${errors.adminName ? 'border-red-500' : ''}`}
                placeholder="VD: Nguyễn Văn A"
                {...register('adminName')}
              />
              {errors.adminName && (
                <p className="text-red-500 text-xs mt-1">{errors.adminName.message}</p>
              )}
            </div>

            <div>
              <label className="label">Email quản trị viên</label>
              <input
                type="email"
                className={`input ${errors.adminEmail ? 'border-red-500' : ''}`}
                placeholder="admin@school.edu.vn"
                {...register('adminEmail')}
              />
              {errors.adminEmail && (
                <p className="text-red-500 text-xs mt-1">{errors.adminEmail.message}</p>
              )}
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
              {errors.adminPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>
              )}
            </div>

            <div>
              <label className="label">Xác nhận mật khẩu</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className={`input ${errors.confirmPassword ? 'border-red-500' : ''}`}
                placeholder="Nhập lại mật khẩu"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 flex items-center justify-center"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Đăng ký trường học
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
