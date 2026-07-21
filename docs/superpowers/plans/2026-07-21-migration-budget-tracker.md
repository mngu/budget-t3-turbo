# Migration budget-tracker → monorepo t3-turbo — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer l'app budget-tracker (dossier frère `/Users/max/WebstormProjects/budget-tracker`, TanStack Start + Drizzle + Enable Banking) dans ce monorepo t3-turbo, iso-fonctionnel, avec couche tRPC partagée et récupération des données effacées.

**Architecture:** Les server functions deviennent des routers tRPC dans `@budget/api` (logique pure dans `src/lib/`, scripts CLI dans `scripts/`). Le schéma Drizzle part dans `@budget/db` (driver `pg`, base locale `budget_t3`). L'app web `apps/tanstack-start` porte les routes existantes derrière un layout authentifié (Better Auth email/mot de passe). Les composants shadcn/Base UI de la source deviennent `@budget/ui`.

**Tech Stack:** pnpm + Turborepo, TanStack Start/Router/Query, tRPC v11 + superjson, Drizzle + node-postgres, Better Auth, Base UI + Tailwind v4, Vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-07-21-migration-budget-tracker-t3-turbo-design.md`

## Global Constraints

- **Ne jamais lancer `pnpm sync`** (ni `scripts/sync.ts`) — sessions bancaires réelles ; seul l'utilisateur le déclenche.
- **Ne rien modifier dans `/Users/max/WebstormProjects/budget-tracker`** — repo source en lecture seule (référence de parité).
- **Base de données : `budget_t3`** — avant tout `db:push`, vérifier que `POSTGRES_URL` se termine par `/budget_t3`. Ne jamais pousser sur la base `budget`.
- Strings utilisateur, noms de catégories, commentaires : **en français**.
- Iso-fonctionnel : aucune évolution de comportement par rapport à la source.
- Scope packages : `@budget/*` (jamais `@acme/*` dans du nouveau code).
- Nouveau code : imports zod en `zod/v4` (style template), pas `zod`.
- Après chaque tâche : `pnpm typecheck` vert avant commit.
- `SOURCE` désigne ci-dessous `/Users/max/WebstormProjects/budget-tracker`.

## Référence R1 — Table de conversion des imports (fichiers portés)

À appliquer à chaque fichier copié depuis SOURCE (seuls les imports changent, le corps du code reste identique sauf mention explicite) :

| Import source | Import cible |
| --- | --- |
| `from "zod"` | `from "zod/v4"` |
| `from "../db/client"` ou `from "@/db/client"` | `from "@budget/db/client"` |
| `from "../db/schema"`, `from "../src/db/schema"`, `from "@/db/schema"` | `from "@budget/db/schema"` |
| `from "drizzle-orm"` | `from "@budget/db"` (le package ré-exporte `drizzle-orm/sql` + `alias`) |
| `from "./eb-domain.server"` | `from "./eb-domain"` (même motif pour tous les `*.server`) |
| `from "../src/db/client"` (scripts) | `from "@budget/db/client"` |
| `from "@/components/ui/<x>"` | `from "@budget/ui/<x>"` (`sonner` → `@budget/ui/toast`) |
| `from "@/lib/utils"` (cn) | `from "@budget/ui"` |
| `from "@/lib/date"` | `from "~/lib/date"` |
| `from "@/lib/sync-toast"` | `from "~/lib/sync-toast"` |
| `from "@/components/search-input"` | `from "~/component/search-input"` |
| `from "@/components/range-picker/range-picker"` | `from "~/component/range-picker"` |
| `from "@/server/transactions"` | schéma/constantes → `@budget/validators` ; types lignes → `RouterOutputs` de `@budget/api` (détail en Task 10) |
| `from "@/server/categories"` etc. | procédures → client tRPC ; types → exports de `@budget/api` (détail en Tasks 10–11) |

L'alias de chemin du template web est `~/` (pas `@/`).

---

### Task 1 : Renommage `@acme` → `@budget` et suppression d'apps/nextjs

**Files:**
- Delete: `apps/nextjs/`
- Modify: tous les fichiers contenant `@acme/` (package.json, sources, tooling), `package.json` racine

**Interfaces:**
- Produces: packages `@budget/db`, `@budget/api`, `@budget/auth`, `@budget/ui`, `@budget/validators`, apps `@budget/tanstack-start`, `@budget/expo` — noms utilisés par toutes les tâches suivantes.

- [ ] **Step 1 : Supprimer l'app Next.js**

```bash
git rm -r apps/nextjs
```

- [ ] **Step 2 : Renommer le scope partout**

```bash
grep -rl '@acme/' --exclude-dir=node_modules --exclude=pnpm-lock.yaml . | xargs sed -i '' 's|@acme/|@budget/|g'
```

- [ ] **Step 3 : Nettoyer les scripts racine**

Dans `package.json` racine : supprimer le script `dev:next` (référence l'app supprimée). Vérifier que `auth:generate`, `db:push`, `db:studio` pointent bien vers `@budget/auth` / `@budget/db` après le sed.

- [ ] **Step 4 : Réinstaller et vérifier**

```bash
grep -r '@acme' --exclude-dir=node_modules --exclude=pnpm-lock.yaml . ; echo "exit=$?"
```
Expected: aucun résultat, `exit=1`.

```bash
pnpm install && pnpm typecheck
```
Expected: install OK (lockfile mis à jour), typecheck PASS sur tous les packages.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "chore: renomme le scope @acme en @budget et supprime apps/nextjs"
```

---

### Task 2 : Infra locale — docker-compose, .env, base `budget_t3`

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: base PostgreSQL `budget_t3` joignable via `POSTGRES_URL=postgres://budget:budget@localhost:5436/budget_t3` — utilisée par toutes les tâches DB.

- [ ] **Step 1 : Créer `docker-compose.yml`**

Le `name: budget-tracker` est délibéré : il fait pointer compose sur le conteneur `budget-tracker-db-1` et le volume `budget-tracker_pgdata` **existants** (déjà en route sur le port 5436) au lieu d'en créer un second qui entrerait en conflit de port.

```yaml
# Réutilise l'instance Postgres locale de budget-tracker (même conteneur, même volume).
# La base de CE projet est `budget_t3` — la base `budget` appartient à l'ancien repo.
name: budget-tracker

services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: budget
      POSTGRES_PASSWORD: budget
      POSTGRES_DB: budget
    ports:
      # 5436 côté hôte : 5432-5435 occupés par d'autres projets locaux
      - "5436:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2 : Créer la base `budget_t3`**

```bash
docker compose up -d && docker compose exec -T db psql -U budget -d postgres -c 'CREATE DATABASE budget_t3'
```
Expected: `CREATE DATABASE` (ou erreur « already exists » si relance — acceptable).

- [ ] **Step 3 : Mettre à jour `.env` et `.env.example`**

Dans `.env` : remplacer la ligne `POSTGRES_URL=...` par `POSTGRES_URL=postgres://budget:budget@localhost:5436/budget_t3` ; supprimer `AUTH_DISCORD_ID` et `AUTH_DISCORD_SECRET` ; conserver `AUTH_SECRET` ; ajouter `ANTHROPIC_API_KEY=<valeur copiée depuis SOURCE/.env>`.

`.env.example` :

```bash
# Postgres local (docker compose up -d) — base budget_t3, jamais la base budget
POSTGRES_URL=postgres://budget:budget@localhost:5436/budget_t3

# Better Auth (openssl rand -base64 32)
AUTH_SECRET=

# Catégorisation LLM (script categorize uniquement)
ANTHROPIC_API_KEY=
```

- [ ] **Step 4 : Ignorer `.idea/` et `data/`**

Ajouter à `.gitignore` :

```
.idea/
data/
```

- [ ] **Step 5 : Vérifier la connexion**

```bash
docker compose exec -T db psql -U budget -d budget_t3 -c 'SELECT 1'
```
Expected: `1`.

- [ ] **Step 6 : Commit**

```bash
git add docker-compose.yml .env.example .gitignore && git commit -m "chore: docker compose partagé et base locale budget_t3"
```

---

### Task 3 : `@budget/db` — schéma budget, driver pg, purge du feature post

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/client.ts`, `packages/db/package.json`, `packages/api/src/root.ts`, `apps/tanstack-start/src/routes/index.tsx`, `apps/expo/src/app/index.tsx`
- Delete: `packages/api/src/router/post.ts`, `apps/expo/src/app/post/[id].tsx`

**Interfaces:**
- Consumes: base `budget_t3` (Task 2).
- Produces: `@budget/db/schema` exporte `appSettings`, `bankConnections`, `authRequests`, `accounts`, `categories`, `transactions`, types `NewAccount`, `NewTransaction`, `NewCategory`, `AppSettingsRow`, `BankConnection`, `AuthRequest` + tables Better Auth (`user`, `session`, `account`, `verification`). `@budget/db/client` exporte `db` (drizzle + pg Pool).

- [ ] **Step 1 : Porter le schéma**

```bash
cp /Users/max/WebstormProjects/budget-tracker/src/db/schema.ts packages/db/src/schema.ts
```

Puis ajouter en dernière ligne de `packages/db/src/schema.ts` (les tables Better Auth restent co-exportées, comme dans le template ; pas de collision : la table budget s'appelle `accounts`, celle de Better Auth `account`) :

```ts
export * from "./auth-schema";
```

Le fichier ne contient plus ni `Post` ni `CreatePostSchema`.

- [ ] **Step 2 : Remplacer le driver par pg**

`packages/db/src/client.ts` en entier :

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error(
    "POSTGRES_URL manquante — copiez .env.example vers .env (voir docker-compose.yml).",
  );
}

export const db = drizzle({
  client: new Pool({ connectionString }),
  schema,
  casing: "snake_case",
});
```

- [ ] **Step 3 : Dépendances du package db**

Dans `packages/db/package.json` : dans `dependencies`, supprimer `"@vercel/postgres": "^0.10.0"`, ajouter `"pg": "^8.22.0"` ; dans `devDependencies`, ajouter `"@types/pg": "^8.20.0"`. Conserver drizzle-orm/drizzle-zod/zod tels quels (drizzle-zod n'est plus utilisé par le schéma mais reste pour usage futur — le retirer aussi si `grep -r drizzle-zod packages apps` ne renvoie rien après ce step : c'est le cas attendu, `CreatePostSchema` ayant disparu).

- [ ] **Step 4 : Purger le feature post**

```bash
git rm packages/api/src/router/post.ts apps/expo/src/app/post/\[id\].tsx
```

`packages/api/src/root.ts` en entier :

```ts
import { authRouter } from "./router/auth";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
```

`apps/tanstack-start/src/routes/index.tsx` en entier (placeholder provisoire, remplacé en Task 10) :

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-bold">Budget — migration en cours</h1>
    </main>
  );
}
```

`apps/expo/src/app/index.tsx` en entier (stub provisoire, remplacé en Task 12 — `_layout.tsx` ne référence pas post, rien d'autre à toucher) :

```tsx
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function Index() {
  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Budget" }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Budget
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5 : Pousser le schéma**

```bash
grep 'POSTGRES_URL' .env
```
Expected: l'URL se termine par `/budget_t3` — **sinon STOP**.

```bash
pnpm db:push
```
Expected: création des tables `app_settings`, `bank_connections`, `auth_requests`, `accounts`, `categories`, `transactions`, `user`, `session`, `account`, `verification` dans `budget_t3` (base vierge, pas de prompt destructif).

- [ ] **Step 6 : Vérifier**

```bash
docker compose exec -T db psql -U budget -d budget_t3 -c '\dt'
pnpm typecheck
```
Expected: les 10 tables listées ; typecheck PASS.

- [ ] **Step 7 : Commit**

```bash
git add -A && git commit -m "feat(db): schéma budget porté sur pg, purge du feature post"
```

---

### Task 4 : `@budget/auth` — email + mot de passe, retrait de Discord

**Files:**
- Modify: `packages/auth/src/index.ts`, `packages/auth/env.ts`, `packages/auth/script/auth-cli.ts`, `apps/tanstack-start/src/auth/server.ts`
- Delete: `apps/tanstack-start/src/component/auth-showcase.tsx`

**Interfaces:**
- Consumes: `@budget/db/client` (adapter drizzle).
- Produces: `initAuth(options: { baseUrl: string; secret: string | undefined; extraPlugins?: BetterAuthPlugin[] })`, types `Auth`, `Session` — consommés par l'app web (Task 9), Expo (Task 12) et le contexte tRPC (inchangé).

- [ ] **Step 1 : Réécrire `packages/auth/src/index.ts`**

```ts
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@budget/db/client";

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  secret: string | undefined;
  extraPlugins?: TExtraPlugins;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [expo(), ...(options.extraPlugins ?? [])],
    trustedOrigins: ["expo://"],
    onAPIError: {
      onError(error, ctx) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
```

(Disparus : `oAuthProxy`, `socialProviders.discord`, `productionUrl`, `discordClientId/Secret`.)

- [ ] **Step 2 : Réécrire `packages/auth/env.ts`**

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "production"]).optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
```

- [ ] **Step 3 : Mettre à jour `packages/auth/script/auth-cli.ts`**

Remplacer l'appel `initAuth({...})` par :

```ts
export const auth = initAuth({
  baseUrl: "http://localhost:3000",
  secret: "secret",
});
```

(Conserver les commentaires d'en-tête du fichier.)

- [ ] **Step 4 : Mettre à jour `apps/tanstack-start/src/auth/server.ts`**

```ts
import { reactStartCookies } from "better-auth/react-start";

import { initAuth } from "@budget/auth";

import { env } from "~/env";
import { getBaseUrl } from "~/lib/url";

export const auth = initAuth({
  baseUrl: getBaseUrl(),
  secret: env.AUTH_SECRET,

  extraPlugins: [reactStartCookies()],
});
```

- [ ] **Step 5 : Supprimer la vitrine Discord**

```bash
git rm apps/tanstack-start/src/component/auth-showcase.tsx
```
(Plus aucun import ne la référence depuis le placeholder de Task 3 — vérifier avec `grep -r auth-showcase apps`.)

- [ ] **Step 6 : Vérifier que le schéma auth généré est inchangé**

```bash
pnpm auth:generate && git diff --stat packages/db/src/auth-schema.ts
```
Expected: aucun diff (email/password utilise les mêmes tables user/session/account/verification).

- [ ] **Step 7 : Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(auth): Better Auth en email/mot de passe, retrait de Discord"
```

---

### Task 5 : `@budget/api` — logique Enable Banking (lib) + Vitest

**Files:**
- Create: `packages/api/src/lib/eb-domain.ts`, `eb-client.ts`, `connections-core.ts`, `settings-core.ts`, `eb-sync.ts`, `sync-core.ts`, `data-dir.ts`, `eb-domain.test.ts`, `sync-core.test.ts`, `packages/api/vitest.config.ts`
- Modify: `packages/api/package.json`, `turbo.json`, `package.json` (racine)

**Interfaces:**
- Consumes: `@budget/db/client` (`db`), `@budget/db/schema`, `@budget/db` (opérateurs SQL).
- Produces (signatures identiques à la source, consommées par les routers en Task 7) :
  - `eb-domain` : `makeJwt(applicationId, privateKeyPem, now?)`, `clampValidUntil(...)`, `consentBadge(validUntil, now)`, `parseSessionAccounts(raw)`, `reconcileAccounts(...)`, constantes `CONSENT_DAYS`, `CONSENT_WARNING_DAYS`, types `ConsentBadge`, `DiscoveredAccount`, `ExistingAccount`, `AccountReconciliation`
  - `eb-client` : `loadSettings()`, `requireSettings()`, `appJwt(settings)`, `ebApi(path, jwt, init?)`, `getAllAspsps(jwt)`, `EbApiError`, types `EbSettings`, `Aspsp`
  - `connections-core` : `searchAspspsCore(q)`, `startAuthCore(input)`, `completeAuthCore(code, state)`, `listConnectionsCore()`, `getConnectionAccountsCore(id)`, `updateAccountsCore(updates)`, `revokeConnectionCore(id)`, types `AspspOption`, `StartAuthInput`, `CompleteAuthResult`, `AccountSummary`, `ConnectionSummary`, `AccountUpdate`
  - `settings-core` : `getSetupStatusCore()`, `saveSettingsCore(input)`, `invalidateSetupStatus()`, type `SetupStatus`
  - `eb-sync` : `syncBanks(psuHeaders?)`, type `SyncOutcome`
  - `sync-core` : `performSync(psuHeaders?)`
  - `data-dir` : `DATA_DIR` (chemin absolu de `<racine monorepo>/data`)

- [ ] **Step 1 : Copier les fichiers**

```bash
S=/Users/max/WebstormProjects/budget-tracker/src/server
mkdir -p packages/api/src/lib
cp $S/eb-domain.server.ts        packages/api/src/lib/eb-domain.ts
cp $S/eb-domain.server.test.ts   packages/api/src/lib/eb-domain.test.ts
cp $S/eb-client.server.ts        packages/api/src/lib/eb-client.ts
cp $S/connections-core.server.ts packages/api/src/lib/connections-core.ts
cp $S/settings-core.server.ts    packages/api/src/lib/settings-core.ts
cp $S/eb-sync.server.ts          packages/api/src/lib/eb-sync.ts
cp $S/sync-core.server.ts        packages/api/src/lib/sync-core.ts
cp $S/sync-core.server.test.ts   packages/api/src/lib/sync-core.test.ts
```

- [ ] **Step 2 : Créer `packages/api/src/lib/data-dir.ts`**

```ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// data/ vit à la racine du monorepo (JSON Enable Banking + credentials EB),
// quel que soit le cwd (pnpm -F exécute depuis packages/api).
export const DATA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "data",
);
```

- [ ] **Step 3 : Adapter les imports (référence R1)**

Dans chaque fichier copié : appliquer R1 (`../db/client` → `@budget/db/client`, `../db/schema` → `@budget/db/schema`, `drizzle-orm` → `@budget/db`, suffixes `.server` retirés des imports relatifs). Cas particuliers :

- `sync-core.ts` : `import { main as runImport } from "../../scripts/import";` et `"../../scripts/categorize"` — chemins **inchangés** (les scripts arrivent en Task 6 dans `packages/api/scripts/` ; le typecheck de cette tâche est différé au Step 6 note ci-dessous).
- `eb-sync.ts` : remplacer `const dataDir = resolve(process.cwd(), "data");` par :

```ts
import { DATA_DIR } from "./data-dir";
// ...
const dataDir = DATA_DIR;
```

(et retirer l'import `resolve` de `node:path` s'il ne sert plus qu'à cela).

**Note d'ordre :** `sync-core.ts` importe les scripts de la Task 6. Pour garder cette tâche vérifiable indépendamment, exécuter Step 4–5 (Vitest sur eb-domain et sync-core mocké) — le typecheck complet du package ne passera qu'après la Task 6 ; c'est attendu et documenté ici. Si `sync-core.server.test.ts` mocke les imports de scripts (vérifier son contenu au portage), les tests passent dès maintenant.

- [ ] **Step 4 : Configurer Vitest**

`packages/api/vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
```

`packages/api/package.json` : ajouter dans `scripts` : `"test": "vitest run"` ; dans `devDependencies` : `"vitest": "^4.1.10"`.

`turbo.json` : ajouter la tâche :

```json
"test": {
  "dependsOn": ["^topo"],
  "cache": false
}
```

`package.json` racine, dans `scripts` : `"test": "turbo run test"`.

- [ ] **Step 5 : Lancer les tests**

```bash
pnpm install && pnpm -F @budget/api test
```
Expected: suites `eb-domain.test.ts` et `sync-core.test.ts` PASS (si `sync-core.test.ts` échoue sur la résolution des scripts absents, le noter et re-vérifier en fin de Task 6).

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "feat(api): logique Enable Banking portée dans @budget/api avec Vitest"
```

---

### Task 6 : `@budget/api` — scripts CLI (import, categorize, sync)

**Files:**
- Create: `packages/api/scripts/import.ts`, `normalize.ts`, `normalize.test.ts`, `categorize.ts`, `categorize-core.ts`, `categorize-core.test.ts`, `slug.ts`, `sync.ts`
- Modify: `packages/api/package.json`, `package.json` (racine)

**Interfaces:**
- Consumes: `@budget/db/client`, `@budget/db/schema`, `DATA_DIR` (`../src/lib/data-dir`), `performSync` (`../src/lib/sync-core`).
- Produces: `main(): Promise<boolean>` (import.ts), `main(): Promise<void>` (categorize.ts) — consommés par `sync-core.ts` ; commandes `pnpm import`, `pnpm categorize`, `pnpm sync` à la racine.

- [ ] **Step 1 : Copier les scripts**

```bash
S=/Users/max/WebstormProjects/budget-tracker/scripts
mkdir -p packages/api/scripts
cp $S/import.ts $S/normalize.ts $S/normalize.test.ts $S/categorize.ts \
   $S/categorize-core.ts $S/categorize-core.test.ts $S/slug.ts $S/sync.ts \
   packages/api/scripts/
```

- [ ] **Step 2 : Adapter les imports (référence R1)**

- `import.ts` : `../src/db/client` → `@budget/db/client`, `../src/db/schema` → `@budget/db/schema` ; remplacer les deux lignes

```ts
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");
```

par :

```ts
import { DATA_DIR } from "../src/lib/data-dir";

const DATA = DATA_DIR;
```

(et purger les imports `resolve`/`dirname`/`fileURLToPath` devenus inutiles).
- `normalize.ts` : `import type { NewTransaction } from "../src/db/schema"` → `from "@budget/db/schema"`.
- `categorize.ts` : imports db → `@budget/db/client` / `@budget/db/schema` ; `drizzle-orm` → `@budget/db`.
- `sync.ts` : `../src/server/sync-core.server` → `../src/lib/sync-core`.
- `categorize-core.ts`, `slug.ts`, tests : R1 (`zod` → `zod/v4` si présent).

- [ ] **Step 3 : Dépendances et scripts du package**

`packages/api/package.json` :
- `dependencies` : ajouter `"@anthropic-ai/sdk": "^0.111.0"`.
- `devDependencies` : ajouter `"tsx": "^4.23.0"`, `"dotenv-cli": "^10.0.0"`.
- `scripts` : ajouter

```json
"with-env": "dotenv -e ../../.env --",
"import": "pnpm with-env tsx scripts/import.ts && pnpm with-env tsx scripts/categorize.ts",
"categorize": "pnpm with-env tsx scripts/categorize.ts",
"sync": "pnpm with-env tsx scripts/sync.ts"
```

`package.json` racine, dans `scripts` :

```json
"import": "pnpm -F @budget/api import",
"categorize": "pnpm -F @budget/api categorize",
"sync": "pnpm -F @budget/api sync"
```

- [ ] **Step 4 : Tests et typecheck**

```bash
pnpm install && pnpm -F @budget/api test && pnpm typecheck
```
Expected: les 4 suites (`eb-domain`, `sync-core`, `normalize`, `categorize-core`) PASS ; typecheck PASS (les imports de `sync-core.ts` vers les scripts sont maintenant résolus).

- [ ] **Step 5 : Vérifier l'import à vide (sans données, sans effet)**

```bash
mkdir -p data && pnpm import
```
Expected: le script tourne, ne trouve aucun fichier `transactions-*.json`, se termine sans erreur ; `categorize` ne trouve rien à catégoriser et sort proprement (nécessite `ANTHROPIC_API_KEY` présent dans `.env` — il ne fait aucun appel LLM s'il n'y a aucune transaction). **Ne pas lancer `pnpm sync`.**

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "feat(api): scripts import/categorize/sync portés dans packages/api"
```

---

### Task 7 : `@budget/api` — routers tRPC + `@budget/validators`

**Files:**
- Create: `packages/api/src/router/transactions.ts`, `categories.ts`, `connections.ts`, `settings.ts`, `sync.ts`
- Modify: `packages/api/src/root.ts`, `packages/api/src/trpc.ts`, `packages/api/src/index.ts`, `packages/validators/src/index.ts`

**Interfaces:**
- Consumes: fonctions core de Task 5, `protectedProcedure`/`createTRPCRouter` du template.
- Produces:
  - `@budget/validators` : `transactionsSearchSchema`, `TransactionsSearch`, `PAGE_SIZE = 25`, `FALLBACK_CATEGORY_COLOR = "#94a3b8"`.
  - Routers : `transactions.list|byCategory|banks|updateCategory`, `categories.list`, `connections.searchAspsps|start|complete|list|accounts|updateAccounts|revoke`, `settings.status|save`, `sync.run` — noms utilisés par les Tasks 9–11.
  - `@budget/api` ré-exporte les types `ConnectionSummary`, `AccountSummary`, `AspspOption`, `SetupStatus`, `SyncOutcome`, `ConsentBadge`.

- [ ] **Step 1 : `@budget/validators` — schéma de recherche partagé**

Remplacer intégralement `packages/validators/src/index.ts` :

```ts
import { z } from "zod/v4";

export const PAGE_SIZE = 25;
export const FALLBACK_CATEGORY_COLOR = "#94a3b8";

// Schéma des query params de la table de transactions — partagé entre
// validateSearch (web) et l'input tRPC (api).
export const transactionsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  bank: z.string().optional().catch(undefined),
  direction: z.enum(["debit", "credit"]).optional().catch(undefined),
  status: z.enum(["booked", "pending"]).optional().catch(undefined),
  category: z
    .union([z.string(), z.literal("none")])
    .optional()
    .catch(undefined),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  q: z.string().optional().catch(undefined),
  sort: z.enum(["date", "amount"]).catch("date"),
  order: z.enum(["asc", "desc"]).catch("desc"),
});

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;
```

- [ ] **Step 2 : Exposer les headers dans le contexte tRPC**

Dans `packages/api/src/trpc.ts`, fonction `createTRPCContext`, ajouter `headers` à l'objet retourné :

```ts
  return {
    authApi,
    session,
    db,
    headers: opts.headers,
  };
```

- [ ] **Step 3 : `packages/api/src/router/transactions.ts`**

Port direct des requêtes de `SOURCE/src/server/transactions.ts` (mêmes requêtes Drizzle, mêmes types `TransactionRow`/`CategoryBreakdownItem`) :

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@budget/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "@budget/db";
import { accounts, categories, transactions } from "@budget/db/schema";
import type { TransactionsSearch } from "@budget/validators";
import {
  FALLBACK_CATEGORY_COLOR,
  PAGE_SIZE,
  transactionsSearchSchema,
} from "@budget/validators";

import { protectedProcedure } from "../trpc";

// Nom de banque affiché : display_name choisi par l'utilisateur, sinon nom ASPSP.
const bankLabel = sql<string>`coalesce(${accounts.displayName}, ${accounts.bankName})`;

export interface TransactionRow {
  id: number;
  bookingDate: string;
  description: string;
  counterparty: string | null;
  bankName: string;
  raw: {
    debtor?: { name?: string };
  };
  amount: string;
  currency: string;
  direction: "debit" | "credit";
  status: "booked" | "pending";
  category: string | null;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  color: string;
}

const transactionsFilterQuery = (
  query: TransactionsSearch,
): SQL<unknown> | undefined => {
  const conditions: SQL[] = [];
  if (query.bank) conditions.push(eq(bankLabel, query.bank));
  if (query.direction)
    conditions.push(eq(transactions.direction, query.direction));
  if (query.status) conditions.push(eq(transactions.status, query.status));
  if (query.category === "none") conditions.push(isNull(transactions.categoryId));
  else if (query.category) conditions.push(eq(categories.name, query.category));
  if (query.dateFrom)
    conditions.push(gte(transactions.bookingDate, query.dateFrom));
  if (query.dateTo) conditions.push(lte(transactions.bookingDate, query.dateTo));
  if (query.q) {
    conditions.push(
      or(
        ilike(transactions.description, `%${query.q}%`),
        ilike(transactions.counterparty, `%${query.q}%`),
      )!,
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const transactionsRouter = {
  list: protectedProcedure
    .input(transactionsSearchSchema)
    .query(async ({ ctx, input }) => {
      const where = transactionsFilterQuery(input);

      const signedAmount = sql`case when ${transactions.direction} = 'debit' then -${transactions.amount} else ${transactions.amount} end`;
      const sortColumn =
        input.sort === "amount" ? signedAmount : transactions.bookingDate;
      const orderBy =
        input.order === "asc"
          ? [asc(sortColumn), asc(transactions.id)]
          : [desc(sortColumn), desc(transactions.id)];

      const [rows, [countRow]] = await Promise.all([
        ctx.db
          .select({
            id: transactions.id,
            bookingDate: transactions.bookingDate,
            description: transactions.description,
            counterparty: transactions.counterparty,
            bankName: bankLabel,
            raw: transactions.raw,
            amount: transactions.amount,
            currency: transactions.currency,
            direction: transactions.direction,
            status: transactions.status,
            category: categories.name,
          })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(where)
          .orderBy(...orderBy)
          .limit(PAGE_SIZE)
          .offset((input.page - 1) * PAGE_SIZE),
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(where),
      ]);

      return { rows: rows as TransactionRow[], total: countRow?.total ?? 0 };
    }),

  byCategory: protectedProcedure
    .input(transactionsSearchSchema)
    .query(async ({ ctx, input }): Promise<CategoryBreakdownItem[]> => {
      const where = transactionsFilterQuery(input);
      const rows = await ctx.db
        .select({
          category: sql<string>`${categories.name}`,
          total: sql<string>`sum(${transactions.amount})`,
          color: categories.color,
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(where)
        .groupBy(categories.id, categories.name)
        .orderBy(desc(sql`sum(${transactions.amount})`));

      return rows.map((r) => ({
        category: r.category,
        total: Number(r.total),
        color: r.color ?? FALLBACK_CATEGORY_COLOR,
      }));
    }),

  banks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ bankName: bankLabel })
      .from(accounts)
      .orderBy(asc(bankLabel));
    return rows.map((r) => r.bankName);
  }),

  updateCategory: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), category: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, input.category));
      if (!match) throw new Error(`Catégorie inconnue : ${input.category}`);

      // Une correction manuelle écrase la valeur précédente (LLM ou manuelle) ;
      // le garde IS NULL de scripts/categorize.ts empêche le LLM d'y retoucher.
      await ctx.db
        .update(transactions)
        .set({ categoryId: match.id, categorySource: "manual" })
        .where(eq(transactions.id, input.id));
    }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4 : `packages/api/src/router/categories.ts`**

```ts
import type { TRPCRouterRecord } from "@trpc/server";

import { categories } from "@budget/db/schema";

import { protectedProcedure } from "../trpc";

export interface CategoryOption {
  id: number;
  name: string;
  color: string | null;
}

export const categoriesRouter = {
  list: protectedProcedure.query(
    async ({ ctx }): Promise<CategoryOption[]> =>
      ctx.db
        .select({
          id: categories.id,
          name: categories.name,
          color: categories.color,
        })
        .from(categories)
        .orderBy(categories.id),
  ),
} satisfies TRPCRouterRecord;
```

(Iso-fonctionnel : la source n'expose que la lecture — les catégories sont créées par le script categorize.)

- [ ] **Step 5 : `packages/api/src/router/connections.ts`**

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import {
  completeAuthCore,
  getConnectionAccountsCore,
  listConnectionsCore,
  revokeConnectionCore,
  searchAspspsCore,
  startAuthCore,
  updateAccountsCore,
} from "../lib/connections-core";
import { protectedProcedure } from "../trpc";

export const connectionsRouter = {
  searchAspsps: protectedProcedure
    .input(z.object({ q: z.string().optional() }))
    .query(({ input }) => searchAspspsCore(input.q)),

  start: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        country: z.string().length(2),
        connectionId: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ input }) => startAuthCore(input)),

  complete: protectedProcedure
    .input(z.object({ code: z.string().min(1), state: z.string().min(1) }))
    .mutation(({ input }) => completeAuthCore(input.code, input.state)),

  list: protectedProcedure.query(() => listConnectionsCore()),

  accounts: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .query(({ input }) => getConnectionAccountsCore(input.connectionId)),

  updateAccounts: protectedProcedure
    .input(
      z.object({
        accounts: z.array(
          z.object({
            id: z.number().int().positive(),
            displayName: z.string().nullable(),
            enabled: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(({ input }) => updateAccountsCore(input.accounts)),

  revoke: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .mutation(({ input }) => revokeConnectionCore(input.connectionId)),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 6 : `packages/api/src/router/settings.ts`**

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { getSetupStatusCore, saveSettingsCore } from "../lib/settings-core";
import { protectedProcedure } from "../trpc";

export const settingsRouter = {
  status: protectedProcedure.query(() => getSetupStatusCore()),

  save: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().min(1, "application_id requis"),
        privateKeyPem: z.string().min(1, "Clé privée requise"),
        redirectUrl: z.url("URL de redirection invalide"),
      }),
    )
    .mutation(({ input }) => saveSettingsCore(input)),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 7 : `packages/api/src/router/sync.ts`**

```ts
import type { TRPCRouterRecord } from "@trpc/server";

import { performSync } from "../lib/sync-core";
import { protectedProcedure } from "../trpc";

export const syncRouter = {
  run: protectedProcedure.mutation(({ ctx }) => {
    // Sync déclenché depuis l'app = utilisateur présent : relayer son IP et son
    // user-agent (PSU headers) classe l'accès « PSU présent » côté banque, ce qui
    // l'exempte du plafond PSD2 des accès non-assistés (~4/jour).
    const psuHeaders: Record<string, string> = {};
    const ip = ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = ctx.headers.get("user-agent");
    if (ip) psuHeaders["Psu-Ip-Address"] = ip;
    if (userAgent) psuHeaders["Psu-User-Agent"] = userAgent;

    return performSync(psuHeaders);
  }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 8 : Assembler `root.ts` et ré-exporter les types**

`packages/api/src/root.ts` :

```ts
import { authRouter } from "./router/auth";
import { categoriesRouter } from "./router/categories";
import { connectionsRouter } from "./router/connections";
import { settingsRouter } from "./router/settings";
import { syncRouter } from "./router/sync";
import { transactionsRouter } from "./router/transactions";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  categories: categoriesRouter,
  connections: connectionsRouter,
  settings: settingsRouter,
  sync: syncRouter,
  transactions: transactionsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
```

Dans `packages/api/src/index.ts`, ajouter à la fin :

```ts
export type {
  AccountSummary,
  AspspOption,
  ConnectionSummary,
} from "./lib/connections-core";
export type { SetupStatus } from "./lib/settings-core";
export type { SyncOutcome } from "./lib/eb-sync";
export type { ConsentBadge } from "./lib/eb-domain";
export type {
  CategoryBreakdownItem,
  TransactionRow,
} from "./router/transactions";
export type { CategoryOption } from "./router/categories";
```

- [ ] **Step 9 : Vérifier**

```bash
pnpm -F @budget/api test && pnpm typecheck && pnpm lint
```
Expected: PASS partout.

- [ ] **Step 10 : Commit**

```bash
git add -A && git commit -m "feat(api): routers tRPC transactions/categories/connections/settings/sync"
```

---

### Task 8 : `@budget/ui` — composants Base UI portés

**Files:**
- Create (copies depuis `SOURCE/src/components/ui/`): `packages/ui/src/badge.tsx`, `button-group.tsx`, `calendar.tsx`, `card.tsx`, `popover.tsx`, `select.tsx`, `table.tsx`
- Overwrite (versions source Base UI remplacent les versions template Radix) : `packages/ui/src/button.tsx`, `field.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `toast.tsx` (← contenu de `SOURCE/src/components/ui/sonner.tsx`)
- Delete: `packages/ui/src/dropdown-menu.tsx`
- Modify: `packages/ui/package.json`
- Keep: `packages/ui/src/theme.tsx`, `packages/ui/src/index.ts`

**Interfaces:**
- Produces: exports `@budget/ui` (cn), `@budget/ui/badge`, `button`, `button-group`, `calendar`, `card`, `field`, `input`, `label`, `popover`, `select`, `separator`, `table`, `theme`, `toast` — consommés par toutes les pages web (Tasks 9–11).

- [ ] **Step 1 : Copier les composants**

```bash
U=/Users/max/WebstormProjects/budget-tracker/src/components/ui
cp $U/badge.tsx $U/button-group.tsx $U/calendar.tsx $U/card.tsx $U/popover.tsx \
   $U/select.tsx $U/table.tsx $U/button.tsx $U/field.tsx $U/input.tsx \
   $U/label.tsx $U/separator.tsx packages/ui/src/
cp $U/sonner.tsx packages/ui/src/toast.tsx
git rm packages/ui/src/dropdown-menu.tsx
```

- [ ] **Step 2 : Adapter les imports**

Dans chaque fichier copié : `import { cn } from "@/lib/utils"` → `import { cn } from "@budget/ui"` ; les imports croisés entre composants (`@/components/ui/button` etc.) → relatifs (`./button`). Dans `toast.tsx`, s'assurer que le fichier exporte **et** le composant `Toaster` **et** la fonction `toast` de sonner (ajouter `export { toast } from "sonner";` si la copie ne l'a pas).

- [ ] **Step 3 : Mettre à jour `packages/ui/package.json`**

`exports` — remplacer le bloc par :

```json
"exports": {
  ".": "./src/index.ts",
  "./badge": "./src/badge.tsx",
  "./button": "./src/button.tsx",
  "./button-group": "./src/button-group.tsx",
  "./calendar": "./src/calendar.tsx",
  "./card": "./src/card.tsx",
  "./field": "./src/field.tsx",
  "./input": "./src/input.tsx",
  "./label": "./src/label.tsx",
  "./popover": "./src/popover.tsx",
  "./select": "./src/select.tsx",
  "./separator": "./src/separator.tsx",
  "./table": "./src/table.tsx",
  "./theme": "./src/theme.tsx",
  "./toast": "./src/toast.tsx"
},
```

`dependencies` : supprimer `"radix-ui"` et `"@radix-ui/react-icons"` ; ajouter `"@base-ui/react": "^1.6.0"`, `"lucide-react": "^1.24.0"`, `"react-day-picker": "^10.0.1"`, `"next-themes": "^0.4.6"`. Conserver `class-variance-authority`, `sonner`, `tailwind-merge`.

- [ ] **Step 4 : Vérifier**

```bash
grep -rn 'radix' packages/ui/src ; echo "exit=$?"
```
Expected: aucun résultat (`exit=1`).

```bash
pnpm install && pnpm -F @budget/ui typecheck
```
Expected: PASS. Si un composant copié importe un module manquant (ex. `date-fns` dans calendar), ajouter la dépendance dans `packages/ui/package.json` avec la version exacte de `SOURCE/package.json` et relancer.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "feat(ui): composants Base UI portés depuis budget-tracker"
```

---

### Task 9 : App web — styles, racine, contexte trpcClient, login et layout authentifié

**Files:**
- Overwrite: `apps/tanstack-start/src/styles.css` (← `SOURCE/src/styles.css`)
- Modify: `apps/tanstack-start/src/routes/__root.tsx`, `apps/tanstack-start/src/router.tsx`, `apps/tanstack-start/src/lib/trpc.ts`, `apps/tanstack-start/package.json`
- Create: `apps/tanstack-start/src/routes/login.tsx`, `apps/tanstack-start/src/routes/_authed.tsx`
- Move: `apps/tanstack-start/src/routes/index.tsx` → `apps/tanstack-start/src/routes/_authed/index.tsx`

**Interfaces:**
- Consumes: `authClient` (`~/auth/client`), router `auth.getSession` (template), `TRPCClient<AppRouter>`.
- Produces: contexte router `{ queryClient, trpc, trpcClient }` (le champ `trpcClient` est utilisé par tous les loaders des Tasks 10–11) ; hook `useTRPCClient` ; routes protégées sous `_authed` (URLs inchangées).

- [ ] **Step 1 : Styles et dépendances**

```bash
cp /Users/max/WebstormProjects/budget-tracker/src/styles.css apps/tanstack-start/src/styles.css
```

`apps/tanstack-start/package.json`, `dependencies` — ajouter (versions de SOURCE) : `"@fontsource-variable/geist": "^5.2.9"`, `"tw-animate-css": "^1.4.0"`, `"shadcn": "^4.13.0"`, `"@tanstack/react-table": "^8.21.3"`, `"recharts": "^3.9.2"`, `"date-fns": "^4.4.0"`, `"react-day-picker": "^10.0.1"`, `"@uidotdev/usehooks": "^2.4.1"`, `"lucide-react": "^1.24.0"`.

- [ ] **Step 2 : Exposer le client tRPC brut**

Dans `apps/tanstack-start/src/lib/trpc.ts`, dernière ligne : ajouter `useTRPCClient` :

```ts
export const { useTRPC, useTRPCClient, TRPCProvider } =
  createTRPCContext<Api.AppRouter>();
```

Dans `apps/tanstack-start/src/router.tsx` : passer le client dans le contexte :

```ts
  const router = createRouter({
    routeTree,
    context: { queryClient, trpc, trpcClient },
    defaultPreload: "intent",
    // ... (Wrap inchangé)
```

Dans `apps/tanstack-start/src/routes/__root.tsx` : élargir le type de contexte :

```ts
import type { TRPCClient } from "@trpc/client";
// ...
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<AppRouter>;
  trpcClient: TRPCClient<AppRouter>;
}>()({
```

- [ ] **Step 3 : Racine en français**

Dans `apps/tanstack-start/src/routes/__root.tsx` : `<html lang="en"` → `<html lang="fr"` ; dans `head()`, ajouter les meta de la source :

```ts
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Budget Tracker" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
```

Conserver `ThemeProvider`, `ThemeToggle`, `Toaster`, devtools.

- [ ] **Step 4 : Layout authentifié `_authed.tsx`**

`apps/tanstack-start/src/routes/_authed.tsx` :

```tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// Toutes les routes de l'app vivent sous ce layout sans segment d'URL :
// session obligatoire, sinon redirection vers /login.
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.trpcClient.auth.getSession.query();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
```

Déplacer le placeholder : `git mv apps/tanstack-start/src/routes/index.tsx apps/tanstack-start/src/routes/_authed/index.tsx` et changer `createFileRoute("/")` en `createFileRoute("/_authed/")`.

- [ ] **Step 5 : Page `/login`**

`apps/tanstack-start/src/routes/login.tsx` :

```tsx
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";

import { Button } from "@budget/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { Field, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { toast } from "@budget/ui/toast";

import { authClient } from "~/auth/client";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const finish = () => {
    void navigate({ to: redirect ?? "/", reloadDocument: true });
  };

  const signIn = async () => {
    setPending(true);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) toast.error(error.message ?? "Connexion impossible");
    else finish();
  };

  // Mono-utilisateur : la création de compte sert uniquement au premier lancement.
  const signUp = async () => {
    setPending(true);
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] ?? email,
    });
    setPending(false);
    if (error) toast.error(error.message ?? "Création de compte impossible");
    else finish();
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Budget Tracker</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button onClick={signIn} disabled={pending || !email || !password}>
            Se connecter
          </Button>
          <Button
            variant="outline"
            onClick={signUp}
            disabled={pending || !email || !password}
          >
            Créer le compte
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

(Si les noms exportés par `@budget/ui/field` ou `card` diffèrent de `Field`/`FieldLabel`/`CardHeader`… — vérifier dans les fichiers portés en Task 8 et ajuster les imports à ce qui existe réellement.)

- [ ] **Step 6 : Vérifier en dev**

```bash
pnpm typecheck
```
Expected: PASS (le routeTree se régénère au dev/build).

```bash
pnpm -F @budget/tanstack-start dev
```
Expected (manuel) : `http://localhost:3000/` redirige vers `/login` ; « Créer le compte » avec un email + mot de passe crée l'utilisateur puis affiche le placeholder ; re-login OK. Arrêter le serveur ensuite.

- [ ] **Step 7 : Commit**

```bash
git add -A && git commit -m "feat(web): styles portés, login email/mot de passe et layout authentifié"
```

---

### Task 10 : App web — page transactions (/)

**Files:**
- Overwrite: `apps/tanstack-start/src/routes/_authed/index.tsx` (← `SOURCE/src/routes/index.tsx`)
- Create (copies) : `apps/tanstack-start/src/routes/_authed/-components/transactions-filters.tsx`, `calendar-filter.tsx` (← `SOURCE/src/routes/-components/`), `apps/tanstack-start/src/component/search-input.tsx` (← `SOURCE/src/components/search-input.tsx`), `apps/tanstack-start/src/component/range-picker.tsx` (← `SOURCE/src/components/range-picker/range-picker.tsx`), `apps/tanstack-start/src/lib/sync-toast.ts`, `apps/tanstack-start/src/lib/date.ts` (← `SOURCE/src/lib/`)

**Interfaces:**
- Consumes: `context.trpcClient` (loaders), `useTRPCClient()` (handlers), `transactionsSearchSchema`/`PAGE_SIZE`/`FALLBACK_CATEGORY_COLOR` (`@budget/validators`), types `TransactionRow`, `CategoryBreakdownItem`, `CategoryOption`, `SyncOutcome` (`@budget/api`).
- Produces: route `/` fonctionnelle (table, filtres, tri, pagination, breakdown par catégorie, édition de catégorie, bouton Sync).

- [ ] **Step 1 : Copier les fichiers**

```bash
S=/Users/max/WebstormProjects/budget-tracker/src
mkdir -p apps/tanstack-start/src/routes/_authed/-components
cp $S/routes/index.tsx apps/tanstack-start/src/routes/_authed/index.tsx
cp $S/routes/-components/transactions-filters.tsx $S/routes/-components/calendar-filter.tsx \
   apps/tanstack-start/src/routes/_authed/-components/
cp $S/components/search-input.tsx apps/tanstack-start/src/component/search-input.tsx
cp $S/components/range-picker/range-picker.tsx apps/tanstack-start/src/component/range-picker.tsx
cp $S/lib/sync-toast.ts $S/lib/date.ts apps/tanstack-start/src/lib/
```

- [ ] **Step 2 : Appliquer R1 à tous les fichiers copiés**

(alias `~/`, composants `@budget/ui/*`, `zod/v4`.)

- [ ] **Step 3 : Convertir la route `_authed/index.tsx`**

Conversions exactes, dans l'ordre du fichier :

1. `createFileRoute("/")` → `createFileRoute("/_authed/")`.
2. Imports de données — remplacer :
   - `import { runSync } from "@/server/sync"` → supprimé (voir point 6).
   - `import { getBanks, getTransactions, updateTransactionCategory, getTransactionsByCategory, transactionsSearchSchema, PAGE_SIZE, FALLBACK_CATEGORY_COLOR, type TransactionRow, ... } from "@/server/transactions"` → constantes/schéma depuis `@budget/validators`, types depuis `@budget/api` :

   ```ts
   import type { CategoryOption, SyncOutcome, TransactionRow } from "@budget/api";
   import {
     FALLBACK_CATEGORY_COLOR,
     PAGE_SIZE,
     transactionsSearchSchema,
   } from "@budget/validators";
   import { useTRPCClient } from "~/lib/trpc";
   ```

   (Adapter la liste réelle des symboles importés à ce que le fichier utilise effectivement — la source importe aussi `type CategoryBreakdownItem` le cas échéant.)
   - `import { getCategories, type CategoryOption } from "@/server/categories"` → supprimé (type déjà couvert ci-dessus).
3. Loader — remplacer les cinq appels :

   ```ts
   loaderDeps: ({ search }) => search,
   loader: async ({ deps, context }) => {
     const [transactions, debits, credits, banks, categories] = await Promise.all([
       context.trpcClient.transactions.list.query(deps),
       context.trpcClient.transactions.byCategory.query({ ...deps, direction: "debit" }),
       context.trpcClient.transactions.byCategory.query({ ...deps, direction: "credit" }),
       context.trpcClient.transactions.banks.query(),
       context.trpcClient.categories.list.query(),
     ]);
     // conserver la forme de retour d'origine du loader source à l'identique
   ```

   (La source destructure ces cinq résultats — garder ses noms de variables et sa valeur de retour.)
4. Dans le composant, ajouter en tête : `const trpcClient = useTRPCClient();`.
5. `await updateTransactionCategory({ data: { id, category: value } })` → `await trpcClient.transactions.updateCategory.mutate({ id, category: value })` (le commentaire « Le loader n'a pas été invalidé... » et le `router.invalidate()` environnants restent identiques).
6. `const outcome = await runSync()` → `const outcome = await trpcClient.sync.run.mutate()`.

- [ ] **Step 4 : Convertir les composants annexes**

`transactions-filters.tsx` et `calendar-filter.tsx` : imports R1 ; s'ils importent des types/serveur (`TransactionsSearch`, `CategoryOption`…), utiliser `@budget/validators` / `@budget/api`. `sync-toast.ts` : si le fichier importe `type SyncOutcome` depuis `@/server/sync`, le prendre depuis `@budget/api`. Aucun de ces fichiers n'appelle de server function directement (vérifié : seuls la route et connection-card/onboarding en appellent) — sinon appliquer le même motif `useTRPCClient`.

- [ ] **Step 5 : Vérifier**

```bash
pnpm typecheck && pnpm lint
```
Expected: PASS.

```bash
pnpm -F @budget/tanstack-start dev
```
Expected (manuel) : `/` affiche la table vide (aucune donnée importée encore), filtres et tri manipulables sans erreur console. **Ne pas cliquer sur Sync.** Arrêter le serveur.

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "feat(web): page transactions portée sur tRPC"
```

---

### Task 11 : App web — pages banques, wizard et callback OAuth

**Files:**
- Create (copies) : `apps/tanstack-start/src/routes/_authed/banques/index.tsx`, `banques/ajouter.tsx`, `banques/-components/connection-card.tsx`, `banques/-components/onboarding.tsx` (← `SOURCE/src/routes/banques/`), `apps/tanstack-start/src/routes/_authed/callback.tsx` (← `SOURCE/src/routes/callback.tsx`)

**Interfaces:**
- Consumes: `context.trpcClient` (loaders), `useTRPCClient()` (handlers), types `ConnectionSummary`, `AccountSummary`, `AspspOption`, `SetupStatus` (`@budget/api`).
- Produces: routes `/banques`, `/banques/ajouter`, `/callback` (URLs identiques à la source — le layout `_authed` est sans segment ; l'URL de redirection Enable Banking `http://localhost:3000/callback` reste valable).

- [ ] **Step 1 : Copier**

```bash
S=/Users/max/WebstormProjects/budget-tracker/src/routes
mkdir -p apps/tanstack-start/src/routes/_authed/banques/-components
cp $S/banques/index.tsx $S/banques/ajouter.tsx apps/tanstack-start/src/routes/_authed/banques/
cp $S/banques/-components/connection-card.tsx $S/banques/-components/onboarding.tsx \
   apps/tanstack-start/src/routes/_authed/banques/-components/
cp $S/callback.tsx apps/tanstack-start/src/routes/_authed/callback.tsx
```

- [ ] **Step 2 : Appliquer R1 + chemins de route**

Dans chaque fichier : imports R1. `createFileRoute("/banques/")` → `createFileRoute("/_authed/banques/")`, `"/banques/ajouter"` → `"/_authed/banques/ajouter"`, `"/callback"` → `"/_authed/callback"`. Les chemins relatifs des composants `-components` restent valables.

- [ ] **Step 3 : Convertir les appels de données**

| Fichier | Appel source | Remplacement |
| --- | --- | --- |
| `banques/index.tsx` (loader) | `await getSetupStatus()` | `await context.trpcClient.settings.status.query()` |
| `banques/index.tsx` (loader) | `await getConnections()` | `await context.trpcClient.connections.list.query()` |
| `banques/ajouter.tsx` (loader) | `await getConnectionAccounts({ data: { connectionId: deps.connexion } })` | `await context.trpcClient.connections.accounts.query({ connectionId: deps.connexion })` |
| `banques/ajouter.tsx` (loader) | `await searchAspsps({ data: { q: deps.q } })` | `await context.trpcClient.connections.searchAspsps.query({ q: deps.q })` |
| `banques/ajouter.tsx` (handler) | `await startAuth({ data: { name: aspsp.name, country: aspsp.country } })` | `await trpcClient.connections.start.mutate({ name: aspsp.name, country: aspsp.country })` |
| `banques/ajouter.tsx` (handler) | `await updateAccounts({ data: {...} })` | `await trpcClient.connections.updateAccounts.mutate({...})` (même payload) |
| `banques/ajouter.tsx` (handler) | `await runSync()` | `await trpcClient.sync.run.mutate()` |
| `connection-card.tsx` (handlers) | `await startAuth({ data: {...} })` | `await trpcClient.connections.start.mutate({...})` |
| `connection-card.tsx` (handlers) | `await revokeConnection({ data: { connectionId: connection.id } })` | `await trpcClient.connections.revoke.mutate({ connectionId: connection.id })` |
| `onboarding.tsx` (handler) | `await saveSettings({ data: { applicationId, privateKeyPem, redirectUrl } })` | `await trpcClient.settings.save.mutate({ applicationId, privateKeyPem, redirectUrl })` |
| `callback.tsx` (effet) | `completeAuth({ data: { code, state } })` | `trpcClient.connections.complete.mutate({ code, state })` |

Chaque composant utilisant `trpcClient` dans un handler/effet ajoute `const trpcClient = useTRPCClient();` (import `~/lib/trpc`). Les loaders utilisent `context.trpcClient` (ajouter `context` à la signature du loader si absent). Les imports de types (`ConnectionSummary`, `SetupStatus`, `AspspOption`, `AccountSummary`) viennent de `@budget/api`.

- [ ] **Step 4 : Vérifier**

```bash
pnpm typecheck && pnpm lint
```
Expected: PASS.

```bash
pnpm -F @budget/tanstack-start dev
```
Expected (manuel) : `/banques` affiche l'onboarding Enable Banking (base vierge → non configuré) ; `/banques/ajouter` affiche le wizard (recherche ASPSP indisponible tant que l'onboarding n'est pas fait — état géré comme dans la source). Arrêter le serveur.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "feat(web): pages banques, wizard et callback portés sur tRPC"
```

---

### Task 12 : Expo — placeholder + login email/mot de passe

**Files:**
- Modify: `apps/expo/src/app/index.tsx`, `apps/expo/src/app/_layout.tsx` (si l'écran supprimé `post/[id]` y est référencé)

**Interfaces:**
- Consumes: `authClient` (`~/utils/auth`, inchangé — provider-agnostique), tRPC `~/utils/api`.
- Produces: app Expo qui typecheck, écran unique avec login/logout. Hors périmètre : écrans budget.

- [ ] **Step 1 : Réécrire `apps/expo/src/app/index.tsx`**

Fichier en entier (remplace le stub de Task 3 ; classes nativewind reprises du fichier d'origine) :

```tsx
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { authClient } from "~/utils/auth";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) setError(res.error.message ?? "Connexion impossible");
  };

  return (
    <View className="flex gap-2">
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        secureTextEntry
      />
      {error && <Text className="text-destructive">{error}</Text>}
      <Pressable
        className="bg-primary flex items-center rounded-sm p-2"
        disabled={pending || !email || !password}
        onPress={() => void signIn()}
      >
        <Text className="text-foreground">Se connecter</Text>
      </Pressable>
    </View>
  );
}

export default function Index() {
  const { data: session } = authClient.useSession();

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Budget" }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Budget
        </Text>
        {session ? (
          <>
            <Text className="text-foreground pb-2 text-center text-xl font-semibold">
              Bonjour, {session.user.name}
            </Text>
            <Text className="text-muted-foreground pb-4 text-center">
              Écrans mobiles à venir
            </Text>
            <Pressable
              className="bg-primary flex items-center rounded-sm p-2"
              onPress={() => void authClient.signOut()}
            >
              <Text className="text-foreground">Se déconnecter</Text>
            </Pressable>
          </>
        ) : (
          <LoginForm />
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2 : Vérifier**

```bash
pnpm -F @budget/expo typecheck && grep -rn 'signIn.social\|/post' apps/expo/src ; echo "exit=$?"
```
Expected: typecheck PASS ; grep sans résultat (`exit=1`).

- [ ] **Step 3 : Commit**

```bash
git add -A && git commit -m "feat(expo): placeholder avec login email/mot de passe"
```

---

### Task 13 : CLAUDE.md du monorepo

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Produces: documentation projet pour les sessions futures.

- [ ] **Step 1 : Écrire `CLAUDE.md`**

Reprendre `SOURCE/CLAUDE.md` avec ces adaptations : commandes du monorepo (`pnpm dev`, `pnpm db:push`, `pnpm import`, `pnpm categorize`, `pnpm sync`, `pnpm test`, `docker compose up -d`) ; architecture = pipeline inchangé mais couches monorepo (`@budget/api` lib + routers, `@budget/db`, app `apps/tanstack-start`, scripts `packages/api/scripts/`) ; conserver **verbatim** les sections « Bank data provider: Enable Banking (not GoCardless) » et le tableau de couverture des 3 banques ; conserver la règle « **Never run `sync`** » ; conserver « strings utilisateur en français » ; ajouter un avertissement : « La base de ce projet est `budget_t3` (instance docker partagée avec l'ancien repo budget-tracker, port 5436). Ne jamais lancer db:push avec une POSTGRES_URL pointant sur la base `budget`. »

- [ ] **Step 2 : Commit**

```bash
git add CLAUDE.md && git commit -m "docs: CLAUDE.md du monorepo"
```

---

### Task 14 : Récupération des données (comptes + transactions + catégorisation)

**Files:**
- Create: `data/` (JSON copiés — non commités, dossier gitignoré en Task 2)

**Interfaces:**
- Consumes: base `budget_t3` (schéma poussé en Task 3), scripts Task 6.
- Produces: comptes, transactions et catégories reconstruits en base.

Contexte (analyse du 2026-07-21) : les fichiers `SOURCE/data/session-*.json` (ère CLI) donnent la correspondance uid → banque/IBAN pour 5 des 6 fichiers de transactions. Le 6ᵉ uid (`300d1b3d…`) est le compte Revolut ré-authentifié via l'app (188/192 entry_references communes avec `af18410a…`, même période) : c'est le **même compte** — on importe uniquement le fichier le plus récent (`300d1b3d`) et on n'importe **pas** `af18410a` (doublons garantis sinon, l'unicité étant par (account_id, entry_reference)).

- [ ] **Step 1 : Copier les JSON de transactions (sauf le doublon Revolut)**

```bash
mkdir -p data
cp /Users/max/WebstormProjects/budget-tracker/data/transactions-*.json data/
rm data/transactions-af18410a-3a49-46e8-b059-45cb7b1176db.json
ls data/
```
Expected: 5 fichiers `transactions-*.json`.

- [ ] **Step 2 : Recréer les comptes**

`import.ts` n'importe que les fichiers dont l'uid correspond à un compte existant — insérer les 5 comptes (données extraites des `session-*.json`) :

```bash
docker compose exec -T db psql -U budget -d budget_t3 <<'SQL'
INSERT INTO accounts (uid, bank_name, iban, enabled) VALUES
  ('300d1b3d-eb05-4b18-a960-4e8d214b2bf0', 'Revolut', 'FR7610000000000000000000003', true),
  ('50ea5698-3444-48ce-96a9-c2fff8cb85e0', 'Société Générale', 'FR7610000000000000000000004', true),
  ('ab5bf9c2-36e4-4629-a080-5f5140d26253', 'Société Générale', NULL, true),
  ('4a017500-7bda-4469-8fc8-fd5d677e6449', 'Caisse d''Epargne Ile De France', 'FR7610000000000000000000001', true),
  ('c3939683-549f-4560-b814-06603ac227bf', 'Caisse d''Epargne Ile De France', 'FR7610000000000000000000002', true)
ON CONFLICT (uid) DO NOTHING;
SQL
```
Expected: `INSERT 0 5`. (`ab5bf9c2` = carte Visa SG, fichier vide aujourd'hui mais le compte doit exister pour les prochains syncs ; `connection_id` reste NULL = « compte historique pré-wizard », déjà géré par l'app.)

- [ ] **Step 3 : Importer et catégoriser**

```bash
pnpm import
```
Expected: import des 5 fichiers (≈ 190 + ~450 + ~85 + 0 transactions selon les tailles), puis catégorisation LLM des transactions sans catégorie (consomme des tokens Anthropic — c'est la récupération validée par l'utilisateur). En cas d'échec du LLM, `pnpm categorize` est relançable (idempotent, garde `IS NULL`).

- [ ] **Step 4 : Vérifier en base**

```bash
docker compose exec -T db psql -U budget -d budget_t3 -c \
 "SELECT a.bank_name, count(t.id) AS txns, count(t.category_id) AS categorisees
    FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
   GROUP BY a.bank_name ORDER BY a.bank_name"
```
Expected: ~700+ transactions réparties sur les 3 banques, quasi toutes catégorisées.

- [ ] **Step 5 : Pas de commit de données**

`git status` — Expected: rien à commiter (`data/` est gitignoré).

---

### Task 15 : Vérification finale de parité

**Files:** aucun (vérification).

- [ ] **Step 1 : Suites complètes**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: PASS partout.

- [ ] **Step 2 : Parcours manuel (avec l'utilisateur)**

```bash
pnpm -F @budget/tanstack-start dev
```
Checklist à dérouler dans le navigateur :
1. `/` sans session → redirection `/login` ; connexion OK.
2. Table des transactions : données réelles visibles, pagination (25/page), tri date/montant, filtres banque/direction/statut/catégorie/période/recherche, breakdown par catégorie (débits + crédits).
3. Édition de la catégorie d'une transaction → persiste après rechargement (`category_source = 'manual'`).
4. `/banques` : onboarding Enable Banking affiché (base sans app_settings) — l'utilisateur peut re-saisir ses credentials (`SOURCE/config.json.bak`, `SOURCE/private.pem.bak`) avec l'URL de redirection `http://localhost:3000/callback`, puis re-autoriser ses banques via le wizard **lui-même** (SCA). **Ne jamais déclencher le sync à sa place.**
5. Thème clair/sombre, toasts.

- [ ] **Step 3 : Clôture**

Rappels de fin : le repo `budget-tracker` n'a pas été modifié et reste la référence tant que Max n'a pas confirmé la parité ; l'archivage éventuel est hors périmètre. Utiliser la skill superpowers:finishing-a-development-branch si le travail a eu lieu sur une branche.
