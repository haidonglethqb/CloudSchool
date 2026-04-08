# Docker Compose Setup

## Services

| Service | Image | Port | Health Check |
|---------|-------|------|--------------|
| `postgres` | `postgres:16-alpine` | 5432 | `pg_isready -U postgres -d cloudschool` |
| `backend` | Custom (multi-stage) | 5000 | `wget -qO- http://localhost:5000/health` |
| `frontend` | Custom (multi-stage) | 3000 | Serves after backend healthy |

## Configuration

```yaml
# docker-compose.yml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d cloudschool"]
      interval: 10s
      retries: 5

  backend:
    build: ./backend
    ports: ["5000:5000"]
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/health"]
      interval: 10s
      retries: 5

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on:
      backend: { condition: service_healthy }

volumes:
  postgres_data:

networks:
  default:
    name: cloudschool-network
    driver: bridge
```

## Dockerfile Structure (Multi-Stage)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json prisma/ ./
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

## Logging

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

## Dev vs Production

| Aspect | Dev (`docker-compose.dev.yml`) | Prod (`docker-compose.yml`) |
|--------|-------------------------------|----------------------------|
| Backend port | 5001 | 5000 |
| Hot reload | Yes (volumes mount) | No |
| Prisma Studio | Exposed (5555) | Not included |
| NODE_ENV | development | production |

## Related
- [Environment Variables](./environment-variables.md)
- [Ports & Services](./ports-services.md)
- [docker-compose.yml](../../../docker-compose.yml)
- [docker-compose.dev.yml](../../../docker-compose.dev.yml)
