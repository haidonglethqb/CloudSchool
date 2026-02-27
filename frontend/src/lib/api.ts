import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string; code?: string } }>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string, tenantCode: string) =>
    api.post('/auth/login', { email, password, tenantCode }),
  
  registerSchool: (data: { schoolName: string; schoolCode: string; adminEmail: string; adminPassword: string; adminName: string }) =>
    api.post('/auth/register-school', data),
  
  me: () => api.get('/auth/me'),
  
  logout: () => api.post('/auth/logout'),
}

// Student API
export const studentApi = {
  list: (params?: { search?: string; classId?: string; gradeId?: string }) =>
    api.get('/students', { params }),
  
  get: (id: string) => api.get(`/students/${id}`),
  
  create: (data: {
    fullName: string
    gender: string
    dateOfBirth: string
    address: string
    email?: string
    classId: string
  }) => api.post('/students', data),
  
  update: (id: string, data: Partial<{
    fullName: string
    gender: string
    dateOfBirth: string
    address: string
    email: string
    classId: string
  }>) => api.put(`/students/${id}`, data),
  
  delete: (id: string) => api.delete(`/students/${id}`),
  
  getGrades: (studentId: string) => api.get(`/students/${studentId}/grades`),
}

// Class API
export const classApi = {
  list: (gradeId?: string) => api.get('/classes', { params: { gradeId } }),
  
  get: (id: string) => api.get(`/classes/${id}`),
  
  create: (data: { name: string; gradeId: string }) =>
    api.post('/classes', data),
  
  update: (id: string, data: { name?: string; gradeId?: string }) =>
    api.put(`/classes/${id}`, data),
  
  delete: (id: string) => api.delete(`/classes/${id}`),
  
  getGrades: () => api.get('/classes/grades'),
  
  createGrade: (data: { name: string; level: number }) =>
    api.post('/classes/grades', data),
}

// Subject API
export const subjectApi = {
  list: () => api.get('/subjects'),
  
  get: (id: string) => api.get(`/subjects/${id}`),
  
  create: (data: { name: string; code: string }) =>
    api.post('/subjects', data),
  
  update: (id: string, data: { name?: string; code?: string }) =>
    api.put(`/subjects/${id}`, data),
  
  delete: (id: string) => api.delete(`/subjects/${id}`),
  
  // Semesters
  getSemesters: () => api.get('/subjects/semesters'),
  
  createSemester: (data: { name: string; year: number; term: number }) =>
    api.post('/subjects/semesters', data),
  
  setActiveSemester: (id: string) =>
    api.patch(`/subjects/semesters/${id}/activate`),
}

// Score API
export const scoreApi = {
  getByClass: (classId: string, subjectId: string, semesterId: string) =>
    api.get(`/scores/class/${classId}`, { params: { subjectId, semesterId } }),
  
  create: (data: {
    studentId: string
    subjectId: string
    semesterId: string
    scoreType: string
    value: number
  }) => api.post('/scores', data),
  
  batchUpdate: (scores: Array<{
    studentId: string
    subjectId: string
    semesterId: string
    scoreType: string
    value: number
  }>) => api.post('/scores/batch', { scores }),
  
  update: (id: string, value: number) =>
    api.patch(`/scores/${id}`, { value }),
  
  delete: (id: string) => api.delete(`/scores/${id}`),
  
  getStudentScores: (studentId: string, semesterId?: string) =>
    api.get(`/scores/student/${studentId}`, { params: { semesterId } }),
}

// Report API
export const reportApi = {
  subjectSummary: (subjectId: string, semesterId: string) =>
    api.get('/reports/subject-summary', { params: { subjectId, semesterId } }),
  
  semesterSummary: (semesterId: string) =>
    api.get('/reports/semester-summary', { params: { semesterId } }),
  
  dashboard: () => api.get('/reports/dashboard'),
}

// Settings API
export const settingsApi = {
  get: () => api.get('/settings'),
  
  update: (data: Partial<{
    minAge: number
    maxAge: number
    maxClassSize: number
    passScore: number
    quiz15Weight: number
    quiz45Weight: number
    finalWeight: number
  }>) => api.put('/settings', data),
  
  updateAgeRules: (minAge: number, maxAge: number) =>
    api.patch('/settings/age-rules', { minAge, maxAge }),
  
  updateClassSize: (maxClassSize: number) =>
    api.patch('/settings/class-size', { maxClassSize }),
  
  updatePassScore: (passScore: number) =>
    api.patch('/settings/pass-score', { passScore }),
  
  updateScoreWeights: (quiz15Weight: number, quiz45Weight: number, finalWeight: number) =>
    api.patch('/settings/score-weights', { quiz15Weight, quiz45Weight, finalWeight }),
  
  // Grades
  getGrades: () => api.get('/settings/grades'),
  createGrade: (data: { name: string; level: number }) =>
    api.post('/settings/grades', data),
  updateGrade: (id: string, data: { name?: string; level?: number }) =>
    api.put(`/settings/grades/${id}`, data),
  deleteGrade: (id: string) => api.delete(`/settings/grades/${id}`),
}

// Tenant API
export const tenantApi = {
  getCurrent: () => api.get('/tenants/current'),
  getStats: () => api.get('/tenants/stats'),
}
