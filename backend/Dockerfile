FROM node:20-alpine

WORKDIR /usr/src/app

# Install wait-for-it script for database readiness
RUN apk add --no-cache bash wget

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production=false

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Set dummy DATABASE_URL for build-time (prisma generate doesn't need real DB)
# This will be overridden at runtime by docker-compose environment variables
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"

# Copy Prisma config and schema before generating client
COPY prisma.config.ts ./
COPY prisma/ ./prisma/

# Generate prisma client (only needs schema, not real DB connection)
RUN npx prisma generate

# Copy rest of the application code
COPY . .

# Build NestJS project
RUN npm run build

# Install PostgreSQL client for health checks
RUN apk add --no-cache postgresql-client

# Create wait script for database
RUN echo '#!/bin/sh' > /wait-for-postgres.sh && \
    echo 'set -e' >> /wait-for-postgres.sh && \
    echo 'host="$1"' >> /wait-for-postgres.sh && \
    echo 'shift' >> /wait-for-postgres.sh && \
    echo 'until pg_isready -h "$host" -p 5432 -U admin -d loan_system; do' >> /wait-for-postgres.sh && \
    echo '  >&2 echo "PostgreSQL is unavailable - sleeping"' >> /wait-for-postgres.sh && \
    echo '  sleep 2' >> /wait-for-postgres.sh && \
    echo 'done' >> /wait-for-postgres.sh && \
    echo '>&2 echo "PostgreSQL is up - executing command"' >> /wait-for-postgres.sh && \
    echo 'exec "$@"' >> /wait-for-postgres.sh && \
    chmod +x /wait-for-postgres.sh

EXPOSE 3000

# Use wait script to ensure PostgreSQL is ready before starting
CMD ["/wait-for-postgres.sh", "postgres", "sh", "-c", "npx prisma migrate deploy && node dist/main"]
