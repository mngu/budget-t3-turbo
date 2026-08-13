#!/usr/bin/env bash
# Rapatrie la base de PROD sur le local, en ÉCRASANT tout le contenu local.
# C'est l'inverse exact de la reprise décrite en tête de deploy.sh.
#
# Les deux pg_dump/pg_restore viennent des conteneurs et jamais du Mac : un
# client Postgres local plus ancien refuse un serveur 17.
#
# Aucun tunnel SSH n'est nécessaire — on passe par `docker compose exec` des
# deux côtés, le dump transite sur stdout de ssh.
set -euo pipefail

HOST=${DEPLOY_HOST:?"exporter DEPLOY_HOST=root@<ip-du-vps>"}
DIR=/docker/budget
# En dur : la base `budget` de l'ancien repo vit dans la MÊME instance locale.
DB=budget_t3

cd "$(dirname "$0")/.."

# printf + read plutôt que `read -rp` : `-p` veut dire coprocess en zsh, et le
# script est lisible aussi bien lancé que sourcé depuis un shell zsh.
printf 'Écraser la base locale %s (port 5436) avec la prod ? [oui/non] ' "$DB"
read -r ok
[[ $ok == oui ]] || exit 1

dump=$(mktemp -t budget-prod.dump)
trap 'rm -f "$dump"' EXIT

# Dump complet d'abord, restauration ensuite : un ssh qui casse en cours de
# route laisserait sinon le local à moitié vidé par le --clean.
ssh "$HOST" "docker compose -f $DIR/docker-compose.yml exec -T db pg_dump -U budget -Fc $DB" > "$dump"

# --clean --if-exists supprime aussi les extensions, d'où le CREATE EXTENSION
# qui suit : sans pg_trgm, findSimilar() casse sans erreur visible.
docker compose exec -T db pg_restore -U budget -d "$DB" --clean --if-exists < "$dump"
docker compose exec -T db psql -U budget -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"

docker compose exec -T db psql -U budget -d "$DB" -c \
  "SELECT (SELECT count(*) FROM transactions) AS transactions, (SELECT count(*) FROM categories) AS categories"
