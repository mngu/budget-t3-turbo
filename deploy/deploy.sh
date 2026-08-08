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

HOST=${DEPLOY_HOST:-root@VPS_IP}
DIR=/docker/budget

cd "$(dirname "$0")/.."

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

ssh "$HOST" "cd $DIR && docker compose up -d --build"
ssh "$HOST" "cd $DIR && docker compose ps"
