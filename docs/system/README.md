# CloudSchool System Documentation

> Modular documentation framework for the CloudSchool multi-tenant school management system.

## Overview

CloudSchool is a **Multi-Tenant SaaS** platform enabling multiple schools to operate on a single infrastructure with complete data isolation and role-based access control.

**Tech Stack**: Node.js/Express + Prisma + PostgreSQL | Next.js 14 | Docker

## Navigation

### System Architecture
- [Architecture Overview](architecture/overview.md) — Multi-tenant SaaS architecture, component diagram
- [Multi-Tenant Model](architecture/multi-tenant-model.md) — Tenant isolation, shared database, row-level security
- [Technology Stack](architecture/tech-stack.md) — Backend, frontend, DevOps tools and versions

### Authentication & Authorization
- [Authentication Overview](authentication/overview.md) — JWT cookie-based auth, token lifecycle
- [Roles & Permissions](authentication/roles-permissions.md) — 6-role matrix, permission breakdown
- [Middleware Chain](authentication/middleware-chain.md) — authenticate → authorize → tenantGuard
- [Login Flows](authentication/login-flows.md) — School login, platform admin login, registration

### Database
- [Schema Overview](database/schema-overview.md) — ERD, model relationships, key constraints
- [Platform Models](database/platform-models.md) — SubscriptionPlan, Tenant, TenantSettings
- [User Models](database/user-models.md) — User, ParentStudent relationships
- [Academic Structure](database/academic-structure.md) — Grade, Class, Subject, Semester, AcademicYear
- [Scoring Models](database/scoring-models.md) — Score, ScoreComponent, Promotion
- [Fee Management](database/fee-models.md) — Fee, StudentFee
- [Tracking Models](database/tracking-models.md) — ActivityLog, TransferHistory, ClassEnrollment
- [Indexes & Performance](database/indexes-performance.md) — Database indexes, query optimization

### Scoring System
- [Score Components](scoring-system/score-components.md) — Configurable score components with weights
- [Weighted Calculation](scoring-system/weighted-calculation.md) — ĐTB formula, examples
- [Lock & Unlock](scoring-system/lock-unlock.md) — Score locking mechanism, permissions
- [Promotion Calculation](scoring-system/promotion-calculation.md) — Auto-calculate pass/fail/retake

### Frontend Architecture
- [Routing Structure](frontend/routing-structure.md) — Next.js App Router, protected routes
- [State Management](frontend/state-management.md) — Zustand store, sessionStorage persistence
- [API Client](frontend/api-client.md) — Axios configuration, interceptors, error handling
- [Role-Based UI](frontend/role-based-ui.md) — Dynamic sidebar, menu visibility per role

### Backend Architecture
- [Middleware](backend/middleware.md) — Auth, authorization, tenant guard, error handling
- [Error Handling](backend/error-handling.md) — Global error handler, Prisma errors, validation
- [Route Logic](backend/route-logic.md) — Key route implementations, business logic
- [API Endpoints](backend/api-endpoints.md) — Complete endpoint reference

### Business Rules
- [Regulations](business-rules/regulations.md) — QD1-QD6, configurable school rules
- [Validations](business-rules/validations.md) — Input validation, business logic checks

### Security
- [Authentication Security](security/authentication-security.md) — JWT, bcrypt, cookie security
- [Tenant Isolation](security/tenant-isolation.md) — Row-level security, cross-query prevention
- [Input Validation](security/input-validation.md) — express-validator, Zod, sanitization
- [Business Logic Protections](security/business-logic-protections.md) — Race conditions, delete guards

### Data Flows
- [Registration Flow](data-flows/registration-flow.md) — School registration, account creation
- [Score Entry Flow](data-flows/score-entry-flow.md) — Teacher/staff score entry workflow
- [Parent Viewing Flow](data-flows/parent-viewing-flow.md) — Parent accessing children's scores

### Deployment
- [Environment Variables](deployment/environment-variables.md) — Backend and frontend env configuration
- [Docker Setup](deployment/docker-setup.md) — Docker Compose, container orchestration
- [Ports & Services](deployment/ports-services.md) — Port mappings, service dependencies

## Related Documentation
- [Project Overview PDR](../project-overview-pdr.md) — Product requirements
- [Code Standards](../code-standards.md) — Coding conventions
- [System Architecture](../system-architecture.md) — High-level architecture
- [Deployment Guide](../deployment-guide.md) — Production deployment
