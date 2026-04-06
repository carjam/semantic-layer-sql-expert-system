#!/usr/bin/env bash
# Run sql/postgres/demo.sql in an ephemeral PostgreSQL 16 container (no local psql).
set -euo pipefail

POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_PATH="$REPO_ROOT/sql/postgres/demo.sql"
PW="semantic_demo_ephemeral"

if [[ ! -f "$SQL_PATH" ]]; then
  echo "Demo SQL not found: $SQL_PATH" >&2
  exit 1
fi

cid="$(docker run -d \
  -e "POSTGRES_PASSWORD=$PW" \
  -e "POSTGRES_DB=postgres" \
  "$POSTGRES_IMAGE")"

cleanup() { docker rm -f "$cid" >/dev/null 2>&1 || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  if docker exec "$cid" pg_isready -U postgres 2>/dev/null | grep -q accepting; then
    break
  fi
  sleep 1
done

if ! docker exec "$cid" pg_isready -U postgres 2>/dev/null | grep -q accepting; then
  echo "PostgreSQL did not become ready within 60s (container $cid)." >&2
  exit 1
fi

docker cp -- "$SQL_PATH" "$cid:/tmp/demo.sql"
docker exec -e "PGPASSWORD=$PW" "$cid" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SET client_min_messages TO WARNING" \
  -f /tmp/demo.sql
