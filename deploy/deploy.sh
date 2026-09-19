#!/usr/bin/env bash
# Build locally and deploy to the VPS over SSH.
#
# One-time host setup: create /docker/budget/.env (never commit it).
# SITE_HOST and SITE_URL must refer to the same domain for Traefik and auth.
#
#   SITE_HOST=vps.example.com
#   SITE_URL=https://vps.example.com
#   POSTGRES_PASSWORD=<openssl rand -base64 24>
#   AUTH_SECRET=<openssl rand -base64 32>
#   ANTHROPIC_API_KEY=<key>
#   RESEND_API_KEY=<key>                    # Required for magic-link login.
#   EMAIL_FROM=budget@<verified-domain>
#
# Optional one-time local database transfer after the first `up`.
# Use the container's pg_dump to match the PostgreSQL server version.
#
#   docker compose exec -T db pg_dump -U budget -Fc budget_t3 > /tmp/b.dump
#   ssh root@VPS_IP 'docker compose -f /docker/budget/docker-compose.yml \
#     exec -T db pg_restore -U budget -d budget_t3 --clean --if-exists' < /tmp/b.dump
#
# Ensure pg_trgm is available after restore; categorization requires it.
#
#   ssh root@VPS_IP 'docker compose -f /docker/budget/docker-compose.yml \
#     exec -T db psql -U budget -d budget_t3 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"'
#
# Legacy databases matching 0000_baseline but lacking migration history need
# the baseline recorded ONCE before migrate, or existing tables will be recreated.
# Skip this for dumps that already include drizzle migration history.
# Drizzle orders applied migrations by created_at, not by hash.
#
#   H=$(shasum -a 256 packages/db/drizzle/0000_baseline.sql | cut -d' ' -f1)
#   W=$(node -p "require('./packages/db/drizzle/meta/_journal.json').entries[0].when")
#   ssh root@VPS_IP "docker compose -f /docker/budget/docker-compose.yml \
#     exec -T db psql -U budget -d budget_t3 -v ON_ERROR_STOP=1 \
#     -c 'CREATE SCHEMA IF NOT EXISTS drizzle' \
#     -c 'CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)' \
#     -c \"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$H', $W)\""
#
# Expand H and W locally; the remote shell does not know them.
#
# Subsequent migrations run below before the new app starts.
#
# An empty budget-data volume is valid: restored transactions are already in PostgreSQL.
#
# Set https://$SITE_HOST/callback in /settings/banques and register the identical
# URL in Enable Banking's Control Panel before authorizing bank connections.
set -euo pipefail

DIR=/docker/budget

cd "$(dirname "$0")/.."

HOST=${DEPLOY_HOST:-$(grep -m1 '^DEPLOY_HOST=' .env 2>/dev/null | cut -d= -f2- || true)}
: "${HOST:?DEPLOY_HOST manquant — l'ajouter au .env local (DEPLOY_HOST=root@<ip-du-vps>) ou l'exporter}"

# Skip runtime secret validation during the build.
CI=true pnpm build

ssh "$HOST" "mkdir -p $DIR"
ssh "$HOST" "test -f $DIR/.env" || {
  echo "Manque $DIR/.env sur l'hôte — voir l'en-tête de ce script." >&2
  exit 1
}

rsync -az --delete apps/tanstack-start/.output/ "$HOST:$DIR/.output/"
rsync -az docker-initdb/ "$HOST:$DIR/docker-initdb/"
rsync -az deploy/Dockerfile deploy/docker-compose.yml "$HOST:$DIR/"

# Migrate before starting new code. The database has no published port, so use
# a temporary SSH tunnel to its bridge IP and close it even if migration fails.
# Fail if the local port is occupied rather than migrate through an unknown tunnel.
ssh "$HOST" "cd $DIR && docker compose up -d db"
DB_IP=$(ssh "$HOST" "cd $DIR && docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \$(docker compose ps -q db)")
DB_PASS=$(ssh "$HOST" "grep -m1 '^POSTGRES_PASSWORD=' $DIR/.env | cut -d= -f2-")
TUNNEL=$(mktemp -u "${TMPDIR:-/tmp}/budget-deploy-tunnel.XXXXXX")
ssh -f -N -M -S "$TUNNEL" -o ExitOnForwardFailure=yes -L 15432:"$DB_IP":5432 "$HOST"
trap 'ssh -S "$TUNNEL" -O exit "$HOST" 2>/dev/null || true' EXIT

# Bypass the package's dotenv wrapper so local .env cannot replace the production target.
POSTGRES_URL="postgres://budget:$DB_PASS@127.0.0.1:15432/budget_t3" \
  pnpm -F @budget/db exec drizzle-kit migrate

ssh "$HOST" "cd $DIR && docker compose up -d --build"
ssh "$HOST" "cd $DIR && docker compose ps"
