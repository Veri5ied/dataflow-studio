#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEEDS_DIR="${SEEDS_DIR:-$ROOT_DIR/apps/api/db/seeds}"
DATABASE_URL="${APP_DATABASE_URL:-}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "APP_DATABASE_URL is required to run seeds." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install PostgreSQL client tools first." >&2
  exit 1
fi

if [[ ! -d "$SEEDS_DIR" ]]; then
  echo "Seeds directory not found: $SEEDS_DIR" >&2
  exit 1
fi

mapfile -t SEED_FILES < <(find "$SEEDS_DIR" -maxdepth 1 -type f -name "*.sql" | sort)

if [[ ${#SEED_FILES[@]} -eq 0 ]]; then
  echo "No seed files found in $SEEDS_DIR"
  exit 0
fi

for SEED_FILE in "${SEED_FILES[@]}"; do
  FILE_NAME="$(basename "$SEED_FILE")"
  echo "Applying seed: $FILE_NAME"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEED_FILE"
done

echo "Seeding complete."
