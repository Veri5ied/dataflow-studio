#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

corepack enable
pnpm install

if [[ -n "${APP_DATABASE_URL:-}" ]]; then
  echo "APP_DATABASE_URL detected. Running migrations."
  "$ROOT_DIR/tooling/scripts/migrate.sh"

  if [[ "${RUN_DB_SEED:-false}" == "true" ]]; then
    echo "RUN_DB_SEED=true detected. Running seeds."
    "$ROOT_DIR/tooling/scripts/seed.sh"
  fi
else
  echo "APP_DATABASE_URL not set. Skipping migrate/seed."
fi

echo "Bootstrap complete."
