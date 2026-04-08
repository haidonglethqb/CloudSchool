# Environment Variables

## Backend (`.env`)

| Variable | Dev Default | Production | Description |
|----------|-------------|------------|-------------|
| `PORT` | `5001` | `5000` | Express server port |
| `NODE_ENV` | `development` | `production` | Runtime environment |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/cloudschool` | Same pattern | PostgreSQL connection string |
| `JWT_SECRET` | `<random-256-bit>` | `<random-256-bit>` | JWT signing secret |
| `JWT_EXPIRES_IN` | `24h` | `24h` | Token expiration |
| `CORS_ORIGIN` | `http://localhost:3000` | `https://your-domain.com` | Allowed frontend origin |
| `COOKIE_SECURE` | `false` | `true` | Secure flag on httpOnly cookies |
| `TZ_OFFSET_HOURS` | `7` | `7` | Vietnam UTC+7 |
| `RATE_LIMIT_BYPASS_SECRET` | _empty_ | _empty_ | Playwright test bypass |

## Frontend (`.env.local`)

| Variable | Dev | Production | Description |
|----------|-----|------------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001/api` | `https://api.your-domain.com/api` | Backend API base URL |

## Docker Compose Defaults

```yaml
# docker-compose.yml excerpt
services:
  backend:
    environment:
      - PORT=5000
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cloudschool
      - CORS_ORIGIN=http://localhost:3000
      - COOKIE_SECURE=false
```

## Security Notes

- `JWT_SECRET` must be cryptographically random (min 256 bits)
- Never commit `.env` or `.env.local` to version control
- Use `COOKIE_SECURE=true` in production with HTTPS

## Related
- [Docker Setup](./docker-setup.md)
- [Ports & Services](./ports-services.md)
- [backend/.env.example](../../../backend/.env.example)
- [frontend/.env.example](../../../frontend/.env.example)
- [docker-compose.yml](../../../docker-compose.yml)
