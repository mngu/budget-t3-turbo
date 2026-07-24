-- Exécuté automatiquement par l'image postgres au tout premier démarrage
-- (volume vide uniquement — voir docker-compose.yml). Requis par la
-- catégorisation few-shot (packages/api/src/lib/similar-transactions.ts).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
