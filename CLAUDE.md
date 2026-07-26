# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal finance tool (in French — user-facing strings, comments, and category names should be in French) for syncing transactions from 3 personal bank accounts, categorizing them, and generating budget/savings reports.

This is a pnpm + Turborepo monorepo (migrated from the single-package `budget-tracker` CLI tool). It reuses the same business pipeline (Enable Banking → import → categorize → PostgreSQL → transactions table) but split across workspace packages and apps.

## Architecture

- `@budget/db` — schéma Drizzle + `pg`, base **`budget_t3`**.
- `@budget/api` — **tout est piloté depuis la webapp, il n'y a plus aucun script CLI** (`scripts/` a disparu). Organisation en dossiers par domaine sous `src/` :
  - `router/` — adaptateurs tRPC uniquement (`auth`, `transactions`, `categories`, `connections`, `settings`, `sync`) : schéma zod d'entrée + délégation, aucune requête SQL. **Y remettre de la logique métier est une régression.**
  - `banking/` — Enable Banking : `client.ts`, `domain.ts`, `settings.ts`, `connections.ts`, `fetch-transactions.ts`.
  - `transactions/` — `normalize.ts`, `import.ts`, `queries.ts`.
  - `categorization/` — `prompt.ts`, `results.ts`, `similar.ts`, `run.ts`.
  - `categories/` — `queries.ts`, `mutations.ts`, `suggestions/{analyze,apply,state,schema,replace-plan}.ts`.
  - `pipeline.ts` — `performSync` / `performImport`, cross-domaine. `lib/` ne garde que le transverse (`data-dir.ts`, `single-flight.ts`).

  Le sens des dépendances est `router/` → domaines → `lib/`, jamais l'inverse : c'est l'inversion `src/lib/` → `scripts/` qui avait imposé les suffixes `-core`, tous supprimés. Les services importent `db` directement (même singleton que `ctx.db`, voir `trpc.ts`). `lib/single-flight.ts` sérialise les opérations longues : clé `sync` (sync + import) et clé `categorize`, partagée entre la catégorisation déclenchée par le pipeline et celle déclenchée depuis l'UI.

  Deux pièges de configuration liés à la disparition de `scripts/` : `tsconfig.include` vaut `["src"]`, donc `tsc` émet `dist/index.d.ts` (et non `dist/src/…`) — `exports.types` doit suivre, sinon les apps ne résolvent plus les types de `@budget/api`. Et l'exception eslint sur les règles `no-unsafe-*` (code Enable Banking porté, `ebApi` non typé) nomme ses fichiers un par un : ne jamais la remplacer par un glob de dossier, elle exempterait silencieusement du code neuf.
  - **Catégories intelligentes** (arborescence parent/enfant, `categories.parent_id`) : le routeur `categoriesRouter` expose `tree` (arborescence complète) en plus de `list`.
    - **Suggestions** (`src/categories/suggestions/`) — un LLM (Claude Sonnet) analyse un échantillon de transactions récentes (6 derniers mois, max 500) et propose une arborescence parent → sous-catégories avec les `txnIds` correspondants, exposée via `categoriesRouter.suggestions.{generate,status,apply}` et la page `/categories` (`apps/tanstack-start`), qui affiche aussi l'arborescence des catégories existantes (avec leur nombre de transactions, renommage/suppression) et un bandeau du nombre de transactions sans catégorie. L'état du dernier run est **en mémoire process** (pas de table dédiée) — se perd au redémarrage du serveur, il suffit de relancer l'analyse. L'analyse se déclenche depuis l'UI (`/categories`) — il n'y a plus de commande CLI.
    - **Catégorisation few-shot** (`src/categorization/similar.ts`, `prompt.ts`, `results.ts`) — avant l'appel LLM, `findSimilar()` cherche des transactions déjà catégorisées proches (contrepartie exacte > trigrammes `pg_trgm` sur la description > `bank_code`/MCC en dernier recours, priorité aux corrections `categorySource = 'manual'`) et les injecte comme exemples dans le prompt (`buildFewShotPrompt`). Fallback silencieux vers le prompt générique si aucune similaire trouvée. Nécessite l'extension PostgreSQL `pg_trgm` (voir plus bas). Ces exemples sont des **indices, pas une autorité** : le tier de repli `bank_code`/MCC est très générique (ex. `C2` = « virement reçu » chez SG) et remonte des exemples hétéroclites — le prompt demande explicitement de ne classer par analogie que si la transaction est de même nature.
    - **Ne jamais coder en dur un nom de catégorie dans le prompt** (`buildSystemPrompt`) — la catégorisation ne s'appuie que sur les catégories réellement présentes en base. Une règle citant une catégorie absente de la liste (le prompt mentionnait « Revenus », « Autres », « Apport Alex » après un remplacement d'arborescence) fait répondre le LLM hors liste ; la réponse est rejetée et la transaction n'est **jamais** catégorisée, à chaque run. Quand aucune catégorie existante ne convient, le LLM répond `categorie: null` : `partitionResults` sépare ces refus assumés (`declined`) des réponses aberrantes (`rejected`, catégorie inconnue ou id hors lot), et `categorization/run.ts` logue les deux — ne jamais les confondre ni les avaler en silence, c'est ce qui rendait le désalignement invisible.
    - **Les deux process se complètent** : la catégorisation classe avec l'existant, les suggestions créent ce qui manque. Attention, la boucle n'est pas totalement fermée — `sampleTransactions` (`categories/suggestions/analyze.ts`) échantillonne les transactions **récentes**, catégorisées ou non (filtre sur `bookingDate` uniquement), sans prioriser celles laissées sans catégorie.

- `@budget/auth` — Better Auth, email/mot de passe.
- `@budget/ui` — composants Base UI. Déviation assumée par rapport au template create-t3-turbo : le `ThemeProvider` maison a été conservé (pas `next-themes`), `ThemeToggle` réécrit sans dropdown.
- `@budget/validators` — schémas Zod partagés.
- `apps/tanstack-start` — app web, routes `/`, `/banques`, `/banques/ajouter`, `/callback`, `/login` sous le layout `_authed`.
- `apps/expo` — app mobile (login, transactions + filtres, KPIs, banques) en gluestack-ui v5 + nativewind. **Développement en suspens** (décision du 2026-07-23) : l'objectif est une vraie app universelle web+native, ce que gluestack ne permet pas correctement aujourd'hui — ne pas y ajouter de features sans que ce soit explicitement demandé.

### Notes app mobile (pour la reprise éventuelle)

- Tester sur téléphone : `pnpm -F @budget/expo dev` (Metro port 8081, mode LAN) + web app sur 3000 — le serveur Vite doit écouter en LAN (`host: true` dans `vite.config.ts`, déjà en place) pour que le téléphone atteigne l'API. Sur émulateur : ouvrir `exp://10.0.2.2:8081`.
- CORS + `trustedOrigins` better-auth sont ouverts à `localhost:*` en dev uniquement (`apps/tanstack-start/src/lib/cors.ts`, `src/auth/server.ts`) pour le mode web d'Expo.
- `tooling/tailwind/theme.css` n'est consommé que par `apps/expo`. Ne jamais y remettre d'auto-références type tweakcn (`--shadow-sm: var(--shadow-sm)`) : inertes sur le web, elles font crasher nativewind à l'exécution (« Maximum call stack size exceeded ») — voir le commentaire dans le fichier. Après modification de ce fichier, relancer Metro avec `--clear`.

Pipeline métier inchangé : connexions bancaires configurées dans l'app (`/banques` : onboarding Enable Banking, wizard d'ajout, callback OAuth sur `/callback`, sessions stockées en DB) → sync → `data/*.json` (racine du monorepo) → import (`packages/api/src/transactions/import.ts`) → PostgreSQL → tRPC (`@budget/api` routers) → table des transactions (`apps/tanstack-start`).

## Commands

- `pnpm dev` — turbo watch dev (tous les packages/apps en mode dev).
- `pnpm -F @budget/tanstack-start dev` — web app seule, http://localhost:3000 (port aligné sur l'URL de callback Enable Banking `http://localhost:3000/callback`).
- `docker compose up -d` — Postgres 17 local (port hôte 5436). **Instance partagée avec l'ancien repo `budget-tracker`** (même conteneur, même volume).
- `pnpm db:push` — push du schéma Drizzle (turbo task interactive) ; **échoue dans un environnement non-TTY**. Fallback : `pnpm -F @budget/db with-env drizzle-kit push`.
- `pnpm test` — turbo run test (Vitest sur tous les packages).
- `pnpm build` / `pnpm typecheck` / `pnpm lint` — turbo run sur tout le monorepo.

**Il n'existe plus de commande CLI métier** (`import`, `categorize`, `suggest-categories`, `sync` ont été supprimées) : tout se déclenche depuis la webapp, via les mutations tRPC correspondantes.

- `sync.run` (bouton Synchroniser) — pipeline complet Enable Banking → import → catégorisation. **Never trigger `sync.run` on behalf of the user** : il touche aux sessions bancaires réelles et déclenche une SCA. L'autorisation bancaire se fait sur la page `/banques`.
- `sync.import` — rejoue l'import des `data/*.json` déjà présents puis la catégorisation, **sans aucun appel bancaire** (ni SCA, ni consommation du quota PSD2). C'est le remplaçant de l'ancien `pnpm run import` ; idempotent, safe à relancer.
- `categories.categorize` — catégorisation LLM des transactions sans catégorie (idempotent, garde `IS NULL`). Une transaction qu'aucune catégorie existante ne décrit reste volontairement sans catégorie et sera resoumise au run suivant : un `remaining` qui ne bouge pas signale une branche manquante dans l'arborescence, pas un bug — lancer l'analyse de suggestions depuis `/categories`.
- `categories.suggestions.generate` — analyse LLM proposant une arborescence ; n'écrit rien en base tant que `apply` n'est pas appelé.

## Base de données — ne jamais confondre avec l'ancien repo

La base de ce projet est **`budget_t3`** (instance Docker **partagée** avec `budget-tracker`, port hôte 5436). Ne JAMAIS lancer un push (`db:push` / `drizzle-kit push`) ou toute commande destructive avec une `POSTGRES_URL` pointant sur la base `budget` (celle de l'ancien repo) — vérifier systématiquement le nom de la base dans `POSTGRES_URL`/`.env` avant toute opération de schéma.

### Seed initial de la table `categories`

Sur un clone neuf, la table `categories` est vide tant qu'elle n'a pas été seedée — la catégorisation fonctionne quand même (no-op silencieux, les transactions restent sans catégorie). Seeder avant la première catégorisation :

```sql
INSERT INTO categories (name, color) VALUES
  ('Revenus', '#16a34a'), ('Logement', '#6366f1'), ('Alimentation', '#f59e0b'),
  ('Restaurants & bars', '#10b981'), ('Transport', '#3b82f6'), ('Santé', '#ec4899'),
  ('Abonnements', '#84cc16'), ('Loisirs & shopping', '#8b5cf6'),
  ('Épargne & virements internes', '#f97316'), ('Frais & impôts', '#6366f1'), ('Autres', '#94a3b8')
ON CONFLICT (name) DO NOTHING;
```

Ce seed n'est qu'un point de départ : aucun de ces noms n'est référencé par le code (le prompt de catégorisation lit la table, voir Architecture). L'arborescence est censée diverger de cette liste au fil des suggestions appliquées depuis `/categories`.

### Extension `pg_trgm` (catégorisation few-shot)

La recherche de transactions similaires (`similar-transactions.ts`) utilise `similarity()` sur la description, fourni par l'extension PostgreSQL `pg_trgm`. Activée automatiquement sur un volume Docker neuf via `docker-initdb/01-pg_trgm.sql` (monté dans `/docker-entrypoint-initdb.d`, ne s'exécute qu'à la création initiale du volume — voir `docker-compose.yml`).

Sur une instance déjà initialisée avant ce script (ex. le volume partagé avec `budget-tracker`), l'activer manuellement une fois (survit à `db:push`, pas géré par Drizzle) :

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Bank data provider: Enable Banking (not GoCardless)

This was a deliberate decision after research, not an assumption — do not revert to GoCardless without re-checking the facts below.

**Why not GoCardless (ex-Nordigen):** confirmed directly on `bankaccountdata.gocardless.com/new-signups-disabled` that GoCardless Bank Account Data is **closed to new signups** — a new project cannot get credentials for it. (If a `secret_id`/`secret_key` from before the shutdown ever surfaces, it might still work, but that can't be relied on for new setup instructions.)

**Chosen alternative: [Enable Banking](https://enablebanking.com).** Verified reasons it fits this project specifically:

- Self-serve signup (just an email — no company/SIRET required to create an account).
- Its **Restricted Production** mode is free, uses real bank data, and its terms explicitly permit _"the personal use of private individuals"_ — this project's exact use case (own accounts, non-commercial). In this mode only accounts you personally link are accessible.
- 2700+ banks across 30 European countries.
- It's the option the wider open-source personal-finance community converged on post-GoCardless-shutdown (e.g. the "Enable Actual" community integration for Actual Budget).
- Trade-off to keep in mind: among mainstream providers, it is close to the _only_ one offering free self-serve access for individuals — Powens, Bridge/Bankin, Tink, Yapily are B2B/sales-led only; Plaid's free tier is US/Canada-only. That's a single-vendor dependency risk (the same kind of risk that just killed the GoCardless setup), acceptable for a hobby project but worth remembering if this ever needs a second provider.
- Regulatory note independent of provider: PSD2 consent must be renewed periodically (~180 days for most EEA ASPSPs) — periodic sync will never be fully unattended long-term; expect to re-authenticate roughly twice a year regardless of provider.

### Verified coverage for this project's 3 banks (checked against `enablebanking.com/docs/markets/fr/` and `/docs/markets/lt/`)

| Bank                 | Supported                           | Auth flow                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Société Générale** | Yes                                 | Redirect, SCA via push notification in **L'Appli SG**                    | Automatic app switch is **not** supported — user must manually switch to the SG app during auth, no seamless redirect                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Caisse d'Épargne** | Yes (as a BPCE regional-bank group) | Redirect, SCA via the **Banxo** app (shared across all regional caisses) | Automatic app switch **is** supported. **Confirmed against the live `/aspsps?country=FR` endpoint (2026-07-12):** Enable Banking exposes 15 regional ASPSPs, identified by exact `name` + `country` (not an institution ID) — this project uses `"Caisse d'Epargne Ile De France"` (note: no accents, "Ile De France" capitalization). `maximum_consent_validity` is 15552000s = 180 days. Never guess ASPSP names; re-query `/aspsps` if in doubt (a fabricated institution ID is what broke the previous GoCardless implementation) |
| **Revolut**          | Yes                                 | Redirect, SCA via Revolut app or PIN+SMS                                 | Listed under **Lithuania** in Enable Banking's docs, not France — this is expected/correct: PSD2 identifies an ASPSP by its licensing country (Revolut Bank UAB is Lithuania-licensed), not the end user's country. Automatic app switch supported if the app is installed. Credit card accounts are only selectable via Revolut's own mobile-app consent flow, not the web flow                                                                                                                                                      |

## Conventions

- Keep user-facing strings (UI text, report text, category names) in French.
