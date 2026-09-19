# Repository guidance

## Read before changing a domain

- Read root `CLAUDE.md` for cross-cutting invariants, then `apps/tanstack-start/CLAUDE.md`, `packages/api/CLAUDE.md`, or `packages/db/CLAUDE.md` when working there.
- README references to password login, shared Zod schemas, ESLint/Prettier, and category suggestions are stale; use current scripts and package guidance.
- For issue tracking, read `docs/agents/issue-tracker.md`; for domain documentation, read `docs/agents/domain.md`.

## Commands and verification

- Use Node `^22.21.0` and pnpm `10.19.0` (`packageManager`); shared dependency versions live in `pnpm-workspace.yaml` catalogs.
- Local setup: `pnpm install`, copy `.env.example` to `.env`, set `AUTH_SECRET`, then `docker compose up -d` and `pnpm db:migrate` after checking the database target below.
- `pnpm -F @budget/tanstack-start dev` loads the root `.env` and serves port 3000, which must match the registered Enable Banking callback `/callback`.
- Use `pnpm typecheck` or `pnpm exec turbo run typecheck --filter=@budget/tanstack-start`: Turbo builds dependency declarations first because API, DB, and shared packages resolve types from `dist/` despite exporting runtime source.
- `pnpm test` runs package Vitest suites; focus with `pnpm -F @budget/api test src/pipeline.test.ts` or append `-t "test name"`.
- Keep the app's separate `vitest.config.ts`: loading its Vite config pulls in Nitro/TanStack Start plugins and breaks unit runs.
- CI runs `pnpm lint && pnpm lint:ws`, `pnpm format`, and `pnpm typecheck` in separate jobs; tests are not a CI job.
- `lint` is root-level Oxlint, not a Turbo package task; type-aware lint rules are currently inactive.
- `format` checks with Oxfmt; `format:fix` writes.
- Focus formatting with `pnpm exec oxfmt --check <path>`; app environment access goes through `~/env`, and new environment variables must be accounted for in `turbo.json`.

## Boundaries that matter

- The only app is TanStack Start: route loaders fetch through `context.trpcClient`, mutations refresh with `router.invalidate()`; do not introduce React Query alongside this flow.
- Browser value imports from the API must use `@budget/api/schemas`; use only `import type` from `@budget/api` in client code to avoid bundling DB/auth/LLM dependencies.
- API `src/router/` contains tRPC validation and delegation; business logic lives in domain modules and `pipeline.ts`.
- Keep `authApi` out of the tRPC context: Better Auth's organization plugin makes its type too large for API declaration emission.
- For new API reads, use raw SQL through `db.execute` then Zod parsing; quote camelCase SQL aliases and cast numeric results when numbers are needed.
- `@budget/shared` contains palette/icon metadata with no runtime dependencies; UI components and 3D primitives belong in `@budget/ui`.
- UI text is French; identifiers are English.
- Typography uses nine role tokens, not Tailwind's default `text-sm` scale; any new size must be added to both app `src/styles.css` and `packages/ui/src/index.ts`'s `extendTailwindMerge` font-size group or `cn()` silently drops it.
- Preserve Vite's external `pg`, Nitro's inline `lucide-react`, and the code-inspector exclusion for UI Three files: removing them causes SSR or R3F failures that a successful build alone does not detect.

## Data and operational invariants

- Never trigger `sync.run` on the user's behalf: it accesses real banks and can initiate strong authentication.
- `sync.import` replays existing per-space JSON and categorizes without bank calls; it still writes to the database and may call the LLM.
- Verify the effective `POSTGRES_URL` before schema operations: the database is **`budget_t3`**, never **`budget`**, in the shared `budget-tracker` Docker instance on port 5436.
- Schema changes use `pnpm db:generate` then `pnpm db:migrate`; commit generated SQL and metadata under `packages/db/drizzle/`, never use schema push or edit an applied migration to change an existing database.
- Read root `CLAUDE.md` migration notes before working with existing databases or merging migration branches: baseline handling and journal timestamp order matter.
- `pnpm auth:generate` writes `packages/db/src/auth-schema.ts`; TanStack generates `routeTree.gen.ts`, so do not hand-edit the route tree.
- Categorization requires PostgreSQL `pg_trgm`; Docker init scripts only run on a new volume, so existing databases may need `CREATE EXTENSION IF NOT EXISTS pg_trgm;` as described in `packages/db/CLAUDE.md`.
- New spaces have no categories; create them in `/settings/categories` before categorizing.
- An espace is a Better Auth organization, selected in the session rather than the URL; `orgProcedure` checks membership on each request and services take `organizationId` first.
- Scope reads, writes by client-supplied ID, categorization examples, locks, and `data/<orgId>/` files to the organization; transactions inherit ownership through bank accounts.
- `spacesRouter` authorizes its target spaces separately; do not replace those checks with current-space assumptions.
- Switching spaces must reload the document: the active space is absent from the URL, so cached route loaders otherwise retain the previous space's data.
- Enable Banking `app_settings` belongs to the installation, not a space; saving it requires `adminProcedure`.
- Login is magic-link-only; without Resend credentials development logs the link, while production email sending fails.
- `CI=true pnpm build` skips secret validation and produces `apps/tanstack-start/.output/`.
- `deploy/deploy.sh` builds locally and migrates through SSH before starting new code; follow its setup notes and direct `drizzle-kit` invocation to avoid the local `.env` migration wrapper.
