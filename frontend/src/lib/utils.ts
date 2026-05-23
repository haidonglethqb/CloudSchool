import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateInput(date: string | Date): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

export function calculateAge(dateOfBirth: string | Date): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

export function getGenderLabel(gender: string): string {
  const labels: Record<string, string> = {
    MALE: 'Nam',
    FEMALE: 'Nữ',
    OTHER: 'Khác',
  }
  return labels[gender] || gender
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    PLATFORM_ADMIN: 'Quản trị hệ thống',
    SUPER_ADMIN: 'Quản trị trường',
    STAFF: 'Nhân viên',
    TEACHER: 'Giáo viên',
    STUDENT: 'Học sinh',
    PARENT: 'Phụ huynh',
  }
  return labels[role] || role
}

export function getPassStatus(score: number, passScore: number): { passed: boolean; label: string; color: string } {
  const passed = score >= passScore
  return {
    passed,
    label: passed ? 'Đạt' : 'Chưa đạt',
    color: passed ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100',
  }
}

type SemesterStatusSource = {
  isActive: boolean
  startDate?: string | Date | null
  endDate?: string | Date | null
}

export function getSemesterEntryStatus(semester: SemesterStatusSource) {
  return semester.isActive
    ? { label: 'Mở nhập điểm', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : { label: 'Đóng nhập điểm', className: 'bg-gray-100 text-gray-700 border-gray-200' }
}

export function getSemesterScheduleStatus(semester: SemesterStatusSource, referenceDate: Date = new Date()) {
  if (!semester.startDate || !semester.endDate) {
    return { label: 'Chưa có lịch', className: 'bg-gray-100 text-gray-600 border-gray-200' }
  }

  const start = new Date(semester.startDate)
  const end = new Date(semester.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { label: 'Lịch không hợp lệ', className: 'bg-red-50 text-red-700 border-red-200' }
  }

  if (referenceDate < start) {
    return { label: 'Chưa tới ngày bắt đầu', className: 'bg-amber-50 text-amber-700 border-amber-200' }
  }

  if (referenceDate > end) {
    return { label: 'Đã qua ngày kết thúc', className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }

  return { label: 'Đang trong thời gian học kỳ', className: 'bg-blue-50 text-blue-700 border-blue-200' }
}
