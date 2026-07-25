# Mode "Remplacer" pour les suggestions de catégories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un second mode d'application ("Remplacer") aux suggestions de catégories IA, en plus du mode additif ("Fusionner") existant — l'arborescence cochée devient la nouvelle vérité, les catégories absentes sont supprimées sauf si elles protègent une correction manuelle, avec un aperçu du diff avant confirmation.

**Architecture:** La décision de ce qui doit être supprimé/conservé en mode "Remplacer" est isolée dans une fonction pure sans dépendance (`computeReplacePlan`, nouveau fichier `packages/api/src/lib/category-replace-plan.ts`) — testable sans DB, réutilisée côté serveur (`applySuggestionsCore`, exécution réelle dans une transaction Drizzle) et dupliquée volontairement côté client (`category-suggestions.tsx`, calcul d'aperçu avant confirmation — dupliquée et non importée, car `@budget/api` ne doit jamais être importé comme valeur runtime dans le bundle navigateur : son point d'entrée charge `appRouter`, qui charge `@budget/db/client`, qui exige `POSTGRES_URL` et le driver `pg`, inutilisables et non voulus côté navigateur — seuls des `import type` depuis `@budget/api` sont sûrs côté frontend, jamais un import de valeur).

**Tech Stack:** tRPC (`packages/api`), Drizzle ORM (`db.transaction`, `sql` template pour un `count(*) filter (...)`), Zod, React/TanStack Start (`apps/tanstack-start`), Vitest.

## Global Constraints

- Chaînes visibles à l'utilisateur en français (convention CLAUDE.md).
- Les transactions `categorySource = 'manual'` ne sont **jamais** réinitialisées ni déplacées, dans aucun des deux modes — c'est la garantie centrale du spec (`docs/superpowers/specs/2026-07-25-category-suggestions-replace-mode-design.md`).
- Le mode par défaut de `applySuggestionsCore` reste `"merge"`, comportement inchangé — aucune régression sur le flux actuel.
- Ce repo n'a pas de tests unitaires pour les routeurs tRPC ni pour les composants frontend (confirmé : aucun `categories.test.ts`, aucun `*.test.tsx` sous `apps/tanstack-start`) — seule la logique **pure** (`computeReplacePlan`) est testée en unitaire ; le reste se vérifie via `pnpm -F @budget/api build` (tsc), `pnpm -F @budget/tanstack-start typecheck`, et un test manuel dans l'app (dev server).
- Ne jamais lancer `pnpm sync` — hors sujet ici, aucune interaction avec Enable Banking.
- Aucune migration de schéma Drizzle nécessaire (pas de colonne ajoutée/retirée — `categorySource` a déjà l'enum `["llm", "manual"]`).

---

### Task 1: `computeReplacePlan` — logique pure de calcul du diff

**Files:**
- Create: `packages/api/src/lib/category-replace-plan.ts`
- Test: `packages/api/src/lib/category-replace-plan.test.ts`

**Interfaces:**
- Produces: `ExistingCategoryForReplace { id: number; name: string; parentId: number | null; manualTransactionCount: number }`, `ReplacePlan { idsToDelete: number[]; namesKept: string[] }`, `computeReplacePlan(existing: ExistingCategoryForReplace[], proposedNames: Set<string>): ReplacePlan`. Consommé par Task 3 (exécution serveur) et dupliqué (pas importé) par Task 5 (aperçu client).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/api/src/lib/category-replace-plan.test.ts
import { describe, expect, it } from "vitest";

import type { ExistingCategoryForReplace } from "./category-replace-plan";
import { computeReplacePlan } from "./category-replace-plan";

const cat = (
  id: number,
  name: string,
  parentId: number | null,
  manualTransactionCount = 0,
): ExistingCategoryForReplace => ({ id, name, parentId, manualTransactionCount });

describe("computeReplacePlan", () => {
  it("supprime une catégorie absente de la proposition sans transaction manuelle", () => {
    const existing = [cat(1, "Ancienne", null)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([1]);
    expect(plan.namesKept).toEqual([]);
  });

  it("conserve une catégorie absente mais avec une transaction manuelle", () => {
    const existing = [cat(1, "Ancienne", null, 1)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual(["Ancienne"]);
  });

  it("conserve un parent absent si un de ses enfants est protégé (bottom-up)", () => {
    const existing = [cat(1, "Alimentation", null), cat(2, "Boulangerie", 1, 1)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual(["Alimentation", "Boulangerie"]);
  });

  it("supprime un parent dont l'unique enfant absent n'est pas protégé", () => {
    const existing = [cat(1, "Alimentation", null), cat(2, "Boulangerie", 1)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([1, 2]);
    expect(plan.namesKept).toEqual([]);
  });

  it("ne supprime jamais une catégorie présente dans la proposition, même sans transaction", () => {
    const existing = [cat(1, "Courses", null)];
    const plan = computeReplacePlan(existing, new Set(["Courses"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual([]);
  });

  it("un enfant protégé garde son parent même si un autre enfant du même parent est proposé", () => {
    const existing = [
      cat(1, "Alimentation", null),
      cat(2, "Boulangerie", 1, 1),
      cat(3, "Courses", 1),
    ];
    const plan = computeReplacePlan(existing, new Set(["Courses"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual(["Alimentation", "Boulangerie"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @budget/api test -- category-replace-plan`
Expected: FAIL — `Cannot find module './category-replace-plan'` (le fichier source n'existe pas encore).

- [ ] **Step 3: Write the implementation**

```ts
// packages/api/src/lib/category-replace-plan.ts
// Logique pure (aucune dépendance DB/SDK) — calcule ce qui doit être supprimé
// quand le mode "Remplacer" des suggestions de catégories est appliqué.
// Réutilisée telle quelle côté serveur (voir suggest-categories-core.ts) et
// dupliquée (volontairement, jamais importée) côté client pour l'aperçu
// avant confirmation — voir le commentaire d'architecture dans
// category-suggestions.tsx pour la raison de la duplication.
export interface ExistingCategoryForReplace {
  id: number;
  name: string;
  parentId: number | null;
  manualTransactionCount: number;
}

export interface ReplacePlan {
  // Catégories existantes à supprimer : absentes de la proposition, et ni
  // elles ni un de leurs enfants ne contiennent de transaction manuelle.
  idsToDelete: number[];
  // Catégories existantes conservées malgré leur absence de la proposition,
  // car elles (ou un enfant) contiennent une transaction catégorisée
  // manuellement — pour affichage dans l'aperçu de confirmation.
  namesKept: string[];
}

// Une catégorie présente dans la proposition n'est jamais supprimée : elle
// est reparentée par upsertCategory, pas ici. Une catégorie absente est
// protégée (jamais supprimée) si elle-même ou un de ses enfants (remontée
// bottom-up, 2 niveaux seulement) contient une transaction manuelle.
export function computeReplacePlan(
  existing: ExistingCategoryForReplace[],
  proposedNames: Set<string>,
): ReplacePlan {
  const notProposed = existing.filter((c) => !proposedNames.has(c.name));

  const protectedIds = new Set(
    notProposed.filter((c) => c.manualTransactionCount > 0).map((c) => c.id),
  );
  for (const c of notProposed) {
    if (c.parentId !== null || protectedIds.has(c.id)) continue;
    const hasProtectedChild = notProposed.some(
      (child) => child.parentId === c.id && protectedIds.has(child.id),
    );
    if (hasProtectedChild) protectedIds.add(c.id);
  }

  return {
    idsToDelete: notProposed
      .filter((c) => !protectedIds.has(c.id))
      .map((c) => c.id),
    namesKept: notProposed
      .filter((c) => protectedIds.has(c.id))
      .map((c) => c.name),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @budget/api test -- category-replace-plan`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/category-replace-plan.ts packages/api/src/lib/category-replace-plan.test.ts
git commit -m "feat(api): add pure computeReplacePlan for category replace mode"
```

---

### Task 2: `categories.overview` — exposer `manualTransactionCount`

**Files:**
- Modify: `packages/api/src/router/categories.ts:1-134`

**Interfaces:**
- Consumes: rien de nouveau (query existante).
- Produces: `CategoryOverviewNode` et ses `children` gagnent `manualTransactionCount: number`. Consommé par Task 5 (aperçu client, prop `overviewTree`).

- [ ] **Step 1: Modifier les imports et interfaces**

Dans `packages/api/src/router/categories.ts`, remplacer la ligne d'import Drizzle :

```ts
import { count, eq, inArray, isNull } from "@budget/db";
```

par :

```ts
import { count, eq, inArray, isNull, sql } from "@budget/db";
```

Remplacer l'interface `CategoryOverviewNode` (lignes 26-29) :

```ts
export interface CategoryOverviewNode extends CategoryOption {
  transactionCount: number;
  children: (CategoryOption & { transactionCount: number })[];
}
```

par :

```ts
export interface CategoryOverviewNode extends CategoryOption {
  transactionCount: number;
  manualTransactionCount: number;
  children: (CategoryOption & {
    transactionCount: number;
    manualTransactionCount: number;
  })[];
}
```

- [ ] **Step 2: Étendre la query `overview`**

Remplacer le corps de la procédure `overview` (lignes 101-134) :

```ts
  overview: protectedProcedure.query(
    async ({ ctx }): Promise<CategoriesOverview> => {
      const [rows, [uncategorized]] = await Promise.all([
        ctx.db
          .select({
            id: categories.id,
            name: categories.name,
            color: categories.color,
            parentId: categories.parentId,
            transactionCount: count(transactions.id),
          })
          .from(categories)
          .leftJoin(transactions, eq(transactions.categoryId, categories.id))
          .groupBy(categories.id)
          .orderBy(categories.id),
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .where(isNull(transactions.categoryId)),
      ]);

      const tree = buildCategoryTree(rows).map((parent) => ({
        ...parent,
        // Total cumulé pour l'affichage du parent ; le compte direct (calculé
        // ci-dessus, avant ce map) reste ce que `remove` utilise pour bloquer
        // la suppression.
        transactionCount:
          parent.transactionCount +
          parent.children.reduce((sum, c) => sum + c.transactionCount, 0),
      }));

      return { tree, uncategorizedCount: uncategorized?.total ?? 0 };
    },
  ),
```

par :

```ts
  overview: protectedProcedure.query(
    async ({ ctx }): Promise<CategoriesOverview> => {
      const [rows, [uncategorized]] = await Promise.all([
        ctx.db
          .select({
            id: categories.id,
            name: categories.name,
            color: categories.color,
            parentId: categories.parentId,
            transactionCount: count(transactions.id),
            // Utilisé par le mode "Remplacer" des suggestions de catégories
            // pour ne jamais supprimer une catégorie contenant une correction
            // manuelle (voir category-replace-plan.ts).
            manualTransactionCount:
              sql<number>`count(*) filter (where ${transactions.categorySource} = 'manual')`.mapWith(
                Number,
              ),
          })
          .from(categories)
          .leftJoin(transactions, eq(transactions.categoryId, categories.id))
          .groupBy(categories.id)
          .orderBy(categories.id),
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .where(isNull(transactions.categoryId)),
      ]);

      const tree = buildCategoryTree(rows).map((parent) => ({
        ...parent,
        // Total cumulé pour l'affichage du parent ; le compte direct (calculé
        // ci-dessus, avant ce map) reste ce que `remove` utilise pour bloquer
        // la suppression.
        transactionCount:
          parent.transactionCount +
          parent.children.reduce((sum, c) => sum + c.transactionCount, 0),
        manualTransactionCount:
          parent.manualTransactionCount +
          parent.children.reduce(
            (sum, c) => sum + c.manualTransactionCount,
            0,
          ),
      }));

      return { tree, uncategorizedCount: uncategorized?.total ?? 0 };
    },
  ),
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @budget/api build`
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/router/categories.ts
git commit -m "feat(api): expose manualTransactionCount on categories.overview"
```

---

### Task 3: `applySuggestionsCore` — mode `replace`, transaction, reparentage

**Files:**
- Modify: `packages/api/src/lib/suggest-categories-core.ts:1-215`

**Interfaces:**
- Consumes: `computeReplacePlan`, `ExistingCategoryForReplace` from Task 1 (`./category-replace-plan`).
- Produces: `ApplyMode = "merge" | "replace"`, `ApplySuggestionsResult { categoriesCreated: number; categoriesReused: number; categoriesDeleted: number; categoriesKept: number }`, `applySuggestionsCore(suggestions: CategorySuggestion[], mode?: ApplyMode): Promise<ApplySuggestionsResult>` (mode par défaut `"merge"`, signature rétrocompatible). Consommé par Task 4 (routeur tRPC).

- [ ] **Step 1: Étendre les imports**

Remplacer :

```ts
import { count, desc, eq, gte } from "@budget/db";
```

par :

```ts
import { count, desc, eq, gte, inArray, sql } from "@budget/db";
```

Ajouter, juste après l'import de `categorySuggestionsSchema` :

```ts
import type { ExistingCategoryForReplace } from "./category-replace-plan";
import { computeReplacePlan } from "./category-replace-plan";
```

- [ ] **Step 2: Refactorer `upsertCategory` (accepte `tx`, flag de reparentage)**

Remplacer (lignes 155-174) :

```ts
async function upsertCategory(
  name: string,
  parentId: number | null,
): Promise<number> {
  const [inserted] = await db
    .insert(categories)
    .values({ name, parentId })
    .onConflictDoNothing({ target: categories.name })
    .returning({ id: categories.id });
  if (inserted) return inserted.id;

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name));
  if (!existing) {
    throw new Error(`Impossible de créer la catégorie « ${name} ».`);
  }
  return existing.id;
}
```

par :

```ts
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// `reparentIfExists` : en mode "replace", une catégorie déjà existante et
// présente dans la proposition doit adopter le `parentId` de la nouvelle
// arborescence (vraie restructuration) ; en mode "merge", on ne touche
// jamais à une catégorie déjà existante (comportement additif inchangé).
async function upsertCategory(
  tx: DbOrTx,
  name: string,
  parentId: number | null,
  reparentIfExists: boolean,
): Promise<number> {
  const [inserted] = await tx
    .insert(categories)
    .values({ name, parentId })
    .onConflictDoNothing({ target: categories.name })
    .returning({ id: categories.id });
  if (inserted) return inserted.id;

  const [existing] = await tx
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.name, name));
  if (!existing) {
    throw new Error(`Impossible de créer la catégorie « ${name} ».`);
  }
  if (reparentIfExists && existing.parentId !== parentId) {
    await tx
      .update(categories)
      .set({ parentId })
      .where(eq(categories.id, existing.id));
  }
  return existing.id;
}
```

- [ ] **Step 3: Réécrire `ApplySuggestionsResult` et `applySuggestionsCore`**

Remplacer (lignes 176-214, jusqu'à la fin du fichier) :

```ts
export interface ApplySuggestionsResult {
  categoriesCreated: number;
}

// Crée les catégories/sous-catégories proposées, puis remet les transactions
// catégorisées par LLM (jamais les corrections manuelles) en attente pour
// qu'elles soient reclassées dans la nouvelle arborescence plus fine.
export async function applySuggestionsCore(
  suggestions: CategorySuggestion[],
): Promise<ApplySuggestionsResult> {
  const before = await db.select({ id: categories.id }).from(categories);
  const beforeIds = new Set(before.map((c) => c.id));

  for (const { parent, enfants } of suggestions) {
    const parentId = await upsertCategory(parent, null);
    for (const enfant of enfants) {
      await upsertCategory(enfant.name, parentId);
    }
  }

  const after = await db.select({ id: categories.id }).from(categories);
  const categoriesCreated = after.filter((c) => !beforeIds.has(c.id)).length;

  await db
    .update(transactions)
    .set({ categoryId: null, categorySource: null })
    .where(eq(transactions.categorySource, "llm"));

  try {
    await runCategorize();
  } catch (err) {
    console.error(
      "⚠️  Re-catégorisation après application des suggestions échouée :",
      err,
    );
  }

  return { categoriesCreated };
}
```

par :

```ts
export type ApplyMode = "merge" | "replace";

export interface ApplySuggestionsResult {
  categoriesCreated: number;
  categoriesReused: number;
  // Mode "replace" uniquement — toujours 0 en mode "merge".
  categoriesDeleted: number;
  categoriesKept: number;
}

// Crée/reparente les catégories/sous-catégories validées et relance la
// catégorisation. Mode "merge" (défaut) : additif, comportement historique,
// ne touche jamais aux catégories absentes de la proposition. Mode
// "replace" : l'arborescence cochée devient la nouvelle vérité — les
// catégories absentes sont supprimées, sauf si elles (ou un enfant, voir
// computeReplacePlan) contiennent une transaction catégorisée manuellement,
// jamais perdue dans aucun des deux modes.
export async function applySuggestionsCore(
  suggestions: CategorySuggestion[],
  mode: ApplyMode = "merge",
): Promise<ApplySuggestionsResult> {
  const result = await db.transaction(async (tx) => {
    const proposedNames = new Set<string>();
    for (const { parent, enfants } of suggestions) {
      proposedNames.add(parent);
      for (const enfant of enfants) proposedNames.add(enfant.name);
    }

    const before = await tx.select({ id: categories.id }).from(categories);
    const beforeIds = new Set(before.map((c) => c.id));

    let categoriesDeleted = 0;
    let categoriesKept = 0;

    if (mode === "replace") {
      const existing: ExistingCategoryForReplace[] = await tx
        .select({
          id: categories.id,
          name: categories.name,
          parentId: categories.parentId,
          manualTransactionCount:
            sql<number>`count(*) filter (where ${transactions.categorySource} = 'manual')`.mapWith(
              Number,
            ),
        })
        .from(categories)
        .leftJoin(transactions, eq(transactions.categoryId, categories.id))
        .groupBy(categories.id);

      const plan = computeReplacePlan(existing, proposedNames);
      categoriesKept = plan.namesKept.length;
      categoriesDeleted = plan.idsToDelete.length;

      if (plan.idsToDelete.length > 0) {
        // Snapshot pré-upsert : les catégories à supprimer sont par
        // construction absentes de la proposition, donc jamais reparentées
        // par l'upsert ci-dessous — leur parentId reste fiable ici.
        const toDelete = existing.filter((c) =>
          plan.idsToDelete.includes(c.id),
        );
        const childIds = toDelete
          .filter((c) => c.parentId !== null)
          .map((c) => c.id);
        const parentIds = toDelete
          .filter((c) => c.parentId === null)
          .map((c) => c.id);

        await tx
          .update(transactions)
          .set({ categoryId: null, categorySource: null })
          .where(inArray(transactions.categoryId, plan.idsToDelete));

        // Enfants avant parents pour respecter la contrainte de clé
        // étrangère categories.parent_id -> categories.id.
        if (childIds.length > 0) {
          await tx.delete(categories).where(inArray(categories.id, childIds));
        }
        if (parentIds.length > 0) {
          await tx
            .delete(categories)
            .where(inArray(categories.id, parentIds));
        }
      }
    }

    for (const { parent, enfants } of suggestions) {
      const parentId = await upsertCategory(
        tx,
        parent,
        null,
        mode === "replace",
      );
      for (const enfant of enfants) {
        await upsertCategory(tx, enfant.name, parentId, mode === "replace");
      }
    }

    const after = await tx.select({ id: categories.id }).from(categories);
    const categoriesCreated = after.filter(
      (c) => !beforeIds.has(c.id),
    ).length;
    const totalUpserts = suggestions.reduce(
      (n, s) => n + 1 + s.enfants.length,
      0,
    );

    await tx
      .update(transactions)
      .set({ categoryId: null, categorySource: null })
      .where(eq(transactions.categorySource, "llm"));

    return {
      categoriesCreated,
      categoriesReused: totalUpserts - categoriesCreated,
      categoriesDeleted,
      categoriesKept,
    };
  });

  try {
    await runCategorize();
  } catch (err) {
    console.error(
      "⚠️  Re-catégorisation après application des suggestions échouée :",
      err,
    );
  }

  return result;
}
```

- [ ] **Step 4: Vérifier que les tests existants passent toujours**

Run: `pnpm -F @budget/api test`
Expected: PASS — tous les tests existants (`buildAnalysisPrompt`, `sampleWindowStart`, `category-replace-plan`, etc.) passent toujours, `applySuggestionsCore` n'a pas de test dédié (dépend de la DB, cf. Global Constraints) mais ne doit pas casser la compilation.

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @budget/api build`
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/suggest-categories-core.ts
git commit -m "feat(api): add replace mode to applySuggestionsCore with DB transaction"
```

---

### Task 4: Routeur tRPC — `mode` sur `categories.suggestions.apply`

**Files:**
- Modify: `packages/api/src/router/categories.ts:188-199`

**Interfaces:**
- Consumes: `applySuggestionsCore(suggestions, mode)` from Task 3.
- Produces: input tRPC `categories.suggestions.apply` gagne un champ `mode: "merge" | "replace"` optionnel (défaut `"merge"`). Consommé par Task 5 (frontend).

- [ ] **Step 1: Modifier la mutation `apply`**

Remplacer :

```ts
    // Crée les catégories/sous-catégories validées et relance la catégorisation.
    apply: protectedProcedure
      .input(z.object({ suggestions: z.array(categorySuggestionSchema) }))
      .mutation(({ input }) => applySuggestionsCore(input.suggestions)),
```

par :

```ts
    // Crée les catégories/sous-catégories validées et relance la
    // catégorisation. mode "merge" (défaut) additif, "replace" fait de la
    // sélection cochée la nouvelle vérité (voir applySuggestionsCore).
    apply: protectedProcedure
      .input(
        z.object({
          suggestions: z.array(categorySuggestionSchema),
          mode: z.enum(["merge", "replace"]).default("merge"),
        }),
      )
      .mutation(({ input }) =>
        applySuggestionsCore(input.suggestions, input.mode),
      ),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @budget/api build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/router/categories.ts
git commit -m "feat(api): accept mode on categories.suggestions.apply"
```

---

### Task 5: UI — toggle de mode, aperçu du diff, confirmation destructive

**Files:**
- Modify: `apps/tanstack-start/src/component/category-suggestions.tsx` (fichier entier)
- Modify: `apps/tanstack-start/src/routes/_authed/categories.tsx:94`

**Interfaces:**
- Consumes: `CategoryOverviewNode` from `@budget/api` (type-only, gagné `manualTransactionCount` en Task 2) ; `trpcClient.categories.suggestions.apply.mutate({ suggestions, mode })` (Task 4).
- Produces: `SuggestionsWorkspace({ data: ReadyStatus; overviewTree: CategoryOverviewNode[] })` — nouvelle prop `overviewTree`, consommée par `categories.tsx`.

- [ ] **Step 1: Réécrire `category-suggestions.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";

import type {
  CategoryOverviewNode,
  CategorySuggestion,
  TxnForAnalysis,
} from "@budget/api";
import { Button } from "@budget/ui/button";
import { ButtonGroup } from "@budget/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";
import { toast } from "@budget/ui/toast";

import type { EditableParent } from "./category-tree";
import { useTRPCClient } from "~/lib/trpc";
import { Route } from "~/routes/_authed/categories";
import { CategoryTree, newEditableId } from "./category-tree";
import { TransactionPreviewDrawer } from "./transaction-preview-drawer";

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export interface ReadyStatus {
  suggestions: CategorySuggestion[];
  sample: TxnForAnalysis[];
  generatedAt: Date;
  newTransactionsCount: number;
}

type ApplyMode = "merge" | "replace";

interface ReplacePreview {
  toDelete: string[];
  toKeep: string[];
}

// Reproduit côté client la même logique bottom-up que `computeReplacePlan`
// (packages/api/src/lib/category-replace-plan.ts) : un simple aperçu avant
// confirmation, dupliqué et non importé — `@budget/api` ne doit jamais être
// importé comme valeur runtime ici (son point d'entrée charge `appRouter` ->
// `@budget/db/client`, qui exige POSTGRES_URL et le driver `pg`, impossibles
// dans le bundle navigateur). Le calcul qui fait foi reste celui exécuté
// côté API au moment de l'application.
function computeReplacePreview(
  overviewTree: CategoryOverviewNode[],
  proposedNames: Set<string>,
): ReplacePreview {
  const flat: {
    id: number;
    name: string;
    parentId: number | null;
    manualTransactionCount: number;
  }[] = [];
  for (const parent of overviewTree) {
    flat.push({
      id: parent.id,
      name: parent.name,
      parentId: null,
      manualTransactionCount: parent.manualTransactionCount,
    });
    for (const child of parent.children) {
      flat.push({
        id: child.id,
        name: child.name,
        parentId: parent.id,
        manualTransactionCount: child.manualTransactionCount,
      });
    }
  }

  const notProposed = flat.filter((c) => !proposedNames.has(c.name));
  const protectedIds = new Set(
    notProposed.filter((c) => c.manualTransactionCount > 0).map((c) => c.id),
  );
  for (const c of notProposed) {
    if (c.parentId !== null || protectedIds.has(c.id)) continue;
    const hasProtectedChild = notProposed.some(
      (child) => child.parentId === c.id && protectedIds.has(child.id),
    );
    if (hasProtectedChild) protectedIds.add(c.id);
  }

  return {
    toDelete: notProposed
      .filter((c) => !protectedIds.has(c.id))
      .map((c) => c.name),
    toKeep: notProposed
      .filter((c) => protectedIds.has(c.id))
      .map((c) => c.name),
  };
}

export function SuggestionsWorkspace({
  data,
  overviewTree,
}: {
  data: ReadyStatus;
  overviewTree: CategoryOverviewNode[];
}) {
  const trpcClient = useTRPCClient();
  const navigate = Route.useNavigate();
  const [tree, setTree] = useState<EditableParent[]>(() =>
    toEditable(data.suggestions),
  );
  const [mode, setMode] = useState<ApplyMode>("merge");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    txns: TxnForAnalysis[];
  } | null>(null);

  const sampleById = useMemo(() => {
    const map = new Map<number, TxnForAnalysis>();
    for (const txn of data.sample) map.set(txn.id, txn);
    return map;
  }, [data.sample]);

  const payload = useMemo<CategorySuggestion[]>(
    () =>
      tree
        .map((p) => ({
          parent: p.name.trim(),
          enfants: p.children
            .filter((c) => c.enabled && c.name.trim().length > 0)
            .map((c) => ({ name: c.name.trim(), txnIds: c.txnIds })),
        }))
        .filter((p) => p.parent.length > 0 && p.enfants.length > 0),
    [tree],
  );

  const proposedNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of payload) {
      names.add(p.parent);
      for (const e of p.enfants) names.add(e.name);
    }
    return names;
  }, [payload]);

  const replacePreview = useMemo(
    () =>
      mode === "replace"
        ? computeReplacePreview(overviewTree, proposedNames)
        : null,
    [mode, overviewTree, proposedNames],
  );

  const openPreview = (title: string, txnIds: number[]) => {
    const txns = txnIds
      .map((id) => sampleById.get(id))
      .filter((t): t is TxnForAnalysis => t !== undefined);
    setPreview({ title, txns });
  };

  const apply = async () => {
    setApplying(true);
    try {
      const result = await trpcClient.categories.suggestions.apply.mutate({
        suggestions: payload,
        mode,
      });
      const summary =
        mode === "replace"
          ? `${result.categoriesCreated} créée(s), ${result.categoriesReused} réutilisée(s), ${result.categoriesDeleted} supprimée(s) — recatégorisation en cours.`
          : `${result.categoriesCreated} catégorie(s) créée(s) — recatégorisation en cours.`;
      toast.success(summary);
      setConfirmOpen(false);
      await navigate({
        to: "/",
        search: { page: 1, sort: "date", order: "desc" },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'application.",
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Analyse de {data.sample.length} transactions · générée le{" "}
          {dateTimeFr.format(data.generatedAt)}
        </p>
        <div className="flex items-center gap-2">
          <ButtonGroup>
            <Button
              type="button"
              variant={mode === "merge" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("merge")}
            >
              Fusionner
            </Button>
            <Button
              type="button"
              variant={mode === "replace" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setMode("replace")}
            >
              Remplacer
            </Button>
          </ButtonGroup>
          <Button
            size="sm"
            variant={mode === "replace" ? "destructive" : "default"}
            disabled={payload.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            {mode === "replace" ? "Remplacer" : "Appliquer"}
          </Button>
        </div>
      </div>

      {data.newTransactionsCount > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {data.newTransactionsCount} nouvelle(s) transaction(s) arrivée(s)
          depuis cette analyse — les résultats peuvent être obsolètes.
        </div>
      )}

      {mode === "replace" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Mode remplacement : les catégories existantes absentes de cette
          sélection seront supprimées, sauf celles contenant des corrections
          manuelles.
        </div>
      )}

      <CategoryTree parents={tree} onChange={setTree} onPreview={openPreview} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "replace"
                ? "Remplacer les catégories existantes ?"
                : "Appliquer ces catégories ?"}
            </DialogTitle>
            <DialogDescription>
              {payload.length} catégorie(s) parente(s) et{" "}
              {payload.reduce((n, p) => n + p.enfants.length, 0)}{" "}
              sous-catégorie(s) seront{" "}
              {mode === "replace" ? "créées ou réutilisées" : "créées"}. Les
              transactions catégorisées automatiquement seront reclassées
              dans cette nouvelle arborescence.
              {mode === "replace" && replacePreview && (
                <>
                  {replacePreview.toDelete.length > 0 && (
                    <>
                      {" "}
                      {replacePreview.toDelete.length} catégorie(s)
                      existante(s) seront supprimées :{" "}
                      {replacePreview.toDelete.join(", ")}.
                    </>
                  )}
                  {replacePreview.toKeep.length > 0 && (
                    <>
                      {" "}
                      {replacePreview.toKeep.length} catégorie(s) seront
                      conservées malgré tout car elles contiennent des
                      corrections manuelles : {replacePreview.toKeep.join(", ")}.
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              variant={mode === "replace" ? "destructive" : "default"}
              onClick={apply}
              disabled={applying}
            >
              {applying && <Loader2Icon className="animate-spin" />}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionPreviewDrawer
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.title ?? ""}
        transactions={preview?.txns ?? []}
      />
    </div>
  );
}

function toEditable(suggestions: CategorySuggestion[]): EditableParent[] {
  return suggestions.map((s) => ({
    id: newEditableId(),
    name: s.parent,
    children: s.enfants.map((e) => ({
      id: newEditableId(),
      name: e.name,
      txnIds: e.txnIds,
      enabled: true,
    })),
  }));
}
```

- [ ] **Step 2: Passer `overviewTree` depuis la route**

Dans `apps/tanstack-start/src/routes/_authed/categories.tsx`, remplacer :

```tsx
      {!generating && ready && <SuggestionsWorkspace data={ready} />}
```

par :

```tsx
      {!generating && ready && (
        <SuggestionsWorkspace data={ready} overviewTree={overview.tree} />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @budget/tanstack-start typecheck`
Expected: no TypeScript errors.

- [ ] **Step 4: Test manuel dans l'app**

Run: `pnpm -F @budget/tanstack-start dev` (nécessite `docker compose up -d` et `POSTGRES_URL` déjà configurés, voir CLAUDE.md).

Sur `http://localhost:3000/categories` :
1. Générer une suggestion ("Suggérer des catégories"), vérifier que le toggle "Fusionner / Remplacer" s'affiche, "Fusionner" actif par défaut.
2. Cliquer "Remplacer" : le bandeau d'avertissement destructif apparaît, le bouton principal passe en style destructif et son libellé devient "Remplacer".
3. Ouvrir la confirmation : vérifier que le texte liste bien les catégories qui seraient supprimées/conservées (comparer avec la liste affichée dans `CategoryOverviewTree` plus bas sur la même page).
4. Revenir en "Fusionner" et confirmer que le comportement (texte, bouton, absence de bandeau) redevient identique à avant ce changement.
5. Appliquer en mode "Fusionner" une fois pour confirmer la non-régression du flux existant (toast "X catégorie(s) créée(s)", redirection vers `/`).

- [ ] **Step 5: Commit**

```bash
git add apps/tanstack-start/src/component/category-suggestions.tsx apps/tanstack-start/src/routes/_authed/categories.tsx
git commit -m "feat(tanstack-start): add replace mode toggle and diff preview to category suggestions"
```

---

## Self-Review Notes

- **Spec coverage :** mode fusion/remplacement (Task 3-4), reparentage des catégories existantes matchées (Task 3, `reparentIfExists`), protection bottom-up des transactions manuelles (Task 1, `computeReplacePlan`), aperçu du diff avant confirmation (Task 5, `computeReplacePreview` dupliqué côté client), style destructif + toast détaillé (Task 5), transaction DB atomique (Task 3, `db.transaction`), tests `computeReplacePlan` (Task 1) — tous les points du spec du 2026-07-25 sont couverts. Le cas limite "deux catégories convergent vers un même nom" et le hors-scope "renommage automatique par le LLM" restent volontairement non gérés, comme documenté dans le spec.
- **Type consistency :** `ApplyMode`, `ApplySuggestionsResult`, `ExistingCategoryForReplace`, `ReplacePlan`, `computeReplacePlan` utilisés de façon identique entre Task 1/3 (serveur) ; `computeReplacePreview`/`ReplacePreview` sont un nom différent côté client (Task 5), volontairement — ce n'est pas la même fonction (duplication assumée, documentée), donc pas d'incohérence de nommage à corriger.
