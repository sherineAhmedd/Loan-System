# SOLUTION — Loan Disbursement & Repayment System

This document explains the approach, technical decisions, rollback implementation, logging strategy, and security thinking for the Loan Disbursement & Repayment System built for the Flend take-home challenge.

**1. Approach (summary)**
- I implemented the core transaction processing paths (disbursement and repayments) using NestJS and Prisma (PostgreSQL) with a strong emphasis on correctness, idempotency, transaction isolation, observable logging, and safe rollback operations.
- Core features delivered: idempotent disbursement flow, repayment allocation with daily interest and late fee handling, rollback records with compensating transactions, structured logging, Prisma transactions and migrations, and a health endpoint.

**2. Key technical decisions and why**
- NestJS + Prisma: NestJS provides modular structure, DI, and testing ergonomics. Prisma simplifies type-safe DB access and transactions.
- Structured logging (Winston): JSON logs make it possible to ship to any log aggregator (ELK, Datadog). Central `LoggerService` ensures consistent fields across services.
- Prisma event logging: Prisma is configured to emit `query` events, which are captured and logged centrally to surface slow queries and DB errors.
- Rollback via compensating transactions: Transactions are never deleted; rollbacks create `RollbackRecord` entries and compensating DB actions so the audit trail is preserved.
- Health endpoint: `GET /api/health` provides readiness/liveness checks used by Docker Compose and orchestration tools.

**3. How rollback system is implemented**
- Rollback records are persisted in `RollbackRecord` model (see `prisma/schema.prisma`). When an error occurs during a disbursement or repayment and compensating actions are required, the service:
  - Creates an audit `RollbackRecord` with `transactionId`, `originalOperation`, `rollbackReason`, and `compensatingActions` (JSON describing reverse steps).
  - Marks affected transactions as `rolled_back_at` (timestamp) instead of deleting them.
  - Performs compensating DB writes in a Prisma transaction where possible (e.g. reverse ledger entries, credit back platform funds).
- Key files: `backend/src/modules/rollback/rollback.service.ts`, `backend/src/modules/disbursement/disbursement.service.ts` (example usage).

**4. Logging strategy**
- Central `LoggerService` at `backend/src/common/logging/logger.service.ts` (Winston) with JSON output and a normalized payload shape:

```json
{
  "timestamp": "ISO8601",
  "level": "info",
  "service": "loan-backend",
  "operation": "disbursement:start",
  "transactionId": "txn_123",
  "userId": "usr_456",
  "duration": 12,
  "metadata": { ... },
  "error": { "message": "...", "stack": "...", "code": "..." }
}
```

- Required log points implemented:
  1. Transaction Start — example: `disbursement:start` (DisbursementService)
 2. Database Queries — captured via Prisma `$on('query')` events (PrismaService) with durations
 3. Business Logic — calculation steps in repayment service logged at `debug`
 4. External Calls — any external call should be logged with `operation` and response durations (pattern provided in LoggerService)
 5. Errors — logged with full context and persisted rollback records when applicable
 6. Transaction End — log success/failure with total duration

- How to consume logs: logs print JSON to stdout so Docker and container log collectors can capture and forward them to a centralized system.

**5. Security**
- Threats considered:
  - Idempotency abuse (duplicate disburse attempts): prevented by unique `loanId` checks and transactions.
  - Unauthorized operations (rollbacks or disbursements): endpoints must be protected via authentication/authorization (JWT strategy included); role checks recommended for rollback endpoints.
  - Injection attacks: Prisma query building avoids raw SQL; where raw queries exist we use parameterized inputs.
  - Sensitive data leakage in logs: logger normalizes payloads; avoid logging full card numbers or PII. Sensitive fields must be redacted before logging.
  - Denial of service: rate limiting is recommended for production (not implemented due to time). Also validate input sizes and types.

- What I implemented:
  - Input validation with DTOs and `class-validator` to prevent malformed inputs.
  - JWT-based auth scaffolding (`auth` module). Protect endpoints with guards.
  - Use Prisma ORM (parameterized queries) to reduce injection risk.
  - Avoid deletion of transaction data; use `rolled_back_at` timestamps and compensating transactions for auditability.
  - Structured logging and health checks to support monitoring and incident response.

- Trade-offs and what I'd add with more time:
  - Add role-based access control (RBAC) and fine-grained permissions for rollback operations.
  - Integrate a secrets manager (e.g. HashiCorp Vault) and remove `.env` reliance for production.
  - Implement rate-limiting (e.g., `nestjs/throttler`) and request-size limits.
  - Add automatic log redaction layer and PII filters.

**6. Challenges faced & solutions**
- Prisma event logging and DI: converting `PrismaService` to depend on `LoggerService` required ensuring all modules import `PrismaModule` so DI resolves. Fixed by centralizing `PrismaService` and `LoggerService` in `PrismaModule`.
- Docker host port conflicts on developer machines: resolved by recommending removing unnecessary host-port mappings in `docker-compose.yml` and documenting port conflict troubleshooting.

**7. What I would improve with more time**
- Add Redis for short-lived state and idempotency keys, metrics export (Prometheus), and a Grafana dashboard.
- Harden auth flows with refresh tokens and RBAC.
- Expand test coverage (target 80–90%) and add mutation testing.

**8. Time breakdown (estimated)**
- Design & schema: 6 hours
- Disbursement & repayment business logic: 12 hours
- Rollback & audit trail: 6 hours
- Logging & observability: 4 hours
- Docker & CI setup: 3 hours
- Tests & polishing: 6 hours

**9. Assumptions**
- Single currency flows in many code paths (currency conversion not implemented).
- External payment provider interactions are simulated or stubbed; wiring to a real PSP requires credentials and agreements.
- Platform accounting lives in the DB via `payment` and `disbursement` aggregates; no external ledger was used.

**10. How to verify locally**
1. Start services with Docker Compose. Ensure health is `ok`:
```powershell
docker compose up --build
# then
curl http://localhost:3000/api/health
```
2. Run unit tests and coverage:
```powershell
cd backend
npm test
npm run test:cov
```

**11. Notes for reviewers**
- Logs are JSON and ready to be consumed by log aggregation services.
- Rollbacks do not delete records and always create `RollbackRecord` entries with compensating actions preserved.
- Please run `npx prisma migrate dev` when testing locally if migrations are changed.

---
If you want, I can also:
- Add a request-scoped LoggingInterceptor to attach correlation IDs to every request and automatically log request start/end.
- Add a Postman collection or Swagger/OpenAPI generation if you prefer a browsable API spec.
