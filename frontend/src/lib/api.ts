import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string; code?: string } }>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ==================== Auth ====================
export const authApi = {
  login: (data: { email: string; password: string; tenantCode?: string }) =>
    api.post('/auth/login', data),
  registerSchool: (data: { schoolName: string; adminEmail: string; adminPassword: string; adminName: string; planId?: string }) =>
    api.post('/auth/register-school', data),
  getPlans: () => api.get('/auth/plans'),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// ==================== Platform Admin ====================
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  // Schools
  listSchools: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/admin/schools', { params }),
  getSchool: (id: string) => api.get(`/admin/schools/${id}`),
  createSchool: (data: { name: string; address?: string; phone?: string; email?: string; adminEmail: string; adminName: string; adminPassword?: string; planId?: string }) =>
    api.post('/admin/schools', data),
  updateSchool: (id: string, data: Record<string, unknown>) => api.put(`/admin/schools/${id}`, data),
  deleteSchool: (id: string) => api.delete(`/admin/schools/${id}`),
  suspendSchool: (id: string) => api.patch(`/admin/schools/${id}/suspend`),
  activateSchool: (id: string) => api.patch(`/admin/schools/${id}/activate`),
  // School detail tabs
  getSchoolUsers: (id: string, params?: { search?: string; role?: string; page?: number; limit?: number }) =>
    api.get(`/admin/schools/${id}/users`, { params }),
  getSchoolStats: (id: string) => api.get(`/admin/schools/${id}/stats`),
  getSchoolActivity: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/admin/schools/${id}/activity`, { params }),
  // Subscriptions
  listSubscriptions: () => api.get('/admin/subscriptions'),
  createSubscription: (data: { name: string; maxStudents: number; maxTeachers: number; maxClasses: number; price: number; features?: string[] }) =>
    api.post('/admin/subscriptions', data),
  updateSubscription: (id: string, data: Record<string, unknown>) => api.put(`/admin/subscriptions/${id}`, data),
  deleteSubscription: (id: string) => api.delete(`/admin/subscriptions/${id}`),
}

// ==================== Users ====================
export const userApi = {
  list: (params?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: { email: string; password: string; fullName: string; phone?: string; role: string; department?: string }) =>
    api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  disable: (id: string) => api.patch(`/users/${id}/disable`),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateAssignments: (id: string, assignments: Array<{ classId: string; subjectId: string; isHomeroom?: boolean }>) =>
    api.put(`/users/${id}/assignments`, { assignments }),
}

// ==================== Students ====================
export const studentApi = {
  list: (params?: { search?: string; classId?: string; gradeId?: string; page?: number; limit?: number }) =>
    api.get('/students', { params }),
  get: (id: string) => api.get(`/students/${id}`),
  create: (data: { fullName: string; gender: string; dateOfBirth: string; address?: string; phone?: string; classId: string; parentName?: string; parentPhone?: string }) =>
    api.post('/students', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
  transfer: (id: string, data: { classId: string; reason?: string }) =>
    api.post(`/students/${id}/transfer`, data),
  getTransferHistory: (id: string) => api.get(`/students/${id}/transfer-history`),
}

// ==================== Classes ====================
export const classApi = {
  list: (params?: { gradeId?: string; academicYear?: string }) =>
    api.get('/classes', { params }),
  get: (id: string) => api.get(`/classes/${id}`),
  create: (data: { name: string; gradeId: string; academicYear?: string }) =>
    api.post('/classes', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/classes/${id}`, data),
  delete: (id: string) => api.delete(`/classes/${id}`),
  getGrades: () => api.get('/classes/grades'),
  // Teacher assignments
  assignTeacher: (classId: string, data: { teacherId: string; subjectId: string; isHomeroom?: boolean }) =>
    api.post(`/classes/${classId}/assign-teacher`, data),
  removeAssignment: (classId: string, assignmentId: string) =>
    api.delete(`/classes/${classId}/assign-teacher/${assignmentId}`),
  // Class students
  getStudents: (classId: string) => api.get(`/classes/${classId}/students`),
  addStudent: (classId: string, studentId: string) =>
    api.post(`/classes/${classId}/students`, { studentId }),
  removeStudent: (classId: string, studentId: string) =>
    api.delete(`/classes/${classId}/students/${studentId}`),
}

// ==================== Subjects ====================
export const subjectApi = {
  list: (params?: { includeInactive?: boolean }) => api.get('/subjects', { params }),
  get: (id: string) => api.get(`/subjects/${id}`),
  create: (data: { name: string; code: string; description?: string }) =>
    api.post('/subjects', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/subjects/${id}`),
  // Semesters
  getSemesters: () => api.get('/subjects/semesters'),
  createSemester: (data: { name: string; year: string; semesterNum: number; startDate?: string; endDate?: string }) =>
    api.post('/subjects/semesters', data),
  updateSemester: (id: string, data: Record<string, unknown>) =>
    api.patch(`/subjects/semesters/${id}`, data),
  deleteSemester: (id: string) => api.delete(`/subjects/semesters/${id}`),
}

// ==================== Score Components ====================
export const scoreComponentApi = {
  list: (subjectId?: string) => api.get('/score-components', { params: { subjectId } }),
  create: (data: { name: string; weight: number; subjectId: string }) =>
    api.post('/score-components', data),
  update: (id: string, data: { name?: string; weight?: number }) =>
    api.put(`/score-components/${id}`, data),
  delete: (id: string) => api.delete(`/score-components/${id}`),
}

// ==================== Scores ====================
export const scoreApi = {
  getByClass: (classId: string, subjectId: string, semesterId: string) =>
    api.get(`/scores/class/${classId}`, { params: { subjectId, semesterId } }),
  getByStudent: (studentId: string, semesterId?: string) =>
    api.get(`/scores/student/${studentId}`, { params: { semesterId } }),
  save: (data: { studentId: string; subjectId: string; semesterId: string; scoreComponentId: string; value: number }) =>
    api.post('/scores', data),
  batchSave: (scores: Array<{ studentId: string; subjectId: string; semesterId: string; scoreComponentId: string; value: number }>) =>
    api.post('/scores/batch', { scores }),
  lock: (id: string) => api.patch(`/scores/${id}/lock`),
  unlock: (id: string) => api.patch(`/scores/${id}/unlock`),
  lockClass: (classId: string, data: { subjectId: string; semesterId: string }) =>
    api.post(`/scores/class/${classId}/lock`, data),
  unlockClass: (classId: string, data: { subjectId: string; semesterId: string }) =>
    api.post(`/scores/class/${classId}/unlock`, data),
  delete: (id: string) => api.delete(`/scores/${id}`),
}

// ==================== Promotion ====================
export const promotionApi = {
  list: (params?: { semesterId?: string; classId?: string }) =>
    api.get('/promotion', { params }),
  calculate: (data: { semesterId: string; classId?: string }) =>
    api.post('/promotion/calculate', data),
  override: (id: string, result: string) =>
    api.put(`/promotion/${id}`, { result }),
}

// ==================== Reports ====================
export const reportApi = {
  subjectSummary: (subjectId: string, semesterId: string) =>
    api.get('/reports/subject-summary', { params: { subjectId, semesterId } }),
  semesterSummary: (semesterId: string) =>
    api.get('/reports/semester-summary', { params: { semesterId } }),
  dashboard: () => api.get('/reports/dashboard'),
}

// ==================== Settings ====================
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: Partial<{ minAge: number; maxAge: number; maxClassSize: number; passScore: number }>) =>
    api.put('/settings', data),
  // Grades
  getGrades: () => api.get('/settings/grades'),
  createGrade: (data: { name: string; level: number }) => api.post('/settings/grades', data),
  updateGrade: (id: string, data: { name?: string; level?: number }) => api.put(`/settings/grades/${id}`, data),
  deleteGrade: (id: string) => api.delete(`/settings/grades/${id}`),
  // Role Permissions
  getRolePermissions: () => api.get('/settings/role-permissions'),
  updateRolePermissions: (permissions: Record<string, string[]>) =>
    api.put('/settings/role-permissions', { permissions }),
}

// ==================== Tenant ====================
export const tenantApi = {
  getCurrent: () => api.get('/tenants/current'),
  update: (data: Record<string, unknown>) => api.put('/tenants/current', data),
  getStats: () => api.get('/tenants/stats'),
}

// ==================== Parents ====================
export const parentApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get('/parents', { params }),
  create: (data: { email: string; password: string; fullName: string; phone?: string; studentIds: string[] }) =>
    api.post('/parents', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/parents/${id}`, data),
  delete: (id: string) => api.delete(`/parents/${id}`),
  linkStudent: (parentId: string, studentId: string, relationship?: string) =>
    api.post(`/parents/${parentId}/students`, { studentId, relationship }),
  unlinkStudent: (parentId: string, studentId: string) =>
    api.delete(`/parents/${parentId}/students/${studentId}`),
  // Self-service
  getMyChildren: () => api.get('/parents/my-children'),
  getChildScores: (studentId: string, semesterId?: string) =>
    api.get(`/parents/my-children/${studentId}/scores`, { params: { semesterId } }),
  getSemesters: () => api.get('/parents/semesters'),
}

// ==================== Export ====================
export const exportApi = {
  students: (params?: { format?: string; classId?: string; gradeId?: string }) =>
    api.get('/export/students', { params, responseType: 'blob' }),
  classes: (params?: { format?: string }) =>
    api.get('/export/classes', { params, responseType: 'blob' }),
  scores: (params: { classId: string; subjectId: string; semesterId: string; format?: string }) =>
    api.get('/export/scores', { params, responseType: 'blob' }),
  schools: (params?: { format?: string }) =>
    api.get('/export/schools', { params, responseType: 'blob' }),
}

// ==================== Monitoring ====================
export const monitoringApi = {
  systemStats: () => api.get('/monitoring/system-stats'),
  activityLogs: (params?: { page?: number; limit?: number; action?: string; entity?: string; tenantId?: string }) =>
    api.get('/monitoring/activity-logs', { params }),
  schoolStats: (schoolId: string) => api.get(`/monitoring/school-stats/${schoolId}`),
}

// ==================== Fees ====================
export const feeApi = {
  list: (params?: { category?: string; isActive?: string }) =>
    api.get('/fees', { params }),
  get: (id: string) => api.get(`/fees/${id}`),
  create: (data: Record<string, unknown>) => api.post('/fees', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/fees/${id}`, data),
  delete: (id: string) => api.delete(`/fees/${id}`),
  updateStudentPayment: (feeId: string, studentId: string, data: { status?: string; paidAmount?: number; note?: string }) =>
    api.patch(`/fees/${feeId}/students/${studentId}`, data),
  assignStudents: (feeId: string, studentIds: string[]) =>
    api.post(`/fees/${feeId}/assign`, { studentIds }),
  getParentFees: () => api.get('/fees/parent/my-fees'),
}

// ==================== Helper: Download blob ====================
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
