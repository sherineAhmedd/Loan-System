# Docker Setup Guide

## Quick Start

1. **Stop any existing containers:**
   ```bash
   docker-compose down
   ```

2. **Remove old volumes (if needed):**
   ```bash
   docker-compose down -v
   ```

3. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Or run in detached mode:**
   ```bash
   docker-compose up --build -d
   ```

## Services

- **PostgreSQL**: `localhost:5432`
  - Database: `loan_system`
  - User: `admin`
  - Password: `password`

- **Backend API**: `http://localhost:3000`
  - Health check: `http://localhost:3000/api/health`
  - Swagger: `http://localhost:3000/api`

- **Frontend**: `http://localhost:5173`

## Troubleshooting

### If PostgreSQL keeps restarting:
```bash
docker-compose down -v
docker-compose up --build
```

### If backend fails to start:
1. Check logs: `docker-compose logs backend`
2. Verify database connection: `docker-compose exec backend pg_isready -h postgres -U admin`
3. Check if migrations ran: `docker-compose exec backend npx prisma migrate status`

### If frontend can't connect to backend:
1. Check backend health: `curl http://localhost:3000/api/health`
2. Verify CORS settings in `backend/src/main.ts`
3. Check environment variables: `docker-compose exec frontend env | grep VITE`

### View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f frontend
```

### Rebuild specific service:
```bash
docker-compose build backend
docker-compose up -d backend
```

## Environment Variables

Create a `.env` file in the root directory (optional):
```env
JWT_SECRET=your-secret-key-here
VITE_JWT_TOKEN=your-jwt-token-here
LOG_LEVEL=debug
```

## Database Migrations

Migrations run automatically on backend startup. To run manually:
```bash
docker-compose exec backend npx prisma migrate deploy
```

## Clean Up

To completely remove everything:
```bash
docker-compose down -v
docker system prune -a
```

