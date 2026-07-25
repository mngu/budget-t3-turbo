# Mode "Remplacer" pour les suggestions de catégories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un second mode d'application ("Remplacer") aux suggestions de catégories IA, en plus du mode additif ("Fusionner") existant — l'arborescence cochée devient la nouvelle vérité, les catégories absentes sont supprimées sauf si elles protègent une correction manuelle, avec un aperçu du diff avant confirmation.

**Architecture:** Toute la décision "qu'est-ce qu'on supprime/garde en mode remplacement" vit dans une seule fonction pure sans dépendance (`computeReplacePlan`, `packages/api/src/lib/category-replace-plan.ts`), testée une fois. Elle est appelée par **deux** procédures tRPC qui partagent aussi la même requête de lecture (`fetchExistingWithManualCounts`) : `categories.suggestions.previewReplace` (query en lecture seule, pour l'aperçu avant confirmation) et `categories.suggestions.apply` (mutation, exécution réelle dans une transaction Drizzle). Le frontend n'a donc **aucune logique de décision à dupliquer** : il appelle `previewReplace` à l'ouverture de la dialog de confirmation et affiche tel quel ce que le serveur répond — une seule implémentation de l'algorithme, jamais deux copies qui peuvent diverger.

**Tech Stack:** tRPC (`packages/api`), Drizzle ORM (`db.transaction`, `sql` template pour un `count(*) filter (...)`), Zod, React/TanStack Start (`apps/tanstack-start`), Vitest.

## Global Constraints

- Chaînes visibles à l'utilisateur en français (convention CLAUDE.md).
- Les transactions `categorySource = 'manual'` ne sont **jamais** réinitialisées ni déplacées, dans aucun des deux modes — c'est la garantie centrale du spec (`docs/superpowers/specs/2026-07-25-category-suggestions-replace-mode-design.md`).
- Le mode par défaut de `applySuggestionsCore` reste `"merge"`, comportement inchangé — aucune régression sur le flux actuel.
- Une seule implémentation de la logique de décision (`computeReplacePlan`) — ni le frontend ni aucune autre procédure ne la réimplémentent. Voir la note d'architecture ci-dessus : c'est un changement délibéré par rapport à une première esquisse de ce plan, pour éviter deux copies de l'algorithme qui divergent avec le temps.
- Ce repo n'a pas de tests unitaires pour les routeurs tRPC ni pour les composants frontend (confirmé : aucun `categories.test.ts`, aucun `*.test.tsx` sous `apps/tanstack-start`) — seule la logique **pure** (`computeReplacePlan`) est testée en unitaire ; le reste se vérifie via `pnpm -F @budget/api build` (tsc), `pnpm -F @budget/tanstack-start typecheck`, et un test manuel dans l'app (dev server).
- Ne jamais lancer `pnpm sync` — hors sujet ici, aucune interaction avec Enable Banking.
- Aucune migration de schéma Drizzle nécessaire (pas de colonne ajoutée/retirée — `categorySource` a déjà l'enum `["llm", "manual"]`).

---

### Task 1: `computeReplacePlan` — logique pure de calcul du diff

**Files:**
- Create: `packages/api/src/lib/category-replace-plan.ts`
- Test: `packages/api/src/lib/category-replace-plan.test.ts`

**Interfaces:**
- Produces: `ExistingCategoryForReplace { id: number; name: string; parentId: number | null; manualTransactionCount: number }`, `ReplacePlan { idsToDelete: number[]; namesToDelete: string[]; namesKept: string[] }`, `computeReplacePlan(existing: ExistingCategoryForReplace[], proposedNames: Set<string>): ReplacePlan`, `flattenProposedNames(suggestions: CategorySuggestion[]): Set<string>`. Consommé par Task 2 (exécution serveur `applySuggestionsCore`) et Task 3 (procédure `previewReplace`) — **jamais** par le frontend directement (voir Architecture).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/api/src/lib/category-replace-plan.test.ts
import { describe, expect, it } from "vitest";

import type { ExistingCategoryForReplace } from "./category-replace-plan";
import { computeReplacePlan, flattenProposedNames } from "./category-replace-plan";

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
    expect(plan.namesToDelete).toEqual(["Ancienne"]);
    expect(plan.namesKept).toEqual([]);
  });

  it("conserve une catégorie absente mais avec une transaction manuelle", () => {
    const existing = [cat(1, "Ancienne", null, 1)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesToDelete).toEqual([]);
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
    expect(plan.namesToDelete).toEqual(["Alimentation", "Boulangerie"]);
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

describe("flattenProposedNames", () => {
  it("aplatit parents et enfants en un seul Set de noms", () => {
    const names = flattenProposedNames([
      { parent: "Alimentation", enfants: [{ name: "Courses", txnIds: [] }, { name: "Restaurants", txnIds: [] }] },
      { parent: "Transport", enfants: [{ name: "Essence", txnIds: [] }] },
    ]);
    expect(names).toEqual(
      new Set(["Alimentation", "Courses", "Restaurants", "Transport", "Essence"]),
    );
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
// Seule implémentation de cette décision dans tout le projet : appelée à la
// fois par la query d'aperçu (previewReplace) et par la mutation réelle
// (applySuggestionsCore) — voir suggest-categories-core.ts. Le frontend ne
// réimplémente jamais cet algorithme, il affiche le résultat de
// previewReplace tel quel.
import type { CategorySuggestion } from "./suggest-categories-schema";

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
  namesToDelete: string[];
  // Catégories existantes conservées malgré leur absence de la proposition,
  // car elles (ou un enfant) contiennent une transaction catégorisée
  // manuellement.
  namesKept: string[];
}

export function flattenProposedNames(
  suggestions: CategorySuggestion[],
): Set<string> {
  const names = new Set<string>();
  for (const { parent, enfants } of suggestions) {
    names.add(parent);
    for (const enfant of enfants) names.add(enfant.name);
  }
  return names;
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

  const toDelete = notProposed.filter((c) => !protectedIds.has(c.id));

  return {
    idsToDelete: toDelete.map((c) => c.id),
    namesToDelete: toDelete.map((c) => c.name),
    namesKept: notProposed
      .filter((c) => protectedIds.has(c.id))
      .map((c) => c.name),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @budget/api test -- category-replace-plan`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/category-replace-plan.ts packages/api/src/lib/category-replace-plan.test.ts
git commit -m "feat(api): add pure computeReplacePlan for category replace mode"
```

---

### Task 2: `applySuggestionsCore` — mode `replace`, transaction, reparentage

**Files:**
- Modify: `packages/api/src/lib/suggest-categories-core.ts:1-215`

**Interfaces:**
- Consumes: `computeReplacePlan`, `flattenProposedNames`, `ExistingCategoryForReplace`, `ReplacePlan` from Task 1 (`./category-replace-plan`).
- Produces: `ApplyMode = "merge" | "replace"`, `ApplySuggestionsResult { categoriesCreated: number; categoriesReused: number; categoriesDeleted: number; categoriesKept: number }`, `applySuggestionsCore(suggestions: CategorySuggestion[], mode?: ApplyMode): Promise<ApplySuggestionsResult>` (mode par défaut `"merge"`, signature rétrocompatible), `previewReplaceCore(suggestions: CategorySuggestion[]): Promise<ReplacePlan>`. Toutes deux consommées par Task 3 (routeur tRPC).

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
import type { ExistingCategoryForReplace, ReplacePlan } from "./category-replace-plan";
import { computeReplacePlan, flattenProposedNames } from "./category-replace-plan";
```

- [ ] **Step 2: Refactorer `upsertCategory` (accepte `tx`, flag de reparentage) et ajouter les deux helpers de remplacement**

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

// Snapshot des catégories existantes + nombre de transactions manuelles par
// catégorie — base de calcul de computeReplacePlan. Utilisé à la fois en
// lecture seule (previewReplaceCore, via `db`) et dans la transaction
// d'application (applySuggestionsCore, via `tx`).
async function fetchExistingWithManualCounts(
  tx: DbOrTx,
): Promise<ExistingCategoryForReplace[]> {
  return tx
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
}

// Exécute la suppression décidée par computeReplacePlan : reset des
// transactions concernées (aucune manuelle par construction du plan), puis
// suppression cascade enfants-avant-parents (contrainte de clé étrangère
// categories.parent_id -> categories.id). `existing` doit être un snapshot
// pris APRÈS la boucle d'upsert (voir applySuggestionsCore) : une catégorie
// à supprimer est par construction absente de la proposition, donc jamais
// reparentée par l'upsert — mais une catégorie CONSERVÉE peut, elle, avoir
// été reparentée loin d'un parent sur le point d'être supprimé. Si on
// supprimait avant l'upsert, ce parent aurait encore des enfants pointant
// vers lui en base au moment du DELETE -> violation de la contrainte de clé
// étrangère. Snapshotter après l'upsert garantit qu'aucune catégorie
// conservée ne référence plus une catégorie sur le point d'être supprimée.
async function deleteCategoriesInPlan(
  tx: DbOrTx,
  existing: ExistingCategoryForReplace[],
  plan: ReplacePlan,
): Promise<void> {
  if (plan.idsToDelete.length === 0) return;

  const toDelete = existing.filter((c) => plan.idsToDelete.includes(c.id));
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

  if (childIds.length > 0) {
    await tx.delete(categories).where(inArray(categories.id, childIds));
  }
  if (parentIds.length > 0) {
    await tx.delete(categories).where(inArray(categories.id, parentIds));
  }
}

// Aperçu en lecture seule de ce que ferait le mode "replace", pour la dialog
// de confirmation côté UI — n'écrit rien en base.
export async function previewReplaceCore(
  suggestions: CategorySuggestion[],
): Promise<ReplacePlan> {
  const existing = await fetchExistingWithManualCounts(db);
  return computeReplacePlan(existing, flattenProposedNames(suggestions));
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
    const proposedNames = flattenProposedNames(suggestions);

    const before = await tx.select({ id: categories.id }).from(categories);
    const beforeIds = new Set(before.map((c) => c.id));

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

    let categoriesDeleted = 0;
    let categoriesKept = 0;

    // Snapshot et suppression APRÈS la boucle d'upsert ci-dessus : toute
    // catégorie conservée/reparentée par la proposition a déjà migré vers
    // son nouveau parent, donc plus aucune catégorie vivante ne référence
    // encore une catégorie sur le point d'être supprimée (contrainte de clé
    // étrangère categories.parent_id -> categories.id) — voir le
    // commentaire de deleteCategoriesInPlan pour le détail du scénario que
    // ça évite.
    if (mode === "replace") {
      const existing = await fetchExistingWithManualCounts(tx);
      const plan = computeReplacePlan(existing, proposedNames);
      categoriesKept = plan.namesKept.length;
      categoriesDeleted = plan.idsToDelete.length;
      await deleteCategoriesInPlan(tx, existing, plan);
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
Expected: PASS — tous les tests existants passent toujours (`applySuggestionsCore`/`previewReplaceCore` n'ont pas de test dédié, dépendent de la DB, cf. Global Constraints — mais la compilation ne doit pas casser).

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @budget/api build`
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/suggest-categories-core.ts
git commit -m "feat(api): add replace mode + previewReplaceCore to applySuggestionsCore"
```

---

### Task 3: Routeur tRPC — `mode` sur `apply`, nouvelle query `previewReplace`

**Files:**
- Modify: `packages/api/src/router/categories.ts:188-199`
- Modify: `packages/api/src/index.ts` (export du type `ReplacePlan`)

**Interfaces:**
- Consumes: `applySuggestionsCore(suggestions, mode)`, `previewReplaceCore(suggestions)` from Task 2.
- Produces: mutation `categories.suggestions.apply` gagne `mode: "merge" | "replace"` (défaut `"merge"`) ; nouvelle query `categories.suggestions.previewReplace({ suggestions }): ReplacePlan`. Consommées par Task 4 (frontend).

- [ ] **Step 1: Modifier les imports et la mutation `apply`, ajouter `previewReplace`**

Remplacer :

```ts
import {
  applySuggestionsCore,
  generateSuggestionsCore,
  suggestionsStatusCore,
} from "../lib/suggest-categories-core";
```

par :

```ts
import {
  applySuggestionsCore,
  generateSuggestionsCore,
  previewReplaceCore,
  suggestionsStatusCore,
} from "../lib/suggest-categories-core";
```

Remplacer :

```ts
    // Crée les catégories/sous-catégories validées et relance la catégorisation.
    apply: protectedProcedure
      .input(z.object({ suggestions: z.array(categorySuggestionSchema) }))
      .mutation(({ input }) => applySuggestionsCore(input.suggestions)),
```

par :

```ts
    // Aperçu en lecture seule de ce que ferait le mode "replace" : quelles
    // catégories existantes seraient supprimées vs conservées (corrections
    // manuelles). Utilisé par la dialog de confirmation côté UI.
    previewReplace: protectedProcedure
      .input(z.object({ suggestions: z.array(categorySuggestionSchema) }))
      .query(({ input }) => previewReplaceCore(input.suggestions)),

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

- [ ] **Step 2: Exporter le type `ReplacePlan`**

Dans `packages/api/src/index.ts`, remplacer :

```ts
export type {
  CategorySuggestion,
  CategorySuggestionChild,
} from "./lib/suggest-categories-schema";
```

par :

```ts
export type {
  CategorySuggestion,
  CategorySuggestionChild,
} from "./lib/suggest-categories-schema";
export type { ReplacePlan } from "./lib/category-replace-plan";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @budget/api build`
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/router/categories.ts packages/api/src/index.ts
git commit -m "feat(api): expose mode on suggestions.apply and add suggestions.previewReplace"
```

---

### Task 4: UI — toggle de mode, aperçu serveur, confirmation destructive

**Files:**
- Modify: `apps/tanstack-start/src/component/category-suggestions.tsx` (fichier entier)

Pas de changement dans `apps/tanstack-start/src/routes/_authed/categories.tsx` : `SuggestionsWorkspace` garde exactement sa signature actuelle (`{ data: ReadyStatus }`), l'aperçu vient d'une query dédiée, pas d'une prop supplémentaire à faire descendre depuis la route.

**Interfaces:**
- Consumes: `ReplacePlan` from `@budget/api` (type-only) ; `trpcClient.categories.suggestions.previewReplace.query({ suggestions })` et `trpcClient.categories.suggestions.apply.mutate({ suggestions, mode })` (Task 3).

- [ ] **Step 1: Réécrire `category-suggestions.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import type { CategorySuggestion, ReplacePlan, TxnForAnalysis } from "@budget/api";
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

export function SuggestionsWorkspace({ data }: { data: ReadyStatus }) {
  const trpcClient = useTRPCClient();
  const navigate = Route.useNavigate();
  const [tree, setTree] = useState<EditableParent[]>(() =>
    toEditable(data.suggestions),
  );
  const [mode, setMode] = useState<ApplyMode>("merge");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [replacePreview, setReplacePreview] = useState<ReplacePlan | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    txns: TxnForAnalysis[];
  } | null>(null);

  const sampleById = new Map(data.sample.map((txn) => [txn.id, txn]));

  const payload: CategorySuggestion[] = tree
    .map((p) => ({
      parent: p.name.trim(),
      enfants: p.children
        .filter((c) => c.enabled && c.name.trim().length > 0)
        .map((c) => ({ name: c.name.trim(), txnIds: c.txnIds })),
    }))
    .filter((p) => p.parent.length > 0 && p.enfants.length > 0);

  // L'aperçu du mode "replace" vient toujours du serveur (previewReplace,
  // même fonction computeReplacePlan que l'apply réel) — jamais recalculé
  // ici, pour ne jamais afficher un diff qui pourrait diverger de ce qui
  // sera réellement exécuté. Ne se déclenche qu'à l'ouverture de la dialog,
  // pas à chaque frappe pendant l'édition de l'arbre.
  useEffect(() => {
    if (mode !== "replace" || !confirmOpen) {
      setReplacePreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    trpcClient.categories.suggestions.previewReplace
      .query({ suggestions: payload })
      .then((plan) => {
        if (!cancelled) setReplacePreview(plan);
      })
      .catch(() => {
        if (!cancelled) setReplacePreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payload est recalculé à chaque rendu, comparer par contenu suffit ici (petit nombre de catégories)
  }, [mode, confirmOpen, JSON.stringify(payload), trpcClient]);

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

  const confirmDisabled =
    applying || (mode === "replace" && (previewLoading || !replacePreview));

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
              {mode === "replace" && previewLoading && (
                <> Calcul de l'impact en cours…</>
              )}
              {mode === "replace" && replacePreview && (
                <>
                  {replacePreview.namesToDelete.length > 0 && (
                    <>
                      {" "}
                      {replacePreview.namesToDelete.length} catégorie(s)
                      existante(s) seront supprimées :{" "}
                      {replacePreview.namesToDelete.join(", ")}.
                    </>
                  )}
                  {replacePreview.namesKept.length > 0 && (
                    <>
                      {" "}
                      {replacePreview.namesKept.length} catégorie(s) seront
                      conservées malgré tout car elles contiennent des
                      corrections manuelles : {replacePreview.namesKept.join(", ")}.
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
              disabled={confirmDisabled}
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

Note : `payload` et `sampleById` ne sont plus mémoïsés (`useMemo`) — le fichier original les mémoïsait, mais l'arbre (`tree`) est un état local édité à la main par l'utilisateur (pas de rendu à haute fréquence, pas de liste longue), donc le recalcul à chaque rendu est négligeable ; ça retire deux `useMemo` et leurs tableaux de dépendances à maintenir. Si un profilage futur montre un problème réel, on pourra les réintroduire à ce moment-là.

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @budget/tanstack-start typecheck`
Expected: no TypeScript errors.

- [ ] **Step 3: Test manuel dans l'app**

Run: `pnpm -F @budget/tanstack-start dev` (nécessite `docker compose up -d` et `POSTGRES_URL` déjà configurés, voir CLAUDE.md).

Sur `http://localhost:3000/categories` :
1. Générer une suggestion ("Suggérer des catégories"), vérifier que le toggle "Fusionner / Remplacer" s'affiche, "Fusionner" actif par défaut.
2. Cliquer "Remplacer" : le bandeau d'avertissement destructif apparaît, le bouton principal passe en style destructif et son libellé devient "Remplacer".
3. Ouvrir la confirmation : vérifier "Calcul de l'impact en cours…" bref puis la liste des catégories supprimées/conservées (comparer avec `CategoryOverviewTree` plus bas sur la même page — en particulier une catégorie qui a des transactions corrigées manuellement doit apparaître dans "conservées", pas "supprimées").
4. Revenir en "Fusionner" et confirmer que le comportement (texte, bouton, absence de bandeau) redevient identique à avant ce changement.
5. Appliquer en mode "Fusionner" une fois pour confirmer la non-régression du flux existant (toast "X catégorie(s) créée(s)", redirection vers `/`).

- [ ] **Step 4: Commit**

```bash
git add apps/tanstack-start/src/component/category-suggestions.tsx
git commit -m "feat(tanstack-start): add replace mode toggle with server-computed diff preview"
```

---

## Self-Review Notes

- **Spec coverage :** mode fusion/remplacement (Task 2-3), reparentage des catégories existantes matchées (Task 2, `reparentIfExists`), protection bottom-up des transactions manuelles (Task 1, `computeReplacePlan`), aperçu du diff avant confirmation (Task 3-4, `previewReplace` — désormais calculé une seule fois côté serveur, jamais dupliqué côté client), style destructif + toast détaillé (Task 4), transaction DB atomique (Task 2, `db.transaction`), tests `computeReplacePlan`/`flattenProposedNames` (Task 1) — tous les points du spec du 2026-07-25 sont couverts. Le cas limite "deux catégories convergent vers un même nom" et le hors-scope "renommage automatique par le LLM" restent volontairement non gérés, comme documenté dans le spec.
- **Simplifications appliquées suite à revue** (par rapport à une première esquisse de ce plan) : (1) suppression de la duplication client/serveur de l'algorithme de décision — le frontend appelle désormais une query `previewReplace` au lieu de recalculer localement, ce qui a aussi rendu inutile l'extension de `categories.overview` et le passage d'une prop `overviewTree` à travers la route (une tâche entière en moins) ; (2) `applySuggestionsCore` découpé en petites fonctions nommées (`fetchExistingWithManualCounts`, `deleteCategoriesInPlan`) au lieu d'un seul bloc de ~80 lignes, réutilisées telles quelles par `previewReplaceCore`.
- **Type consistency :** `ApplyMode`, `ApplySuggestionsResult`, `ExistingCategoryForReplace`, `ReplacePlan`, `computeReplacePlan`, `flattenProposedNames` utilisés à l'identique entre Task 1/2/3/4 — un seul jeu de types, une seule implémentation, pas de nom parallèle à surveiller côté frontend.
- **Correction post-implémentation (Task 2) :** la première version de ce plan plaçait le calcul du plan + la suppression AVANT la boucle d'upsert. L'implémenteur de la Task 2 a détecté que cet ordre peut violer la contrainte de clé étrangère `categories.parent_id -> categories.id` : une catégorie conservée mais reparentée par la proposition pointe encore, en base, vers son ancien parent au moment où celui-ci est supprimé (l'upsert qui la reparente n'a pas encore tourné). Corrigé en déplaçant le bloc `if (mode === "replace")` (snapshot + `computeReplacePlan` + `deleteCategoriesInPlan`) après la boucle d'upsert — voir le code ci-dessus (Task 2, Step 2-3), déjà à jour.
