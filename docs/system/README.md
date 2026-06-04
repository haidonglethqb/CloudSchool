# CloudSchool System Documentation

> Modular documentation framework for the CloudSchool multi-tenant school management system.

## Overview

CloudSchool is a **Multi-Tenant SaaS** platform enabling multiple schools to operate on a single infrastructure with complete data isolation and role-based access control.

**Tech Stack**: Node.js/Express + Prisma + PostgreSQL | Next.js 14 | Docker

## Navigation

### System Architecture
- [Architecture Overview](architecture/overview.md) â€” Multi-tenant SaaS architecture, component diagram
- [Multi-Tenant Model](architecture/multi-tenant-model.md) â€” Tenant isolation, shared database, row-level security
- [Technology Stack](architecture/tech-stack.md) â€” Backend, frontend, DevOps tools and versions

### Authentication & Authorization
- [Authentication Overview](authentication/overview.md) â€” JWT cookie-based auth, token lifecycle
- [Roles & Permissions](authentication/roles-permissions.md) â€” 6-role matrix, permission breakdown
- [Middleware Chain](authentication/middleware-chain.md) â€” authenticate â†’ authorize â†’ tenantGuard
- [Login Flows](authentication/login-flows.md) â€” School login, platform admin login, registration

### Database
- [Schema Overview](database/schema-overview.md) â€” ERD, model relationships, key constraints
- [Platform Models](database/platform-models.md) â€” SubscriptionPlan, Tenant, TenantSettings
- [User Models](database/user-models.md) â€” User, ParentStudent relationships
- [Academic Structure](database/academic-structure.md) â€” Grade, Class, Subject, Semester, AcademicYear
- [Scoring Models](database/scoring-models.md) â€” Score, ScoreComponent, Promotion
- [Tracking Models](database/tracking-models.md) â€” ActivityLog, TransferHistory, ClassEnrollment
- [Indexes & Performance](database/indexes-performance.md) â€” Database indexes, query optimization

### Scoring System
- [Score Components](scoring-system/score-components.md) â€” Configurable score components with weights
- [Weighted Calculation](scoring-system/weighted-calculation.md) â€” ÄTB formula, examples
- [Lock & Unlock](scoring-system/lock-unlock.md) â€” Score locking mechanism, permissions
- [Promotion Calculation](scoring-system/promotion-calculation.md) â€” Auto-calculate pass/fail/retake

### Frontend Architecture
- [Routing Structure](frontend/routing-structure.md) â€” Next.js App Router, protected routes
- [State Management](frontend/state-management.md) â€” Zustand store, sessionStorage persistence
- [API Client](frontend/api-client.md) â€” Axios configuration, interceptors, error handling
- [Role-Based UI](frontend/role-based-ui.md) â€” Dynamic sidebar, menu visibility per role

### Backend Architecture
- [Middleware](backend/middleware.md) â€” Auth, authorization, tenant guard, error handling
- [Error Handling](backend/error-handling.md) â€” Global error handler, Prisma errors, validation
- [Route Logic](backend/route-logic.md) â€” Key route implementations, business logic
- [API Endpoints](backend/api-endpoints.md) â€” Complete endpoint reference

### Business Rules
- [Regulations](business-rules/regulations.md) â€” QD1-QD6, configurable school rules
- [Validations](business-rules/validations.md) â€” Input validation, business logic checks

### Security
- [Authentication Security](security/authentication-security.md) â€” JWT, bcrypt, cookie security
- [Tenant Isolation](security/tenant-isolation.md) â€” Row-level security, cross-query prevention
- [Input Validation](security/input-validation.md) â€” express-validator, Zod, sanitization
- [Business Logic Protections](security/business-logic-protections.md) â€” Race conditions, delete guards

### Data Flows
- [Registration Flow](data-flows/registration-flow.md) â€” School registration, account creation
- [Score Entry Flow](data-flows/score-entry-flow.md) â€” Teacher/staff score entry workflow
- [Parent Viewing Flow](data-flows/parent-viewing-flow.md) â€” Parent accessing children's scores

### Deployment
- [Environment Variables](deployment/environment-variables.md) â€” Backend and frontend env configuration
- [Docker Setup](deployment/docker-setup.md) â€” Docker Compose, container orchestration
- [Ports & Services](deployment/ports-services.md) â€” Port mappings, service dependencies

## Related Documentation
- [Project Overview PDR](../project-overview-pdr.md) â€” Product requirements
- [Code Standards](../code-standards.md) â€” Coding conventions
- [System Architecture](../system-architecture.md) â€” High-level architecture
- [Deployment Guide](../deployment-guide.md) â€” Production deployment
