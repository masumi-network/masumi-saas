#!/usr/bin/env bash
# Creates the local Postgres role/database used by vitest when DATABASE_URL is unset.
# Default: postgres://test:test@localhost:5432/test (see apps/web/vitest.config.ts).
set -euo pipefail

TEST_ROLE="${TEST_DB_ROLE:-test}"
TEST_PASSWORD="${TEST_DB_PASSWORD:-test}"
TEST_DATABASE="${TEST_DB_NAME:-test}"
ADMIN_DB="${POSTGRES_ADMIN_DB:-postgres}"

psql -d "$ADMIN_DB" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${TEST_ROLE}') THEN
    CREATE ROLE ${TEST_ROLE} WITH LOGIN PASSWORD '${TEST_PASSWORD}' CREATEDB;
  END IF;
END
\$\$;
SQL

if ! psql -d "$ADMIN_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = '${TEST_DATABASE}'" | grep -q 1; then
  psql -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${TEST_DATABASE} OWNER ${TEST_ROLE};"
fi

psql -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${TEST_DATABASE} TO ${TEST_ROLE};"

export DATABASE_URL="postgresql://${TEST_ROLE}:${TEST_PASSWORD}@localhost:5432/${TEST_DATABASE}?schema=public"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(
  cd "$SCRIPT_DIR/.."
  pnpm exec prisma migrate deploy
)

echo "Test database ready: ${DATABASE_URL}"
