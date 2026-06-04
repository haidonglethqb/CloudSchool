# Role-Based UI & Menu

## Menu Visibility by Role

| Menu | PLATFORM_ADMIN | SUPER_ADMIN | STAFF | TEACHER | STUDENT | PARENT |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| Tá»•ng quan (Dashboard) | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| Quáº£n lÃ½ trÆ°á»ng | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ |
| GÃ³i Ä‘Äƒng kÃ½ | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ |
| GiÃ¡m sÃ¡t há»‡ thá»‘ng | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ |
| Nháº­t kÃ½ hoáº¡t Ä‘á»™ng | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ |
| Quáº£n lÃ½ ngÆ°á»i dÃ¹ng | âŒ | âœ… | âŒ | âŒ | âŒ | âŒ |
| Tiáº¿p nháº­n HS | âŒ | âœ… | âœ…* | âŒ | âŒ | âŒ |
| Tra cá»©u HS | âŒ | âœ… | âœ…* | âœ…* | âŒ | âŒ |
| Danh sÃ¡ch lá»›p | âŒ | âœ… | âœ…* | âœ…* | âŒ | âŒ |
| MÃ´n há»c | âŒ | âœ… | âœ…* | âŒ | âŒ | âŒ |
| Nháº­p Ä‘iá»ƒm | âŒ | âœ… | âœ…* | âœ…* | âŒ | âŒ |
| XÃ©t lÃªn lá»›p | âŒ | âœ… | âœ…* | âŒ | âŒ | âŒ |
| BÃ¡o cÃ¡o | âŒ | âœ… | âœ…* | âœ…* | âŒ | âŒ |
| Quáº£n lÃ½ Phá»¥ huynh | âŒ | âœ… | âœ…* | âŒ | âŒ | âŒ |
| Quáº£n lÃ½ há»c phÃ­ | âŒ | âœ… | âœ…* | âŒ | âŒ | âœ… |
| Quy Ä‘á»‹nh | âŒ | âœ… | âŒ | âŒ | âŒ | âŒ |
| NÄƒm há»c | âŒ | âœ… | âŒ | âŒ | âŒ | âŒ |
| PhÃ¢n quyá»n | âŒ | âœ… | âŒ | âŒ | âŒ | âŒ |
| Xuáº¥t dá»¯ liá»‡u | âŒ | âŒ | âœ…* | âŒ | âŒ | âŒ |
| Xem Ä‘iá»ƒm | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ |
| Con em cá»§a tÃ´i | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |

*`*` = filtered by role permissions from `settingsApi.getRolePermissions()`

## Role â†’ Menu Mapping

```tsx
// frontend/src/app/(dashboard)/layout.tsx
switch (user?.role) {
  case 'PLATFORM_ADMIN': items = platformAdminMenu; break
  case 'SUPER_ADMIN':    items = superAdminMenu;    break
  case 'STAFF':          items = staffMenu;          break
  case 'TEACHER':        items = teacherMenu;        break
  case 'STUDENT':        items = studentMenu;        break
  case 'PARENT':         items = parentMenu;         break
}
```

## Permission Filtering (STAFF / TEACHER)

```ts
// Filter menu items by allowed modules from backend
const allowed = rolePermissions[user.role] || []
items = items.filter(item => !item.module || allowed.includes(item.module))
```

- `module` field on each menu item maps to a permission key
- SUPER_ADMIN bypasses permission filtering (full access)
- If permissions fail to load â†’ fallback: show all items
- Teacher permission UI only shows backend-supported modules: student lookup, classes, subjects, scores, reports.
- STAFF users with class/subject assignments see scoped academic data; STAFF without assignments keep module-level access.

## Architecture

```mermaid
flowchart TD
    A[Login] --> B[AuthStore.setAuth]
    B --> C{user.role}
    C -->|PLATFORM_ADMIN| D[platformAdminMenu]
    C -->|SUPER_ADMIN| E[superAdminMenu â€” no filter]
    C -->|STAFF| F[staffMenu â€” filter by permissions]
    C -->|TEACHER| G[teacherMenu â€” filter by permissions]
    C -->|STUDENT| H[studentMenu]
    C -->|PARENT| I[parentMenu]
    F --> J[settingsApi.getRolePermissions]
    G --> J
    J --> K[Filter menuItems by module]
    D --> L[Render Sidebar]
    E --> L
    K --> L
    H --> L
    I --> L
```

## Role Summary

| Role | Portal | Key Differentiator |
|------|--------|-------------------|
| PLATFORM_ADMIN | Separate school management | Manages schools, subscriptions, monitoring |
| SUPER_ADMIN | Full school access | Unrestricted school-level management |
| STAFF | Permission-filtered | Configurable module access |
| TEACHER | Permission-filtered | Class & score focused |
| STUDENT | Read-only | "Xem Ä‘iá»ƒm" (My Scores) only |
| PARENT | Read-only | "Con em cá»§a tÃ´i" (My Children) |

## 2026 UI Updates

- Teacher dashboard now shows compact basic cards + shortcuts only.
- Teacher `/classes` is treated as **Lá»›p cá»§a tÃ´i** (assigned classes only, card view, quick links to class detail and score entry).
- Class detail for teacher now hides class-management actions (edit class, add/edit student) and handles `403/404` by toast + redirect/fallback instead of blank screen.
- `/scores` supports deep-link query prefill (`classId`, `subjectId`, `semesterId`) for teacher quick navigation.
- SUPER_ADMIN sidebar now has a dedicated `/promotion` entry; promotion workflow moved out of `/reports`.
- Teacher sidebar can show `MÃ´n há»c` when `subjects` is enabled for Teacher.
- `/promotion` now shows graduate details, failed-student pending placement, placement history, inactive reason, and target-class creation confirmation.
- `/reports`, `/settings`, and `/settings/permissions` were compacted to reduce empty space and improve operator readability.
- `/reports` now uses Vietnamese labels, global year/semester filters, year-scoped semester options, lightweight CSS/SVG charts, and report-scoped API calls so TEACHER users do not need academic-calendar permission.

## Quy Æ°á»›c copy tiáº¿ng Viá»‡t

- ToÃ n bá»™ text hiá»ƒn thá»‹ UI pháº£i dÃ¹ng tiáº¿ng Viá»‡t cÃ³ dáº¥u Ä‘áº§y Ä‘á»§.
- Thuáº­t ngá»¯ chuáº©n cáº§n thá»‘ng nháº¥t: Há»c ká»³, NÄƒm há»c, BÃ¡o cÃ¡o, Quy Ä‘á»‹nh, PhÃ¢n quyá»n, XÃ©t lÃªn lá»›p.
- KhÃ´ng dÃ¹ng biáº¿n thá»ƒ khÃ´ng dáº¥u nhÆ° Hoc ky, Nam hoc, Bao cao, Quy dinh, Phan quyen.
- Chuá»—i lá»—i hiá»ƒn thá»‹ cho ngÆ°á»i dÃ¹ng cáº§n Æ°u tiÃªn map theo `error.code` táº¡i frontend, khÃ´ng phá»¥ thuá»™c hoÃ n toÃ n vÃ o message thÃ´ tá»« backend.
- KhÃ´ng Ä‘á»•i khÃ³a ká»¹ thuáº­t (module key, role key, route/API params); chá»‰ chuáº©n hÃ³a lá»›p hiá»ƒn thá»‹.

## Related

- [./state-management.md](./state-management.md) â€” `User` type and `UserRole` definition
- [./routing-structure.md](./routing-structure.md) â€” Route structure behind each menu item
- [../authentication/roles-permissions.md](../authentication/roles-permissions.md) â€” Backend role definitions
