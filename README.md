# CloudSchool - School Management System

Enterprise-grade multi-tenant school management system with comprehensive features for student enrollment, class management, grade tracking, and reporting.

## Overview

CloudSchool is a complete school management solution built with modern web technologies. The system supports multiple schools (multi-tenancy) with isolated data and independent configurations for each institution.

## Key Features

### Multi-tenant Architecture
- Single codebase serving multiple schools
- Complete data isolation per tenant
- Independent configurations and settings per school
- Role-based access control (Super Admin, Admin, Teacher, Parent)

### Core Functionalities

| Code | Module | Description |
|------|--------|-------------|
| BM1 | Student Enrollment | Register new students with age validation (QD1) and class capacity checks (QD2) |
| BM2 | Class Management | Manage grades and classes |
| BM3 | Student Search | Search by name, student code, or class |
| BM4 | Grade Entry | Enter grades for 15-min tests, 1-period tests, and final exams with customizable weights |
| BM5.1 | Subject Report | Statistics on pass rates by subject |
| BM5.2 | Semester Report | Comprehensive semester-wide statistics |
| QD | Settings Management | Configure age limits, class capacity, passing grade, and grade weights |

### Configurable Business Rules

- **QD1**: Student age range (default: 15-20 years)
- **QD2**: Maximum students per class (default: 40)
- **QD3**: Grade level management
- **QD4**: Subject management, grades 0-10 scale
- **QD5**: Passing grade threshold (default: 5.0)
- **Grade Weights**: 15-min test (1x), 1-period test (2x), Final exam (3x)

## Technical Stack

### Backend
- **Node.js** + **Express.js**
- **Prisma ORM** + **PostgreSQL**
- **JWT Authentication**
- RESTful API

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Zustand** (State Management)
- **React Hook Form** + **Zod** (Validation)

### DevOps
- **Docker** + **Docker Compose**
- **GitHub Actions** CI/CD
- **PostgreSQL 16**

## Installation

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 16+ (if not using Docker)

### Development Setup with Docker

```bash
# 1. Clone repository
git clone https://github.com/your-username/cloudschool.git
cd cloudschool

# 2. Start database
docker-compose -f docker-compose.dev.yml up -d

# 3. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 4. Create environment file for backend
cd backend
cp .env.example .env

# 5. Generate Prisma client and seed database
npx prisma generate
npx prisma db push --force-reset
npm run db:seed

# 6. Start backend server (port 5000)
node src/app.js

# 7. Open new terminal and start frontend (port 3000)
cd frontend
npm run dev
```

### Production Setup with Docker Compose

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit environment variables in .env

# 2. Build and run
docker-compose up -d --build

# 3. Run database migrations (first time only)
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run db:seed
```

Access points:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/health

## API Documentation

### Authentication
```
POST /api/auth/register-school    # Register new school
POST /api/auth/login              # User login
POST /api/auth/logout             # User logout
GET  /api/auth/me                 # Current user info
```

### Students (BM1, BM3)
```
GET    /api/students              # List all students
POST   /api/students              # Create new student
GET    /api/students/:id          # Get student details
PUT    /api/students/:id          # Update student
DELETE /api/students/:id          # Delete student
GET    /api/students/:id/grades   # Get student grades
```

### Classes (BM2)
```
GET    /api/classes               # List all classes
GET    /api/classes/grades        # List all grade levels
POST   /api/classes               # Create new class
GET    /api/classes/:id           # Get class details
PUT    /api/classes/:id           # Update class
DELETE /api/classes/:id           # Delete class
```

### Scores (BM4)
```
GET  /api/scores/class/:classId   # Get class grade sheet
POST /api/scores                  # Add single grade
POST /api/scores/batch            # Batch grade entry
```

### Reports (BM5)
```
GET /api/reports/subject-summary  # Subject summary report (BM5.1)
GET /api/reports/semester-summary # Semester summary report (BM5.2)
GET /api/reports/dashboard        # Dashboard statistics
```

### Parents
```
GET    /api/parents               # List all parents (Admin only)
POST   /api/parents               # Create parent account (Admin only)
POST   /api/parents/:id/students  # Link student to parent (Admin only)
DELETE /api/parents/:id/students/:studentId  # Unlink student (Admin only)
GET    /api/parents/my-children   # Get current parent's children
GET    /api/parents/my-children/:studentId/scores  # Get child's scores
```

### Settings (QD)
```
GET  /api/settings                # Get current settings
PUT  /api/settings                # Update settings
GET  /api/subjects                # List subjects
POST /api/subjects                # Create subject
```

## Project Structure

```
cloudschool/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── seed.js              # Seed data
│   ├── src/
│   │   ├── app.js               # Express app
│   │   ├── lib/
│   │   │   └── prisma.js        # Prisma client
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication
│   │   │   └── errorHandler.js  # Error handling
│   │   └── routes/
│   │       ├── auth.routes.js
│   │       ├── student.routes.js
│   │       ├── class.routes.js
│   │       ├── subject.routes.js
│   │       ├── score.routes.js
│   │       ├── report.routes.js
│   │       ├── parent.routes.js
│   │       └── settings.routes.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/     # Protected routes
│   │   │   │   ├── dashboard/
│   │   │   │   ├── students/
│   │   │   │   ├── classes/
│   │   │   │   ├── scores/
│   │   │   │   ├── reports/
│   │   │   │   ├── parents/
│   │   │   │   ├── my-children/
│   │   │   │   └── settings/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── lib/
│   │   │   ├── api.ts           # API client
│   │   │   └── utils.ts
│   │   └── store/
│   │       └── auth.ts          # Zustand store
│   ├── Dockerfile
│   └── package.json
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # GitHub Actions
├── docker-compose.yml           # Production
├── docker-compose.dev.yml       # Development
└── README.md
```

## Demo Credentials

After running the seed script, use these credentials to login:

| Role | Email | Password | Tenant Code |
|------|-------|----------|-------------|
| Admin | admin@demo.school.vn | admin123 | THPT-DEMO |
| Teacher | teacher@demo.school.vn | teacher123 | THPT-DEMO |
| Parent 1 | parent1@demo.school.vn | parent123 | THPT-DEMO |
| Parent 2 | parent2@demo.school.vn | parent123 | THPT-DEMO |

**Note**: Tenant code is required for login to ensure multi-tenant isolation.

## Environment Configuration

### Backend (.env)
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/cloudschool
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License

## Support

For issues and questions, please open a GitHub issue or contact the development team.