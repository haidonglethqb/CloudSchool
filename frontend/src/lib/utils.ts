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

export function getScoreTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    QUIZ_15: '15 phút',
    QUIZ_45: '1 tiết',
    FINAL: 'Cuối kỳ',
  }
  return labels[type] || type
}

export function getPassStatus(score: number, passScore: number): { passed: boolean; label: string; color: string } {
  const passed = score >= passScore
  return {
    passed,
    label: passed ? 'Đạt' : 'Chưa đạt',
    color: passed ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100',
  }
}
