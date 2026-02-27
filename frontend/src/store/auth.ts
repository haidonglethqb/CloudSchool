import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Child {
  id: string
  fullName: string
  studentCode: string
  className: string | null
  relationship: string
}

interface User {
  id: string
  email: string
  fullName: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT'
  tenantId: string
  tenant?: {
    id: string
    name: string
    code: string
  }
  children?: Child[]
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
