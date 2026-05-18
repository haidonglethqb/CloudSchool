import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Child {
  id: string
  fullName: string
  studentCode: string
  className: string | null
  relationship: string
}

export type UserRole = 'PLATFORM_ADMIN' | 'SUPER_ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT'

interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  tenantId?: string
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
  hasHydrated: boolean
  setAuth: (user: User, token: string) => void
  setHasHydrated: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
