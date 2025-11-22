# Loan Disbursement & Repayment System

This repository contains a NestJS backend and a React frontend for a Loan Disbursement & Repayment processing system built for the Flend take-home challenge. The project focuses on transaction isolation, idempotency, comprehensive logging, rollback mechanisms, and time-based repayment calculations.

**Contents**
- `backend/` — NestJS backend with Prisma and PostgreSQL integration
- `frontend/frontend/` — React (Vite) admin UI
- `docker-compose.yml` — Docker Compose setup for local development
- `SOLUTION.md` — Design decisions, security notes, and implementation details (required for submission)

**Quick Links**
- Health endpoint: `GET /api/health`
- Disbursements API: `POST /api/disbursements`, `GET /api/disbursements/:id`, `POST /api/disbursements/:id/rollback`
- Repayments API: `POST /api/repayments`, `GET /api/repayments/:loanId`, `GET /api/repayments/:loanId/schedule`, `GET /api/repayments/:loanId/calculate`

**Prerequisites**
- Node.js v18+ (project tested with Node 18/20)
- npm v9+
- Docker & Docker Compose (Compose v2 recommended)
- PostgreSQL (not required locally if using Docker Compose)

**Environment**
Create a `.env` file in `backend/` for local development (do not commit `.env`). Example:

```
DATABASE_URL=postgresql://admin:password@postgres:5432/loan_system
LOG_LEVEL=info
NODE_ENV=development

## JWT Authentication

Protected endpoints require a JWT token. This section explains how to generate it on the backend and use it in the frontend.

### Backend: Generating Tokens

You can generate a token for testing using one of these methods:

**Using Docker (recommended):**  
```powershell
# Default token (service='loan-system', expires 24h)
docker-compose exec backend ts-node src/auth/generate-token.ts 

# Custom service and expiration
docker-compose exec backend ts-node src/auth/generate-token.ts "company-name" "7d"

#Direct TypeScript execution (local dev):
cd backend
ts-node src/auth/generate-token.ts --service=company-name --expires=7d

#Use the token:
Swagger UI: Click Authorize,
Direct API requests: Include header: -H "Authorization: Bearer YOUR_TOKEN_HERE"

#Frontend: Using Tokens
The frontend reads a JWT from a .env file in the project root

Step 1: Create .env in project root
VITE_JWT_TOKEN=<token-here>

Step 2: Access in frontend
In the React app, the token is read via import.meta.env.VITE_JWT_TOKEN
All API requests (via httpClient / Axios) automatically include this token in the Authorization header.


**Start with Docker (recommended)**
The provided `docker-compose.yml` runs a Postgres DB, the backend and the frontend. It also runs Prisma migrations on backend start.

PowerShell (from repo root):
```powershell
docker compose up --build
```

To run detached:
```powershell
docker compose up --build -d
```

Stop and remove containers and volumes:
```powershell
docker compose down -v
```

Notes:
- The backend exposes `3000` (HTTP) — health check is `http://localhost:3000/api/health`.
- If a host port conflict arises (for example `5555`), either free that port or remove/change port mapping in `docker-compose.yml`.

**Manual (local) setup**
1. From `backend/`:
```powershell
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run seed
npm run start:dev
```

2. From `frontend/frontend/` (optional for dev UI):
```powershell
cd frontend/frontend
npm install
npm run dev
```

**Run tests**
- Unit tests (Jest):
```powershell
cd backend
npm test
```

- E2E tests (if configured):
```powershell
cd backend
npm run test:e2e
```

- Coverage report:
```powershell
cd backend
npm run test:cov
# coverage output in `coverage/`
```

Minimum requirement: ensure coverage >= 70% on business logic.

**Logging & Observability**
- The backend uses a structured Winston-based `LoggerService` (`backend/src/common/logging/logger.service.ts`). Logs are emitted in JSON and include fields such as `timestamp`, `level`, `service`, `operation`, `transactionId`, `userId`, `duration`, `metadata`, and `error`.
- Prisma query events are captured in `PrismaService` and logged with query strings and durations.
- Health endpoint and request-level logging make it possible for orchestration and monitoring to detect degraded states.

**Important files to review**
- `backend/src/common/logging/logger.service.ts` — structured logging implementation
- `backend/src/prisma/prisma.service.ts` — Prisma integration and query logging
- `backend/src/modules/disbursement/disbursement.service.ts` — example of structured logs in business flow and rollback creation
- `backend/src/modules/rollback/rollback.service.ts` — rollback logic (compensating transactions)
- `backend/src/app.controller.ts` — `GET /api/health` implementation

**API Documentation**
- Minimal API list is in this README. For full API, run the backend and view Swagger (if enabled) or inspect controllers in `backend/src/modules/*/*.controller.ts`.

**Known issues / Limitations**
- Secrets are stored in `.env` for local dev — ensure not to commit these to the repository.
- The frontend currently uses Vite dev server in Docker for development — recommended to produce a production build (served by nginx) for production deployments.
- Some advanced production patterns (Redis cache, rate limiting, metrics export) are not implemented due to time constraints but are discussed in `SOLUTION.md`.

