# budget-t3-turbo

Outil de finances personnelles : synchronisation des transactions de trois comptes bancaires
(Enable Banking), catégorisation assistée par LLM, budgets et revue mensuelle.

Monorepo pnpm + Turborepo. Usage personnel — pas de déploiement public.

> Parti de [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo), dont il ne reste que la
> structure. L'app Next.js et l'app Expo du template ont été supprimées, ainsi que le proxy d'auth
> Vercel et la configuration Supabase.

## Structure

```text
apps
  └─ tanstack-start   app web (la seule) — TanStack Start, React 19, Tailwind v4
packages
  ├─ api              routeurs tRPC + logique métier (banking, transactions, catégorisation, budgets)
  ├─ auth             Better Auth — email/mot de passe + plugin organization (les « espaces »)
  ├─ db               schéma Drizzle + client pg, base budget_t3
  ├─ shared           schémas Zod, palette, icônes — zod comme seule dépendance runtime
  └─ ui               composants Base UI
tooling
  ├─ eslint · prettier · typescript · github
docs
  ├─ adr              décisions d'architecture
  └─ superpowers      specs et plans datés
```

L'architecture, les invariants et les décisions à ne pas défaire sont dans **[CLAUDE.md](./CLAUDE.md)** —
c'est le document de référence, ce fichier n'en est que la porte d'entrée.

## Démarrer

```bash
pnpm install
cp .env.example .env          # POSTGRES_URL, AUTH_SECRET, ANTHROPIC_API_KEY, …
docker compose up -d          # Postgres 17, port hôte 5436
pnpm db:push                  # push du schéma Drizzle (interactif — voir plus bas)
pnpm -F @budget/tanstack-start dev   # http://localhost:3000
```

Le port 3000 n'est pas négociable : c'est l'URL de callback déclarée chez Enable Banking
(`http://localhost:3000/callback`).

Sur un clone neuf, la table `categories` est vide — la catégorisation tourne alors sans rien
classer, en silence. Le seed de départ est dans CLAUDE.md, section « Seed initial ».

## Commandes

| Commande | Effet |
| --- | --- |
| `pnpm dev` | tous les packages en watch |
| `pnpm build` / `typecheck` / `lint` / `test` | turbo sur tout le monorepo |
| `pnpm db:push` | push du schéma Drizzle — **échoue hors TTY**, replier sur `pnpm -F @budget/db with-env drizzle-kit push` |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm --filter @budget/auth generate` | régénère `packages/db/src/auth-schema.ts` depuis la config Better Auth |

**Il n'existe aucune commande CLI métier.** Import, synchronisation, catégorisation et suggestions
se déclenchent depuis l'app, via les mutations tRPC correspondantes.

## Deux avertissements

**La base est `budget_t3`.** L'instance Docker est partagée avec l'ancien dépôt `budget-tracker`,
dont la base s'appelle `budget`. Vérifier le nom dans `POSTGRES_URL` avant toute opération de schéma.

**`sync.run` touche aux banques réelles** et déclenche une authentification forte. Pour rejouer un
import sans appel bancaire ni consommation du quota PSD2, utiliser `sync.import` — idempotent.

## Licence

MIT
