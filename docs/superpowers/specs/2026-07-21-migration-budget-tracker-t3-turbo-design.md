# Migration de budget-tracker vers le monorepo t3-turbo — Design

**Date** : 2026-07-21
**Statut** : validé (design approuvé section par section)

## Contexte

`budget-tracker` (dossier frère, `/Users/max/WebstormProjects/budget-tracker`) est une app
TanStack Start (Vite) de suivi de budget personnel : synchronisation de 3 banques via
Enable Banking, catégorisation LLM (SDK Anthropic), table de transactions filtrables.
Stack actuelle : server functions TanStack, Drizzle + `pg`, Postgres local (docker,
port 5436), shadcn/Base UI, scripts CLI (`sync`, `import`, `categorize`), pas d'auth.

`budget-t3-turbo` (ce repo) est un template create-t3-turbo vierge : pnpm + Turborepo,
packages `db` (Drizzle), `api` (tRPC), `auth` (Better Auth), `ui`, `validators`,
apps `nextjs`, `expo`, `tanstack-start`.

**Objectif** : migrer budget-tracker dans ce monorepo, **iso-fonctionnel** (aucune
évolution fonctionnelle simultanée — l'« approche B » d'écriture directe en DB viendra
après, dans le nouveau monorepo).

### Incident de données (contexte important)

Le `db:push` du template a été lancé sur la base `budget` existante (port 5436) : les
tables de budget-tracker (`transactions`, `accounts`, `categories`, `bank_connections`,
`app_settings`, `auth_requests`) ont été remplacées par celles du template.

Récupérable :

- Transactions brutes : `budget-tracker/data/transactions-*.json` (6 fichiers, 19 juillet) —
  `scripts/import.ts` est idempotent et recrée comptes + transactions.
- Catégorisation : re-générable via `scripts/categorize.ts` (LLM).
- Credentials Enable Banking : `private.pem.bak` et `config.json.bak` à la racine de budget-tracker.

Perdu :

- Corrections manuelles de catégories (`categorySource: 'manual'`) et noms d'affichage des comptes.
- Sessions PSD2 (`bank_connections`) — re-autorisation SCA des 3 banques nécessaire via `/banques`.

## Décisions de cadrage

| Sujet | Décision |
| --- | --- |
| Apps conservées | `tanstack-start` (cible de la migration) + `expo` (squelette, écrans budget ultérieurs). `apps/nextjs` supprimée. |
| Auth | Better Auth conservé, **email + mot de passe** (Discord OAuth retiré). Nécessaire car le serveur sera joignable depuis le mobile. |
| Base de données | Postgres local docker (compose repris de budget-tracker, port 5436). **Nouvelle base `budget_t3`** dans la même instance pour ne plus jamais pousser un schéma sur la base d'un autre projet. Données ré-importées depuis les JSON. |
| Périmètre | Iso-fonctionnel. Pas d'approche B, pas d'écrans mobiles. |
| Scope packages | Renommage global `@acme/*` → `@budget/*`. |
| Couche serveur | **Option A : tout en tRPC** dans `@budget/api`. Seule exception : `/callback` (redirection navigateur OAuth) reste une route HTTP de l'app web. |

## Architecture cible

```
budget-t3-turbo/
├── apps/
│   ├── tanstack-start/     # app web : routes /, /banques, /banques/ajouter, /callback, /login
│   └── expo/               # squelette template renommé, branché sur l'API + auth
├── packages/
│   ├── db/                 # @budget/db — schéma budget porté + auth-schema.ts, driver pg
│   ├── api/                # @budget/api — routers tRPC + logique EB + scripts CLI + tests
│   ├── auth/               # @budget/auth — Better Auth (email/password)
│   ├── ui/                 # @budget/ui — composants shadcn/Base UI portés de budget-tracker
│   └── validators/         # @budget/validators — inchangé (placeholder)
├── tooling/                # inchangé (eslint, prettier, tailwind, typescript, github)
├── docker-compose.yml      # repris de budget-tracker
└── data/                   # JSON de transactions + credentials EB recopiés pour la ré-importation
```

### `@budget/db`

- `schema.ts` : port intégral du schéma budget-tracker (`app_settings`, `bank_connections`,
  `auth_requests`, `accounts`, `categories`, `transactions` — mêmes colonnes, index et enums),
  la table `post` du template est supprimée.
- `auth-schema.ts` : tables Better Auth régénérées (`pnpm auth:generate`).
- `client.ts` : driver `@vercel/postgres` remplacé par `pg` (node-postgres), comme dans l'app source.

### `@budget/api`

Cinq routers tRPC, transposition des server functions existantes :

| Router | Source | Procédures |
| --- | --- | --- |
| `transactions` | `server/transactions.ts` | liste filtrée (période, recherche, compte, catégorie), mise à jour de catégorie |
| `categories` | `server/categories.ts` | liste, création, édition |
| `connections` | `server/connections.ts` + `connections-core.server.ts` | liste, ASPSPs, démarrage d'auth, finalisation de session, suppression/renouvellement |
| `settings` | `server/settings.ts` + `settings-core.server.ts` | lecture/écriture config Enable Banking (onboarding) |
| `sync` | `server/sync.ts` + `sync-core.server.ts` + `eb-sync.server.ts` | déclenchement du pipeline complet |

- Logique pure dans `packages/api/src/lib/` : `eb-client`, `eb-domain`, `sync-core`,
  `connections-core`, `settings-core` + leurs tests Vitest (config Vitest minimale ajoutée au package).
- Toutes les procédures budget sont des `protectedProcedure`.
- Erreurs métier remontées en `TRPCError` ; les états d'erreur existants du wizard bancaire sont conservés.
- Scripts CLI dans `packages/api/scripts/` : `import.ts`, `categorize.ts` (+ `categorize-core`,
  `normalize`, `slug` et leurs tests), `sync.ts`. Exécutés via tsx.
  Raccourcis racine : `pnpm import`, `pnpm categorize`, `pnpm sync`.
  **Règle inchangée : ne jamais lancer `sync` sans demande explicite de l'utilisateur** (sessions bancaires réelles).

### `@budget/auth`

- Better Auth en email + mot de passe (`emailAndPassword: { enabled: true }`), config Discord retirée.
- Plugin Expo conservé (le template l'a déjà câblé).
- Mono-utilisateur de fait : Max crée son compte au premier lancement (pas de logique d'invitation).

### `@budget/ui`

- Les composants `src/components/ui/*` de budget-tracker (button, button-group, card, table,
  select, input, popover, calendar, badge, field, label, separator, sonner) deviennent le
  contenu canonique du package et remplacent les composants du template.
- `theme.tsx` (next-themes) conservé ; rendu visuel identique à l'app actuelle.

### App web `apps/tanstack-start`

- Routes portées : `/` (table de transactions + filtres), `/banques` (connexions + onboarding),
  `/banques/ajouter` (wizard), `/callback` (route HTTP, finalise la session via le router
  `connections` puis redirige vers `/banques`).
- Nouvelle route `/login` (email + mot de passe) ; routes budget protégées par session.
- Données via hooks tRPC + TanStack Query, prefetch dans les loaders (pattern du template).
- Composants applicatifs (`transactions-filters`, `calendar-filter`, `connection-card`,
  `onboarding`, `range-picker`, `search-input`) restent dans l'app.
- Toasts sonner conservés (`sync-toast`).

### App `apps/expo`

- Squelette du template renommé `@budget/expo`, pointé sur la nouvelle API et le login
  email/mot de passe. Écrans d'exemple « post » remplacés par un placeholder.
- Hors périmètre : tout écran budget réel.

## Environnement

`.env` unique à la racine :

| Variable | Usage |
| --- | --- |
| `POSTGRES_URL` | `postgres://budget:budget@localhost:5436/budget_t3` |
| `AUTH_SECRET` | Better Auth |
| `ANTHROPIC_API_KEY` | script `categorize` uniquement (optionnelle dans le schéma env) |

Variables Discord supprimées. `env.ts` de l'app web mis à jour en conséquence.

## Conventions

- Tooling du monorepo adopté : Prettier + ESLint du template (oxfmt abandonné).
- Strings utilisateur, noms de catégories et commentaires : **en français** (convention existante).
- Le CLAUDE.md du monorepo reprend la doc vérifiée de budget-tracker (choix Enable Banking,
  tableau de couverture des 3 banques, règles ASPSP, règle `sync`).

## Récupération des données (procédure)

1. `docker compose up -d` (instance existante), création de la base `budget_t3`.
2. `pnpm db:push` (nouveau schéma complet, y compris tables Better Auth).
3. Copie de `budget-tracker/data/*.json` → `data/`.
4. `pnpm import` (recrée comptes + transactions depuis les JSON du 19 juillet).
5. `pnpm categorize` (recatégorisation LLM — nécessite `ANTHROPIC_API_KEY`).
6. Re-autorisation des 3 banques via l'UI `/banques` (SCA), à la main, quand l'utilisateur le décide.

## Tests

- Les 4 suites Vitest existantes migrent avec leur code : `eb-domain`, `sync-core`
  (dans `@budget/api/src/lib`), `categorize-core`, `normalize` (avec les scripts).
- Tâche `test` ajoutée à `turbo.json` ; `pnpm test` à la racine.

## Vérification de fin de migration

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` passent.
2. Procédure de récupération des données déroulée : transactions et catégories présentes en base.
3. App web : login OK, table des transactions affiche les données réelles, filtres fonctionnels,
   `/banques` se rend (liste vide + onboarding accessible).
4. Le repo `budget-tracker` n'est **pas modifié** — il reste la référence tant que la parité
   n'est pas confirmée par l'utilisateur.

## Hors périmètre

- Approche B (écriture directe en DB sans JSON intermédiaires).
- Écrans budget dans Expo.
- Déploiement (hébergement, Postgres managé) — nécessaire un jour pour le mobile hors réseau local.
- Archivage/suppression de budget-tracker.
