# Technology Stack

> Technologies and tools used in CloudSchool.

## Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | >= 18 | Runtime environment |
| **Express.js** | 5.2.1 | Web framework, REST API |
| **Prisma ORM** | 5.22.0 | Database ORM, type-safe queries |
| **PostgreSQL** | 16-alpine | Primary database |
| **bcryptjs** | 3.0.3 | Password hashing (10 rounds) |
| **jsonwebtoken** | 9.0.3 | JWT token generation/verification |
| **cookie-parser** | 1.4.7 | httpOnly cookie parsing |
| **express-validator** | 7.3.1 | Input validation |
| **helmet** | 8.1.0 | Security headers (CSP, etc.) |
| **express-rate-limit** | 8.3.1 | Rate limiting |
| **lru-cache** | 11.2.7 | In-memory caching |
| **cors** | 2.8.6 | CORS middleware |
| **morgan** | 1.10.1 | HTTP request logging |
| **dotenv** | 17.3.1 | Environment variables |
| **exceljs** | 4.4.0 | Excel export |
| **json2csv** | 6.0.0-alpha.2 | CSV export |

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.7 | React framework (App Router) |
| **React** | 18.3.1 | UI library |
| **TypeScript** | 5.5.4 | Type safety |
| **Tailwind CSS** | 3.4.10 | Utility-first CSS |
| **Zustand** | 4.5.5 | State management |
| **Axios** | 1.7.7 | HTTP client with interceptors |
| **React Hook Form** | 7.53.0 | Form handling |
| **Zod** | 3.23.8 | Schema validation |
| **Lucide React** | 0.439.0 | Icon library |
| **date-fns** | 3.6.0 | Date formatting |
| **react-hot-toast** | 2.4.1 | Toast notifications |
| **clsx** | 2.1.1 | Conditional className |
| **tailwind-merge** | 2.5.2 | Tailwind class merging |

## DevOps & Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **GitHub Container Registry** | Docker image hosting |

## Development Tools

| Tool | Purpose |
|------|---------|
| **nodemon** | Auto-restart on file changes |
| **Prisma Studio** | Database GUI |
| **ESLint** | Code linting |
| **Playwright** | E2E/API testing |

## Code Style

- **Standard.js** conventions
- No semicolons, 2-space indent, single quotes
- Kebab-case file naming

## Related
- [Architecture Overview](overview.md)
- [Docker Setup](../deployment/docker-setup.md)
