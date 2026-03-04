# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

CloudSchool is a multi-tenant school management system with two services: a **backend** (Express.js + Prisma + PostgreSQL on port 5000) and a **frontend** (Next.js 14 on port 3000). See `README.md` for full documentation including API endpoints and demo credentials.

### Services

| Service | Directory | Dev command | Port |
|---------|-----------|-------------|------|
| PostgreSQL | (Docker) | `sudo docker compose -f docker-compose.dev.yml up -d` | 5432 |
| Backend API | `backend/` | `node src/app.js` (or `npm run dev` for nodemon) | 5000 |
| Frontend | `frontend/` | `npm run dev` | 3000 |

### Starting the dev environment

1. **Start Docker daemon** (if not already running): `sudo dockerd &>/dev/null &` — wait ~3s for it to initialize.
2. **Start PostgreSQL**: `sudo docker compose -f docker-compose.dev.yml up -d` from the repo root.
3. **Backend setup** (first time only): `cd backend && cp .env.example .env` — then fix the DB password in `DATABASE_URL` from `postgres` to `postgres123` to match the Docker Compose config.
4. **Prisma** (first time or after schema changes): `cd backend && npx prisma generate && npx prisma db push --force-reset && npm run db:seed`.
5. **Start backend**: `cd backend && node src/app.js` (port 5000). Health check: `curl http://localhost:5000/health`.
6. **Start frontend**: `cd frontend && npm run dev` (port 3000).

### Non-obvious gotchas

- The `backend/.env.example` has the DB password as `postgres`, but `docker-compose.dev.yml` sets it to `postgres123`. You must use `postgres123` in `DATABASE_URL`.
- Frontend ESLint requires `.eslintrc.json` to exist (otherwise `next lint` prompts interactively). Create it with `{"extends": "next/core-web-vitals"}` if missing.
- The backend has no `lint` script in `package.json`. Lint is only available for the frontend via `npm run lint`.
- Frontend lint (`npm run lint`) has pre-existing warnings/errors in the codebase (unescaped entities, missing useEffect deps). These are not introduced by the agent.
- Demo credentials after seeding: Admin `admin@demo.school.vn` / `admin123`, Teacher `teacher@demo.school.vn` / `teacher123`, Parent `parent1@demo.school.vn` / `parent123`. Tenant code: `THPT-DEMO`.
