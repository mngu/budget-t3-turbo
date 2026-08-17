#!/usr/bin/env bash
# Déploiement sur le VPS Hostinger vps. Idempotent, relançable à chaque
# changement de code.
#
# Mise en place, une seule fois sur l'hôte — /docker/budget/.env, jamais
# committé, lu par compose pour l'interpolation. SITE_HOST et SITE_URL désignent
# le même domaine et bougent ENSEMBLE : n'en changer qu'un fait router Traefik
# sur l'ancien host pendant que l'app se croit sur le nouveau.
#
#   SITE_HOST=vps.example.com
#   SITE_URL=https://vps.example.com
#   POSTGRES_PASSWORD=<openssl rand -base64 24>
#   AUTH_SECRET=<openssl rand -base64 32>   # neuf : ne sert qu'aux sessions
#                                           # (private_key_pem est en clair en
#                                           # base), coût = une reconnexion
#   ANTHROPIC_API_KEY=<clé>
#   RESEND_API_KEY=<clé>                    # OBLIGATOIRES : la connexion se
#   EMAIL_FROM=budget@<domaine vérifié>     # fait uniquement par lien email,
#                                           # sans eux personne ne peut entrer
#                                           # (l'envoi lève au lieu de mentir)
#
# Reprise de la base locale, une seule fois, après le premier `up`. pg_dump vient
# du conteneur et non du Mac : un pg_dump local plus ancien refuse un serveur 17.
#
#   docker compose exec -T db pg_dump -U budget -Fc budget_t3 > /tmp/b.dump
#   ssh root@VPS_IP 'docker compose -f /docker/budget/docker-compose.yml \
#     exec -T db pg_restore -U budget -d budget_t3 --clean --if-exists' < /tmp/b.dump
#
# Puis vérifier que l'extension a survécu au --clean (sans elle, la recherche de
# similaires de la catégorisation few-shot casse sans erreur visible) :
#
#   ssh root@VPS_IP 'docker compose -f /docker/budget/docker-compose.yml \
#     exec -T db psql -U budget -d budget_t3 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"'
#
# Base restaurée d'un dump : elle a déjà toutes les tables, mais pas la trace de
# ce que drizzle croit appliqué. À faire UNE FOIS, sinon le premier `migrate`
# rejoue 0000_baseline et échoue sur des tables existantes. La ligne dit « cette
# base est au niveau du socle » ; le migrateur ne compare que `created_at` au
# `when` du journal, jamais le hash (drizzle-orm/pg-core/dialect.js) — le hash
# n'est là que pour la lisibilité.
#
#   H=$(shasum -a 256 packages/db/drizzle/0000_baseline.sql | cut -d' ' -f1)
#   W=$(node -p "require('./packages/db/drizzle/meta/_journal.json').entries[0].when")
#   ssh root@VPS_IP "docker compose -f /docker/budget/docker-compose.yml \
#     exec -T db psql -U budget -d budget_t3 -v ON_ERROR_STOP=1 \
#     -c 'CREATE SCHEMA IF NOT EXISTS drizzle' \
#     -c 'CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)' \
#     -c \"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$H', $W)\""
#
# ($H et $W sont développés par le shell local — le shell distant ne les connaît
# pas ; les échapper enverrait deux chaînes vides et un SQL invalide.)
#
# Les migrations suivantes (à partir de 0001) s'appliquent alors toutes seules
# ci-dessous. Si la base avait dérivé du socle, ça se verra là : une migration
# qui suppose un état absent échoue, et sa transaction est annulée en entier.
#
# Le volume budget-data démarre vide : c'est normal, les JSON Enable Banking se
# reconstituent à la prochaine synchro et la base restaurée a déjà les données.
#
# Enfin, l'URL de redirection Enable Banking (app_settings.redirect_url) : elle
# vaut https://mngu.github.io/budget-tracker/callback, une page relais héritée du
# dépôt d'origine, et NON localhost. Deux options, toutes deux manuelles :
# la pointer sur https://$SITE_HOST/callback depuis /banques puis l'enregistrer à
# l'identique dans le Control Panel Enable Banking, ou garder le relais et le
# faire rediriger vers le VPS. Tant que ce n'est pas fait, la connexion d'une
# banque échoue au retour de SCA.
set -euo pipefail

DIR=/docker/budget

cd "$(dirname "$0")/.."

# Même résolution d'hôte que pull-db.sh : `.env` local à défaut d'export.
HOST=${DEPLOY_HOST:-$(grep -m1 '^DEPLOY_HOST=' .env 2>/dev/null | cut -d= -f2- || true)}
: "${HOST:?DEPLOY_HOST manquant — l'ajouter au .env local (DEPLOY_HOST=root@<ip-du-vps>) ou l'exporter}"

# CI=true fait sauter la validation d'env (skipValidation dans env.ts) : le
# build n'a besoin d'aucun secret, et aucun ne doit entrer dans une couche.
CI=true pnpm build

ssh "$HOST" "mkdir -p $DIR"
ssh "$HOST" "test -f $DIR/.env" || {
  echo "Manque $DIR/.env sur l'hôte — voir l'en-tête de ce script." >&2
  exit 1
}

# --delete : un chunk disparu d'un build à l'autre ne doit pas survivre.
rsync -az --delete apps/tanstack-start/.output/ "$HOST:$DIR/.output/"
rsync -az docker-initdb/ "$HOST:$DIR/docker-initdb/"
rsync -az deploy/Dockerfile deploy/docker-compose.yml "$HOST:$DIR/"

# Migrations, AVANT de démarrer le code neuf : schéma neuf + code ancien est
# inoffensif, l'inverse lève sur chaque écran qui lit la colonne manquante.
#
# La base ne publie aucun port (voir docker-compose.yml) — on l'atteint le temps
# du `migrate` par un tunnel SSH vers l'IP de bridge du conteneur, que Traefik
# joint déjà de la même façon. `-M -S` donne une prise de contrôle pour refermer
# le tunnel à coup sûr, y compris si `migrate` échoue.
#
# `ExitOnForwardFailure=yes` fait échouer le déploiement plutôt que de migrer à
# l'aveugle si 15432 est déjà pris — typiquement un tunnel resté d'un run
# interrompu. L'erreur ssh est laconique : `lsof -ti :15432 | xargs kill`.
ssh "$HOST" "cd $DIR && docker compose up -d db"
DB_IP=$(ssh "$HOST" "cd $DIR && docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \$(docker compose ps -q db)")
DB_PASS=$(ssh "$HOST" "grep -m1 '^POSTGRES_PASSWORD=' $DIR/.env | cut -d= -f2-")
TUNNEL=$(mktemp -u "${TMPDIR:-/tmp}/budget-deploy-tunnel.XXXXXX")
ssh -f -N -M -S "$TUNNEL" -o ExitOnForwardFailure=yes -L 15432:"$DB_IP":5432 "$HOST"
trap 'ssh -S "$TUNNEL" -O exit "$HOST" 2>/dev/null || true' EXIT

# `exec drizzle-kit` et non le script `migrate` du package : celui-ci passe par
# `dotenv -e ../../.env`, et une POSTGRES_URL locale qui reprendrait la main
# migrerait la base du Mac en croyant migrer la prod.
POSTGRES_URL="postgres://budget:$DB_PASS@127.0.0.1:15432/budget_t3" \
  pnpm -F @budget/db exec drizzle-kit migrate

ssh "$HOST" "cd $DIR && docker compose up -d --build"
ssh "$HOST" "cd $DIR && docker compose ps"
