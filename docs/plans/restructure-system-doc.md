# Plan: Restructure System.md into Modular Documentation Framework

## Overview

The current `System.md` is a ~400-line monolithic document covering architecture, auth, database, scoring, frontend, backend, business rules, data flows, security, and deployment. This plan restructures it into a focused, navigable, and maintainable documentation system under `docs/system/`.

## Goals

- Each file ≤ 100 lines where possible (diagrams excluded)
- Single responsibility per file
- Cross-reference strategy using relative links
- Mermaid diagrams for visual clarity
- Easy to update individual sections without touching the whole spec
- Navigation README at root for discoverability

---

## Folder Structure

```
docs/system/
├── README.md                          # Overview + navigation hub
├── architecture/
│   ├── overview.md                    # High-level system diagram + component overview
│   ├── multi-tenant-model.md          # Shared DB, row-level isolation, TenantGuard
│   └── tech-stack.md                  # Backend, frontend, database, tools
├── authentication/
│   ├── overview.md                    # JWT cookie-based auth flow
│   ├── roles-permissions.md           # 6-role permission matrix (2 tables)
│   ├── middleware-chain.md            # authenticate → authorize → tenantGuard
│   └── login-flows.md                 # School login vs Platform Admin login
├── database/
│   ├── schema-overview.md             # ERD + relationship summary
│   ├── models/                        # Individual model docs
│   │   ├── tenant-and-settings.md     # Tenant + TenantSettings
│   │   ├── user-and-roles.md          # User model + role enum
│   │   ├── academic-structure.md      # Grade, Class, Subject, Semester
│   │   ├── student.md                 # Student model + validation rules
│   │   ├── scoring.md                 # ScoreComponent, Score, Promotion
│   │   ├── parent-student.md          # ParentStudent join table
│   │   └── activity-log.md            # ActivityLog for audit trail
│   └── indexes-performance.md         # Unique constraints, query performance notes
├── scoring-system/
│   ├── score-components.md            # Weight system, total ≤ 100% rule
│   ├── weighted-calculation.md        # ĐTB formula + worked example
│   ├── lock-unlock.md                 # Score locking mechanism
│   └── promotion-calculation.md       # Automated promotion logic
├── frontend/
│   ├── routing-structure.md           # Next.js route tree
│   ├── state-management.md            # Zustand auth store
│   ├── api-client.md                  # Axios setup + 18 API modules
│   └── role-based-ui.md               # Sidebar menu per role (matrix table)
├── backend/
│   ├── middleware.md                  # Detailed middleware implementations
│   ├── error-handling.md              # Global error handler + error codes
│   ├── route-logic-highlights.md      # Student admission, score entry, promotion
│   └── api-endpoints.md               # Endpoint inventory by group
├── business-rules/
│   ├── regulations.md                 # QD1-QD6 table + descriptions
│   └── validations.md                 # Input validation + business logic protections
├── security/
│   ├── authentication-security.md     # bcrypt, JWT, cookie config
│   ├── tenant-isolation.md            # Query-level tenant enforcement
│   ├── input-validation.md            # express-validator, Zod, CSV injection
│   └── business-logic-protections.md  # Race conditions, delete guards, escalation prevention
├── data-flows/
│   ├── registration-flow.md           # School registration sequence
│   ├── score-entry-flow.md            # Teacher score entry workflow
│   └── parent-viewing-flow.md         # Parent viewing child scores
└── deployment/
    ├── environment-variables.md       # Backend + frontend env vars
    ├── docker-setup.md                # Docker Compose, Prisma migrate
    └── ports-services.md              # Port assignments + service descriptions
```

**Total: 33 files** (avg ~40-80 lines each vs. current single 400-line file)

---

## File Descriptions

### `docs/system/README.md` (~40 lines)
- System name + one-line description
- Architecture diagram (Mermaid) — condensed version of current diagram
- Quick navigation links to all sections
- "Last updated" date
- Link to project overview PDR if exists

### Architecture Section
| File | Content | Diagrams |
|------|---------|----------|
| `overview.md` | High-level 3-tier architecture (Frontend → Backend → DB), component responsibilities | 3-tier architecture diagram |
| `multi-tenant-model.md` | Shared DB strategy, row-level `tenantId` isolation, TenantGuard middleware behavior, Platform Admin cross-tenant access | Tenant isolation flow diagram |
| `tech-stack.md` | Next.js 14, Express.js 5, PostgreSQL, Prisma ORM, Zustand, Axios, Docker — with versions and rationale | Tech stack table |

### Authentication Section
| File | Content | Diagrams |
|------|---------|----------|
| `overview.md` | JWT cookie-based auth, cookie config (`httpOnly`, `secure`, `sameSite`, `maxAge`), token structure | Auth lifecycle sequence |
| `roles-permissions.md` | 6 roles (PLATFORM_ADMIN, SUPER_ADMIN, STAFF, TEACHER, STUDENT, PARENT), two permission matrix tables (endpoint groups + sidebar menu) | Permission matrix tables |
| `middleware-chain.md` | Detailed `authenticate`, `authorize`, `tenantGuard` implementations with pseudocode | Middleware chain flow diagram |
| `login-flows.md` | School login (with `tenantCode`) vs Platform Admin login (no `tenantCode`), step-by-step flows | Two parallel login flow diagrams |

### Database Section
| File | Content | Diagrams |
|------|---------|----------|
| `schema-overview.md` | Full ERD, relationship cardinality, shared DB strategy | Mermaid ERD |
| `models/*.md` | Each model: fields, constraints, business rules, relationships | Relationship mini-diagrams where useful |
| `indexes-performance.md` | Unique constraints (`email+tenantId`, `name+tenantId+academicYear`, `studentId+scoreComponentId+semesterId`), query optimization notes, Prisma include strategies | Constraint table |

### Scoring System Section
| File | Content | Diagrams |
|------|---------|----------|
| `score-components.md` | Component types, weight system, Σ weight ≤ 100 validation, per-subject configuration | Weight distribution example table |
| `weighted-calculation.md` | ĐTB formula, worked example (Toán: 8×10 + 7×20 + 6×30 + 7×40) / 100 = 6.8 | Formula breakdown |
| `lock-unlock.md` | Score locking mechanism, who can lock (SUPER_ADMIN, STAFF), frontend behavior (disable inputs, lock icon) | Lock state flow |
| `promotion-calculation.md` | Automated promotion: input → calculation → result (PASS/FAIL), comparison with `passScore`, upsert to Promotion table | Promotion calculation flow |

### Frontend Section
| File | Content | Diagrams |
|------|---------|----------|
| `routing-structure.md` | Next.js route tree, protected routes, role-based layout | Route tree diagram |
| `state-management.md` | Zustand auth store (`user`, `token`, `isAuthenticated`), `sessionStorage` persistence, logout behavior | Store interface code block |
| `api-client.md` | Axios config (`withCredentials`), response interceptor (401 → logout), Blob error handling, 18 API module list | Module list table |
| `role-based-ui.md` | Sidebar menu visibility per role (matrix table), conditional rendering patterns | Role-menu matrix table |

### Backend Section
| File | Content | Diagrams |
|------|---------|----------|
| `middleware.md` | Full `authenticate`, `authorize`, `tenantGuard` implementations, error codes returned | Pseudocode blocks |
| `error-handling.md` | Global error handler: Prisma errors (P2002, P2025), ValidationError, JWT errors, AppError, unknown errors → mapped HTTP status | Error mapping table |
| `route-logic-highlights.md` | Student admission validation, batch score entry, teacher class assignment check, promotion calculation | Flow diagrams per operation |
| `api-endpoints.md` | Endpoint inventory grouped by domain (auth, users, students, classes, subjects, scores, promotion, reports, parents, settings, tenant) | Endpoint table with methods + roles |

### Business Rules Section
| File | Content | Diagrams |
|------|---------|----------|
| `regulations.md` | QD1-QD6 table with defaults, configuration paths, enforcement points | Regulation table |
| `validations.md` | All business logic protections: race condition prevention, delete guards, capacity guards, academic year overlap check, role escalation prevention, passScore range, scoreComponent-subject validation, tenant verification, max retention scoping, ranking edge cases, cache invalidation | Validation checklist |

### Security Section
| File | Content | Diagrams |
|------|---------|----------|
| `authentication-security.md` | bcrypt (10 rounds), JWT config, cookie security flags, token expiry, logout cookie clearing | Security config table |
| `tenant-isolation.md` | Query-level `tenantId` enforcement, TenantGuard behavior, Platform Admin exceptions, prevention of cross-tenant data leaks | Isolation enforcement diagram |
| `input-validation.md` | express-validator (backend), Zod (frontend), Prisma type safety, CSV formula injection prevention, X-Content-Type-Options, CSP headers | Validation layers diagram |
| `business-logic-protections.md` | Race condition prevention (Serializable isolation), student/fee delete guards, capacity guard, academic year overlap, role escalation prevention, passScore range, scoreComponent-subject validation, tenant verification | Protection matrix |

### Data Flows Section
| File | Content | Diagrams |
|------|---------|----------|
| `registration-flow.md` | School registration: /register → POST /api/auth/register-school → Tenant + TenantSettings + SUPER_ADMIN user → JWT → redirect | Sequence diagram |
| `score-entry-flow.md` | Teacher score entry: select class → subject → semester → GET scores → input → POST batch → upsert | Sequence diagram |
| `parent-viewing-flow.md` | Parent login → /my-children → GET children list → select child → GET scores → display | Sequence diagram |

### Deployment Section
| File | Content | Diagrams |
|------|---------|----------|
| `environment-variables.md` | Backend env vars (PORT, NODE_ENV, DATABASE_URL, JWT_SECRET, CORS_ORIGIN, COOKIE_SECURE, TZ_OFFSET_HOURS, RATE_LIMIT_BYPASS_SECRET), Frontend env vars (NEXT_PUBLIC_API_URL) | Env var tables |
| `docker-setup.md` | Docker Compose commands, Prisma migrate deploy, initial seed, production vs dev compose files | Deployment steps |
| `ports-services.md` | Frontend: 3000, Backend: 5000, PostgreSQL: 5432 — with descriptions and external access notes | Port table |

---

## Cross-Reference Strategy

### Naming Convention
- Use relative paths: `../authentication/middleware-chain.md`
- Anchor links for sections: `../database/models/tenant-and-settings.md#tenantsettings`
- Descriptive link text: "See [TenantGuard middleware](../authentication/middleware-chain.md#tenantGuard) for details"

### Key Cross-References

| Source | References |
|--------|-----------|
| `architecture/overview.md` | → `multi-tenant-model.md`, `tech-stack.md` |
| `authentication/middleware-chain.md` | → `security/tenant-isolation.md`, `backend/middleware.md` |
| `database/schema-overview.md` | → All `models/*.md` files, `indexes-performance.md` |
| `database/models/student.md` | → `business-rules/regulations.md#qd1-qd2` |
| `scoring-system/weighted-calculation.md` | → `promotion-calculation.md`, `database/models/scoring.md` |
| `backend/route-logic-highlights.md` | → `scoring-system/*.md`, `business-rules/validations.md` |
| `data-flows/score-entry-flow.md` | → `backend/route-logic-highlights.md#score-entry`, `scoring-system/lock-unlock.md` |
| `security/business-logic-protections.md` | → `business-rules/validations.md` (bidirectional) |
| `frontend/api-client.md` | → `backend/api-endpoints.md` |

### Backlink Strategy
Each file ends with a "Related" section listing files that reference it:
```markdown
## Related
- [Authentication Overview](../authentication/overview.md)
- [Tenant Isolation](../security/tenant-isolation.md)
```

---

## Mermaid Diagram Plan

| File | Diagram Type | Purpose |
|------|-------------|---------|
| `architecture/overview.md` | `graph TD` | 3-tier system architecture |
| `authentication/overview.md` | `sequenceDiagram` | Auth lifecycle |
| `authentication/middleware-chain.md` | `sequenceDiagram` | Request → authenticate → authorize → tenantGuard → handler |
| `authentication/login-flows.md` | `sequenceDiagram` (×2) | School login + Platform Admin login |
| `database/schema-overview.md` | `erDiagram` | Entity relationships |
| `scoring-system/promotion-calculation.md` | `flowchart TD` | Promotion calculation steps |
| `data-flows/registration-flow.md` | `sequenceDiagram` | School registration sequence |
| `data-flows/score-entry-flow.md` | `sequenceDiagram` | Score entry workflow |
| `data-flows/parent-viewing-flow.md` | `sequenceDiagram` | Parent viewing sequence |
| `security/tenant-isolation.md` | `flowchart LR` | Tenant isolation enforcement |

---

## Implementation Steps

### Phase 1: Scaffold Structure (Day 1)
1. Create folder structure: `mkdir -p docs/system/{architecture,authentication/database/{models},scoring-system,frontend,backend,business-rules,security,data-flows,deployment}`
2. Create empty `README.md` with navigation skeleton
3. Verify all paths resolve correctly

**Effort:** ~30 minutes

### Phase 2: Extract Architecture Section (Day 1)
1. `architecture/overview.md` — Extract 3-tier diagram + component descriptions from System.md §1
2. `architecture/multi-tenant-model.md` — Extract multi-tenant model details
3. `architecture/tech-stack.md` — Compile tech stack from diagrams + env vars

**Effort:** ~1 hour

### Phase 3: Extract Authentication Section (Day 1)
1. `authentication/overview.md` — JWT cookie flow from §2.2
2. `authentication/roles-permissions.md` — Two permission matrices from §2.4 + §5.2
3. `authentication/middleware-chain.md` — Middleware chain from §2.3 + §6.1
4. `authentication/login-flows.md` — Login flows from §2.1

**Effort:** ~1.5 hours

### Phase 4: Extract Database Section (Day 2)
1. `database/schema-overview.md` — ERD from §3.1
2. `database/models/*.md` — Split §3.2 into 7 focused model files
3. `database/indexes-performance.md` — Compile unique constraints from throughout §3

**Effort:** ~2 hours

### Phase 5: Extract Scoring System Section (Day 2)
1. `scoring-system/score-components.md` — §4.1
2. `scoring-system/weighted-calculation.md` — §4.2 with formula
3. `scoring-system/lock-unlock.md` — §4.4
4. `scoring-system/promotion-calculation.md` — §4.3

**Effort:** ~1 hour

### Phase 6: Extract Frontend Section (Day 2)
1. `frontend/routing-structure.md` — §5.1 route tree
2. `frontend/state-management.md` — §5.3 Zustand store
3. `frontend/api-client.md` — §5.4 Axios setup
4. `frontend/role-based-ui.md` — §5.2 sidebar menu matrix

**Effort:** ~1 hour

### Phase 7: Extract Backend Section (Day 3)
1. `backend/middleware.md` — Detailed middleware from §6.1
2. `backend/error-handling.md` — §6.2 error mapping
3. `backend/route-logic-highlights.md` — §6.3 route logic
4. `backend/api-endpoints.md` — Compile endpoint inventory from permission matrix + route logic

**Effort:** ~1.5 hours

### Phase 8: Extract Business Rules & Security (Day 3)
1. `business-rules/regulations.md` — §7 QD table
2. `business-rules/validations.md` — §9.5 business logic protections
3. `security/authentication-security.md` — §9.1
4. `security/tenant-isolation.md` — Derived from §2.3 + §9.2
5. `security/input-validation.md` — §9.3 + §9.4 (headers, CSP, CSV injection)
6. `security/business-logic-protections.md` — §9.5 expanded

**Effort:** ~1.5 hours

### Phase 9: Extract Data Flows (Day 3)
1. `data-flows/registration-flow.md` — §8.1
2. `data-flows/score-entry-flow.md` — §8.2
3. `data-flows/parent-viewing-flow.md` — §8.3

**Effort:** ~45 minutes

### Phase 10: Extract Deployment Section (Day 3)
1. `deployment/environment-variables.md` — §10 env vars
2. `deployment/docker-setup.md` — §10 Docker commands
3. `deployment/ports-services.md` — §10 ports

**Effort:** ~30 minutes

### Phase 11: Cross-References & Polish (Day 4)
1. Add "Related" sections to all files
2. Verify all internal links resolve
3. Add Mermaid diagrams to designated files
4. Ensure all files ≤ 100 lines (excluding diagrams/code blocks)
5. Update `docs/system/README.md` with complete navigation
6. Create symlink or redirect from old `System.md` → `docs/system/README.md`

**Effort:** ~2 hours

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Links broken during split | Validate all relative paths with markdown link checker |
| Information lost in restructuring | Cross-check each section against original System.md |
| Files still too long after split | Further subdivide models/ or split validations.md |
| Outdated content propagated | Add "Last reviewed" date to each file |
| Duplication across files | Use cross-references instead of repeating content |

## Success Criteria

- ✅ All 33 files created with content
- ✅ No file exceeds 100 lines (excluding diagrams/code blocks)
- ✅ All cross-links resolve correctly
- ✅ At least 10 Mermaid diagrams added
- ✅ Navigation README provides complete discoverability
- ✅ Old System.md deprecated with redirect notice
- ✅ Each file is independently updateable

## Estimated Total Effort

- **~10-12 hours** across 4 days
- Can be parallelized: Phase 2-4 independent, Phase 5-7 independent

---

## Unresolved Questions

1. Should `System.md` be deleted after migration, or kept as a redirect stub with a link to `docs/system/README.md`?
2. Should model docs in `database/models/` use kebab-case filenames matching Prisma model names (e.g., `score-component.md` vs `scoring.md` combining ScoreComponent + Score + Promotion)?
3. Should API endpoint inventory (`backend/api-endpoints.md`) be auto-generated from route definitions instead of manually maintained?
4. Any preference for diagram tooling — Mermaid only, or also support PlantUML/Excalidraw embeddings?
5. Should the `docs/system/` folder have its own `CODEOWNERS` or review process for changes?
