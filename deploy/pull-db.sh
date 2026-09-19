#!/usr/bin/env bash
# Replace the local database with production data.
# Use container clients to match PostgreSQL versions; transfer the dump over SSH.
set -euo pipefail

DIR=/docker/budget
# Keep this explicit: the unrelated budget database shares the same local instance.
DB=budget_t3

cd "$(dirname "$0")/.."

# IDE launches may lack shell exports; fall back to the local .env.
HOST=${DEPLOY_HOST:-$(grep -m1 '^DEPLOY_HOST=' .env 2>/dev/null | cut -d= -f2- || true)}
: "${HOST:?DEPLOY_HOST manquant — l'ajouter au .env local (DEPLOY_HOST=root@<ip-du-vps>) ou l'exporter}"

printf 'Écraser la base locale %s (port 5436) avec la prod ? [oui/non] ' "$DB"
read -r ok
[[ $ok == oui ]] || exit 1

dump=$(mktemp -t budget-prod.dump)
trap 'rm -f "$dump"' EXIT

# Finish downloading before --clean can modify local data, in case SSH disconnects.
ssh "$HOST" "docker compose -f $DIR/docker-compose.yml exec -T db pg_dump -U budget -Fc $DB" > "$dump"

# Ensure pg_trgm is available after restore; categorization requires it.
docker compose exec -T db pg_restore -U budget -d "$DB" --clean --if-exists < "$dump"
docker compose exec -T db psql -U budget -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"

docker compose exec -T db psql -U budget -d "$DB" -c \
  "SELECT (SELECT count(*) FROM transactions) AS transactions, (SELECT count(*) FROM categories) AS categories"
