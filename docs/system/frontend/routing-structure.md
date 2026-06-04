# Next.js App Router Structure

## Route Tree

```
frontend/src/app/
â”œâ”€â”€ layout.tsx              # Root layout (Toaster, global CSS)
â”œâ”€â”€ login/page.tsx          # School/Platform Admin login
â”œâ”€â”€ register/page.tsx       # School registration
â””â”€â”€ (dashboard)/            # Route group â€” shared layout
    â”œâ”€â”€ layout.tsx          # Auth guard + sidebar + menu
    â”œâ”€â”€ dashboard/page.tsx  # Home dashboard
    â”œâ”€â”€ admin/
    â”‚   â”œâ”€â”€ schools/page.tsx
    â”‚   â”œâ”€â”€ subscriptions/page.tsx
    â”‚   â”œâ”€â”€ monitoring/page.tsx
    â”‚   â””â”€â”€ activity-logs/page.tsx
    â”œâ”€â”€ users/page.tsx
    â”œâ”€â”€ students/
    â”‚   â”œâ”€â”€ new/page.tsx
    â”‚   â””â”€â”€ page.tsx        # Student search
    â”œâ”€â”€ classes/page.tsx
    â”œâ”€â”€ subjects/page.tsx
    â”œâ”€â”€ scores/page.tsx
    â”œâ”€â”€ promotion/page.tsx
    â”œâ”€â”€ reports/page.tsx
    â”œâ”€â”€ parents/page.tsx
    â”œâ”€â”€ settings/
    â”‚   â”œâ”€â”€ page.tsx
    â”‚   â”œâ”€â”€ academic-years/page.tsx
    â”‚   â””â”€â”€ permissions/page.tsx
    â”œâ”€â”€ my-children/
    â”‚   â”œâ”€â”€ page.tsx
    â””â”€â”€ my-scores/page.tsx
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
