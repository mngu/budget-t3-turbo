# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal finance tool (in French — user-facing strings, comments, and category names should be in French) for syncing transactions from 3 personal bank accounts, categorizing them, and generating budget/savings reports.

This is a pnpm + Turborepo monorepo (migrated from the single-package `budget-tracker` CLI tool). It reuses the same business pipeline (Enable Banking → import → categorize → PostgreSQL → transactions table) but split across workspace packages and apps.

## Architecture

- `@budget/db` — schéma Drizzle + `pg`, base **`budget_t3`**.
- `@budget/api` — routeurs tRPC (`auth`, `transactions`, `categories`, `connections`, `settings`, `sync`), logique Enable Banking dans `src/lib/` (`eb-client.ts`, `eb-domain.ts`, `eb-sync.ts`, `connections-core.ts`, `settings-core.ts`, `sync-core.ts`), scripts CLI dans `scripts/` (`import.ts`, `categorize.ts`, `sync.ts`, `normalize.ts`, `slug.ts`), tests Vitest.
- `@budget/auth` — Better Auth, email/mot de passe.
- `@budget/ui` — composants Base UI. Déviation assumée par rapport au template create-t3-turbo : le `ThemeProvider` maison a été conservé (pas `next-themes`), `ThemeToggle` réécrit sans dropdown.
- `@budget/validators` — schémas Zod partagés.
- `apps/tanstack-start` — app web, routes `/`, `/banques`, `/banques/ajouter`, `/callback`, `/login` sous le layout `_authed`.
- `apps/expo` — placeholder + login (mobile).

Pipeline métier inchangé : connexions bancaires configurées dans l'app (`/banques` : onboarding Enable Banking, wizard d'ajout, callback OAuth sur `/callback`, sessions stockées en DB) → sync → `data/*.json` (racine du monorepo) → import (`packages/api/scripts/import.ts`) → PostgreSQL → tRPC (`@budget/api` routers) → table des transactions (`apps/tanstack-start`).

## Commands

- `pnpm dev` — turbo watch dev (tous les packages/apps en mode dev).
- `pnpm -F @budget/tanstack-start dev` — web app seule, http://localhost:3000 (port aligné sur l'URL de callback Enable Banking `http://localhost:3000/callback`).
- `docker compose up -d` — Postgres 17 local (port hôte 5436). **Instance partagée avec l'ancien repo `budget-tracker`** (même conteneur, même volume).
- `pnpm db:push` — push du schéma Drizzle (turbo task interactive) ; **échoue dans un environnement non-TTY**. Fallback : `pnpm -F @budget/db with-env drizzle-kit push`.
- `pnpm run import` — import de `data/*.json` en PostgreSQL puis catégorisation (idempotent — safe à relancer). **Ne pas utiliser `pnpm import`** (sans `run`) : cette forme est interceptée par la commande interne de pnpm de conversion de lockfile et supprimerait `pnpm-lock.yaml`.
- `pnpm categorize` — catégorisation LLM des transactions sans catégorie (idempotent, garde `IS NULL`). Fonctionne tel quel (pas de collision de nom).
- `pnpm sync` — pipeline complet : Enable Banking → import → catégorisation (équivalent au bouton Sync de l'app). Fonctionne tel quel (pas de collision de nom). **Never run `sync` on behalf of the user** — it touches live bank sessions and triggers SCA; only run when explicitly asked, and the bank authorization (auth/SCA) happens in the app, page `/banques` — there is no CLI `auth`/`banks` command anymore.
- `pnpm test` — turbo run test (Vitest sur tous les packages).
- `pnpm build` / `pnpm typecheck` / `pnpm lint` — turbo run sur tout le monorepo.

## Base de données — ne jamais confondre avec l'ancien repo

La base de ce projet est **`budget_t3`** (instance Docker **partagée** avec `budget-tracker`, port hôte 5436). Ne JAMAIS lancer un push (`db:push` / `drizzle-kit push`) ou toute commande destructive avec une `POSTGRES_URL` pointant sur la base `budget` (celle de l'ancien repo) — vérifier systématiquement le nom de la base dans `POSTGRES_URL`/`.env` avant toute opération de schéma.

### Seed initial de la table `categories`

Sur un clone neuf, la table `categories` est vide tant qu'elle n'a pas été seedée — `pnpm categorize` fonctionne quand même (no-op silencieux, les transactions restent sans catégorie). Seeder avant la première catégorisation :

```sql
INSERT INTO categories (name, color) VALUES
  ('Revenus', '#16a34a'), ('Logement', '#6366f1'), ('Alimentation', '#f59e0b'),
  ('Restaurants & bars', '#10b981'), ('Transport', '#3b82f6'), ('Santé', '#ec4899'),
  ('Abonnements', '#84cc16'), ('Loisirs & shopping', '#8b5cf6'),
  ('Épargne & virements internes', '#f97316'), ('Frais & impôts', '#6366f1'), ('Autres', '#94a3b8')
ON CONFLICT (name) DO NOTHING;
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
