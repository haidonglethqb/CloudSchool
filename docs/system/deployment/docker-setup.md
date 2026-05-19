# Docker Compose Setup

## Services

| Service | Image | Port | Health Check |
|---------|-------|------|--------------|
| `postgres` | `postgres:16-alpine` | 5432 | `pg_isready -U postgres -d cloudschool` |
| `backend` | `ghcr.io/<owner>/<repo>/backend:<tag>` | 5000 | `wget -qO- http://localhost:5000/health` |
| `frontend` | `ghcr.io/<owner>/<repo>/frontend:<tag>` | 3000 | Serves after backend healthy |

## Configuration

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
  backend:
    image: ghcr.io/${GITHUB_REPOSITORY}/backend:${IMAGE_TAG:-latest}
  frontend:
    image: ghcr.io/${GITHUB_REPOSITORY}/frontend:${IMAGE_TAG:-latest}
```

## Deploy Pipeline (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

1. Build + push backend image tag `${{ github.sha }}` (and `latest` on `main` only).
2. Build + push frontend image tag `${{ github.sha }}` (and `latest` on `main` only).
3. SSH to VPS, write `.env` with `GITHUB_REPOSITORY` + `IMAGE_TAG=${{ github.sha }}`.
4. `docker compose pull` then `docker compose up`.

## Migration Flow in Deploy

- Primary path: `docker compose run --rm backend npx prisma migrate deploy`
- Legacy fallback (DB cũ chưa có Prisma migration history):
  1. `npx prisma db push`
  2. `npx prisma migrate resolve --applied <each migration folder>`
  3. `npx prisma migrate deploy`

## Dev vs Production

| Aspect | Dev (`docker-compose.dev.yml`) | Prod (`docker-compose.yml`) |
|--------|-------------------------------|----------------------------|
| Backend port | 5001 | 5000 |
| App image | Local `npm run dev` | GHCR image |
| Prisma Studio | Optional local CLI | Not included |
| NODE_ENV | development | production |

## Related
- [Environment Variables](./environment-variables.md)
- [Ports & Services](./ports-services.md)
- [docker-compose.yml](../../../docker-compose.yml)
- [docker-compose.dev.yml](../../../docker-compose.dev.yml)
