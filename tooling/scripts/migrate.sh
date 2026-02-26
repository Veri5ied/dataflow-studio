#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/apps/api/db/migrations}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DATABASE_URL="${APP_DATABASE_URL:-}"
if [[ "$DATABASE_URL" == *"?schema="* ]]; then
  DATABASE_URL="${DATABASE_URL%%\?schema=*}"
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "APP_DATABASE_URL is required to run migrations." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install PostgreSQL client tools first." >&2
  exit 1
fi

if ! command -v shasum >/dev/null 2>&1; then
  echo "shasum is required to fingerprint migration files." >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

shopt -s nullglob
MIGRATION_FILES=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

for MIGRATION_FILE in "${MIGRATION_FILES[@]}"; do
  FILE_NAME="$(basename "$MIGRATION_FILE")"
  SAFE_FILE_NAME="${FILE_NAME//\'/\'\'}"
  CHECKSUM="$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')"
  SAFE_CHECKSUM="${CHECKSUM//\'/\'\'}"

  APPLIED_FLAG="$(
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -c \
      "SELECT 1 FROM schema_migrations WHERE file_name = '$SAFE_FILE_NAME' LIMIT 1;"
  )"

  if [[ "$APPLIED_FLAG" == "1" ]]; then
    echo "Skipping already-applied migration: $FILE_NAME"
    continue
  fi

  echo "Applying migration: $FILE_NAME"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
\\i $MIGRATION_FILE
INSERT INTO schema_migrations (file_name, checksum)
VALUES ('$SAFE_FILE_NAME', '$SAFE_CHECKSUM');
COMMIT;
SQL
done

echo "Migrations complete."
