# Sélecteur de catégories sur 2 niveaux — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les catégories parent → sous-catégorie sur 2 niveaux dans les deux sélecteurs de catégories de la page transactions (assignation par ligne et filtre de liste), avec un filtre serveur qui inclut les sous-catégories quand un parent est choisi.

**Architecture:** Les deux sélecteurs passent de `categories.list` (liste plate) à `categories.tree` (arborescence déjà nichée côté serveur, `CategoryTreeNode[]`). Un petit composant partagé aplati l'arbre en items `Select` (parent cliquable, puis ses enfants indentés, également cliquables — pas de `SelectGroup`/`SelectLabel` non cliquable). Côté backend, le filtre `transactionsFilterQuery` gagne un join sur un alias `parent_categories` pour matcher aussi bien un nom de feuille qu'un nom de parent (auquel cas toutes ses sous-catégories matchent).

**Tech Stack:** TanStack Start (routes fichier), tRPC, Drizzle ORM (`alias` de `drizzle-orm/pg-core`), Base UI Select (`@budget/ui/select`), Zod (schéma déjà existant, inchangé).

## Global Constraints

- Chaînes visibles à l'utilisateur en français (convention CLAUDE.md).
- `updateCategory` reste basé sur le nom de catégorie (unique en base) — aucun changement de contrat API pour cette mutation.
- Aucune migration de schéma Drizzle nécessaire (pas de colonne ajoutée/retirée).
- Ne pas lancer `pnpm sync` — hors sujet ici, aucune interaction avec Enable Banking.
- Vérifier via navigateur (dev server) après implémentation — ce repo n'a pas de tests unitaires existants pour les routeurs tRPC de `packages/api/src/router/transactions.ts` (confirmé : aucun fichier `transactions*.test.ts`), donc pas de nouveaux tests unitaires à inventer pour la logique de filtre — la vérification passe par `pnpm typecheck`, `pnpm lint`, et un test manuel dans l'app.

---

### Task 1: Composant partagé `CategoryTreeSelectItems`

**Files:**

- Create: `apps/tanstack-start/src/component/category-tree-select-items.tsx`

**Interfaces:**

- Consumes: `CategoryTreeNode` from `@budget/api` (`{ id: number; name: string; color: string | null; parentId: number | null; children: CategoryOption[] }`), `SelectItem` from `@budget/ui/select`.
- Produces: `CategoryTreeSelectItems({ categories: CategoryTreeNode[] })` — a component rendering a flat `<>...</>` fragment of `SelectItem`s (one per root, indented ones for each child), for use directly inside a `SelectContent`. Consumed by Task 2 and Task 3.

- [ ] **Step 1: Write the component**

```tsx
import type { CategoryTreeNode } from "@budget/api";
import { SelectItem } from "@budget/ui/select";

export function CategoryTreeSelectItems({
  categories,
}: {
  categories: CategoryTreeNode[];
}) {
  return (
    <>
      {categories.map((root) => (
        <>
          <SelectItem key={root.id} value={root.name}>
            {root.name}
          </SelectItem>
          {root.children.map((child) => (
            <SelectItem key={child.id} value={child.name} className="pl-6">
              {child.name}
            </SelectItem>
          ))}
        </>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Typecheck the new file**

Run: `pnpm -F @budget/tanstack-start typecheck`
Expected: no new errors referencing `category-tree-select-items.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/tanstack-start/src/component/category-tree-select-items.tsx
git commit -m "feat(tanstack-start): add shared 2-level category select items renderer"
```

---

### Task 2: `index.tsx` — charger l'arbre, brancher `CategoryCell` et `TransactionsFilters`

**Files:**

- Modify: `apps/tanstack-start/src/routes/_authed/index.tsx:74` (loader), `:155-164` (column def, unchanged), `:219-222` (`TransactionsFilters` call), `:309-354` (`CategoryCell`)

**Interfaces:**

- Consumes: `CategoryTreeSelectItems` from Task 1; `categories.tree` tRPC procedure (already exists, returns `CategoryTreeNode[]`).
- Produces: `categories` loader data becomes `CategoryTreeNode[]` (was `CategoryOption[]`) — Task 3 (`TransactionsFilters`) receives this same shape as its `categories` prop.

- [ ] **Step 1: Switch the loader to `categories.tree`**

In the `loader` (around line 62-82), replace:

```ts
const [result, expensesByCategory, revenuesByCategory, banks, categories] =
  await Promise.all([
    context.trpcClient.transactions.list.query(deps),
    context.trpcClient.transactions.byCategory.query({
      ...deps,
      direction: "debit",
    }),
    context.trpcClient.transactions.byCategory.query({
      ...deps,
      direction: "credit",
    }),
    context.trpcClient.transactions.banks.query(),
    context.trpcClient.categories.list.query(),
  ]);
```

with:

```ts
const [result, expensesByCategory, revenuesByCategory, banks, categories] =
  await Promise.all([
    context.trpcClient.transactions.list.query(deps),
    context.trpcClient.transactions.byCategory.query({
      ...deps,
      direction: "debit",
    }),
    context.trpcClient.transactions.byCategory.query({
      ...deps,
      direction: "credit",
    }),
    context.trpcClient.transactions.banks.query(),
    context.trpcClient.categories.tree.query(),
  ]);
```

- [ ] **Step 2: Update the `CategoryOption` import to `CategoryTreeNode`**

Line 17-21, replace:

```ts
import type {
  CategoryBreakdownItem,
  CategoryOption,
  TransactionRow,
} from "@budget/api";
```

with:

```ts
import type {
  CategoryBreakdownItem,
  CategoryTreeNode,
  TransactionRow,
} from "@budget/api";
```

Also add the import for the new shared component, right after the `TransactionsFilters` import (line 47):

```ts
import { CategoryTreeSelectItems } from "~/component/category-tree-select-items";
```

- [ ] **Step 3: Update `TransactionsFilters` call to pass the tree directly**

Line 219-222, replace:

```tsx
<TransactionsFilters banks={banks} categories={categories.map((c) => c.name)} />
```

with:

```tsx
<TransactionsFilters banks={banks} categories={categories} />
```

- [ ] **Step 4: Update `CategoryCell` to accept the tree and render 2 levels**

Lines 309-354, replace the whole function:

```tsx
function CategoryCell({
  id,
  category,
  categories,
}: {
  id: number;
  category: string | null;
  categories: CategoryTreeNode[];
}) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [saving, setSaving] = useState(false);
  return (
    <Select
      value={category ?? ""}
      disabled={saving}
      onValueChange={async (value) => {
        if (!value) return;
        setSaving(true);
        try {
          await trpcClient.transactions.updateCategory.mutate({
            id,
            category: value,
          });
          await router.invalidate();
        } catch (err) {
          // Le loader n'a pas été invalidé : le tableau garde l'ancienne valeur.
          console.error("Échec de la mise à jour de la catégorie", err);
        } finally {
          setSaving(false);
        }
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Catégorie" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        <CategoryTreeSelectItems categories={categories} />
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @budget/tanstack-start typecheck`
Expected: no errors in `index.tsx` (in particular no leftover reference to the removed `CategoryOption` import, no type mismatch on the `categories` prop passed to `CategoryCell`/`TransactionsFilters`).

- [ ] **Step 6: Commit**

```bash
git add apps/tanstack-start/src/routes/_authed/index.tsx
git commit -m "feat(tanstack-start): load category tree and render 2-level assignment select"
```

---

### Task 3: `TransactionsFilters` — filtre de liste sur 2 niveaux

**Files:**

- Modify: `apps/tanstack-start/src/routes/_authed/-components/transactions-filters.tsx`

**Interfaces:**

- Consumes: `CategoryTreeSelectItems` from Task 1, `CategoryTreeNode` from `@budget/api`.
- Produces: `TransactionsFilters({ banks: string[]; categories: CategoryTreeNode[] })` — prop type change from `categories: string[]`. This is the final consumer for this prop shape (no downstream task depends on it further).

- [ ] **Step 1: Update the import and prop type**

Replace the top of the file (lines 1-19):

```tsx
import { getRouteApi } from "@tanstack/react-router";

import type { CategoryTreeNode } from "@budget/api";
import { Button } from "@budget/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/ui/select";

import { SearchInput } from "~/component/search-input";
import { CategoryTreeSelectItems } from "~/component/category-tree-select-items";

export function TransactionsFilters({
  banks,
  categories,
}: {
  banks: string[];
  categories: CategoryTreeNode[];
}) {
```

(`SelectItem` stays imported — still used by the `banks` and `directionItems` selects further down in the file.)

- [ ] **Step 2: Render the category tree in the category `SelectContent`**

Lines 84-90, replace:

```tsx
<SelectContent>
  {categories.map((c) => (
    <SelectItem key={c} value={c}>
      {c}
    </SelectItem>
  ))}
</SelectContent>
```

with:

```tsx
<SelectContent>
  <CategoryTreeSelectItems categories={categories} />
</SelectContent>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @budget/tanstack-start typecheck`
Expected: no errors in `transactions-filters.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/tanstack-start/src/routes/_authed/-components/transactions-filters.tsx
git commit -m "feat(tanstack-start): render 2-level category tree in the list filter"
```

---

### Task 4: Filtre serveur — un parent filtre aussi ses sous-catégories

**Files:**

- Modify: `packages/api/src/router/transactions.ts:1-24` (imports), `:53-78` (`transactionsFilterQuery`), `:94-122` (`list` query joins), `:130-142` (`byCategory` query joins)

**Interfaces:**

- Consumes: `alias` from `@budget/db` (already re-exported, see `packages/db/src/index.ts:2`).
- Produces: no new exports — internal filter behavior only. Nothing downstream depends on new names from this task.

- [ ] **Step 1: Import `alias` and declare the parent-category alias table**

Line 4-24, update the `@budget/db` import to include `alias`:

```ts
import type { SQL } from "@budget/db";
import type { TransactionsSearch } from "@budget/shared";
import {
  alias,
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
```

Right after the `bankLabel` constant (line 29), add:

```ts
// Utilisé pour matcher une transaction dont la sous-catégorie appartient
// au parent choisi dans le filtre (categories.tree, 2 niveaux).
const parentCategories = alias(categories, "parent_categories");
```

- [ ] **Step 2: Update `transactionsFilterQuery` to match parent OR leaf name**

Lines 60-63, replace:

```ts
if (query.category === "none") conditions.push(isNull(transactions.categoryId));
else if (query.category) conditions.push(eq(categories.name, query.category));
```

with:

```ts
if (query.category === "none") conditions.push(isNull(transactions.categoryId));
else if (query.category) {
  const categoryFilter = or(
    eq(categories.name, query.category),
    eq(parentCategories.name, query.category),
  );
  if (categoryFilter) conditions.push(categoryFilter);
}
```

- [ ] **Step 3: Add the parent-category join to `list`**

Lines 109-111 and 118-120 (the two `leftJoin(categories, ...)` calls inside `list`), add a second `.leftJoin(...)` right after each:

```ts
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .leftJoin(
            parentCategories,
            eq(categories.parentId, parentCategories.id),
          )
          .where(where)
```

and for the count query:

```ts
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .leftJoin(
            parentCategories,
            eq(categories.parentId, parentCategories.id),
          )
          .where(where),
```

- [ ] **Step 4: Add the same join to `byCategory`**

Lines 137-139, replace:

```ts
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(where)
```

with:

```ts
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(
          parentCategories,
          eq(categories.parentId, parentCategories.id),
        )
        .where(where)
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @budget/api typecheck`
Expected: no errors — in particular `alias` resolves from `@budget/db`, and the two `.leftJoin` chains on `parentCategories` type-check against Drizzle's query builder.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/router/transactions.ts
git commit -m "fix(api): make category filter match sub-categories of a selected parent"
```

---

### Task 5: Mettre à jour le commentaire du schéma `parent_id`

**Files:**

- Modify: `packages/db/src/schema.ts:72-78`

**Interfaces:** none (comment-only change).

- [ ] **Step 1: Update the comment**

Replace:

```ts
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  // NULL = catégorie parente ; sinon sous-catégorie (feuille, seule assignable à une transaction).
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
});
```

with:

```ts
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  // NULL = catégorie parente ; sinon sous-catégorie. Les deux niveaux sont
  // assignables à une transaction ; choisir un parent dans le filtre de liste
  // inclut aussi ses sous-catégories (voir transactionsFilterQuery).
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "docs(db): clarify that both category levels are assignable"
```

---

### Task 6: Vérification manuelle dans l'app

**Files:** none (verification only).

- [ ] **Step 1: Run project-wide typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no new errors introduced by this change.

- [ ] **Step 2: Start the web app**

Run: `pnpm -F @budget/tanstack-start dev`
Expected: server starts on http://localhost:3000.

- [ ] **Step 3: Manually verify the per-row category select (`CategoryCell`)**

In the browser, open the transactions table and click a row's category cell. Expected: dropdown shows each parent category as a clickable item, with any sub-categories listed indented right below their parent, also clickable. Picking either a parent or a sub-category updates the row (via `updateCategory`) and persists after a page refresh.

- [ ] **Step 4: Manually verify the list filter**

Click the "Catégorie" filter dropdown above the table. Expected: same 2-level layout. Pick a parent that has sub-categories (e.g. after creating some via `/categories/suggestions`, or use an existing parent) — expected: the table now shows transactions from that parent AND all its sub-categories. Pick a leaf sub-category — expected: only that sub-category's transactions show.

- [ ] **Step 5: Stop the dev server**

Kill the `pnpm -F @budget/tanstack-start dev` process once verification is done.
