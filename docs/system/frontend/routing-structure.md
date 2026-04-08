# Next.js App Router Structure

## Route Tree

```
frontend/src/app/
├── layout.tsx              # Root layout (Toaster, global CSS)
├── login/page.tsx          # School/Platform Admin login
├── register/page.tsx       # School registration
└── (dashboard)/            # Route group — shared layout
    ├── layout.tsx          # Auth guard + sidebar + menu
    ├── dashboard/page.tsx  # Home dashboard
    ├── admin/
    │   ├── schools/page.tsx
    │   ├── subscriptions/page.tsx
    │   ├── monitoring/page.tsx
    │   └── activity-logs/page.tsx
    ├── users/page.tsx
    ├── students/
    │   ├── new/page.tsx
    │   └── page.tsx        # Student search
    ├── classes/page.tsx
    ├── subjects/page.tsx
    ├── scores/page.tsx
    ├── promotion/page.tsx
    ├── reports/page.tsx
    ├── parents/page.tsx
    ├── settings/
    │   ├── page.tsx
    │   ├── academic-years/page.tsx
    │   └── permissions/page.tsx
    ├── my-children/
    │   ├── page.tsx
    │   └── fees/page.tsx
    └── my-scores/page.tsx
```

## Authentication Flow

```mermaid
flowchart TD
    A[User visits any route] --> B{/(dashboard)/layout.tsx}
    B -->|isAuthenticated| C[Render sidebar + children]
    B -->|!isAuthenticated| D[router.push /login]
    C --> E[Fetch role permissions if STAFF/TEACHER]
    E --> F[Filter menu by allowed modules]
```

## Auth Guard Implementation

```tsx
// frontend/src/app/(dashboard)/layout.tsx
const { user, logout, isAuthenticated } = useAuthStore()

useEffect(() => {
  if (mounted && !isAuthenticated) {
    router.push('/login')
  }
}, [mounted, isAuthenticated, router])
```

- `mounted` flag prevents hydration mismatch (Zustand reads from `sessionStorage`)
- Loading spinner shown while `!mounted || !isAuthenticated`
- `sessionStorage` = closing tab clears auth (auto-logout)

## Route Groups

| Group | Purpose |
|-------|---------|
| `(dashboard)` | Protected routes with shared sidebar layout |
| `admin/` | Platform Admin school & subscription management |
| `my-children/` | Parent portal for viewing children's info |
| `settings/` | School configuration (rules, years, permissions) |

## Related

- [../authentication/overview.md](../authentication/overview.md)
- [./state-management.md](./state-management.md)
- [./role-based-ui.md](./role-based-ui.md)
