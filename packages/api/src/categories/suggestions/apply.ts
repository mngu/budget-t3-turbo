// Application en base d'une arborescence proposée (création/reparentage, et en
// mode "replace" suppression du reste), puis re-catégorisation.
import { and, eq, inArray, isNull, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";

import type { ExistingCategoryForReplace, ReplacePlan } from "./replace-plan";
import type { CategorySuggestion } from "./schema";
import { categorizeUncategorized } from "../../categorization/run";
import { ownedByOrganization } from "../../transactions/queries";
import { computeReplacePlan, flattenProposedNames } from "./replace-plan";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// `reparentIfExists` : en mode "replace", une catégorie déjà existante et
// présente dans la proposition doit adopter le `parentId` (et la `color`,
// pour un parent) de la nouvelle arborescence (vraie restructuration) ; en
// mode "merge", on ne touche jamais à une catégorie déjà existante
// (comportement additif inchangé).
// `color` : `undefined` signifie "ne jamais toucher cet attribut" (toujours
// le cas pour une sous-catégorie, qui n'a pas de couleur propre — voir
// transactionsRouter, elle hérite visuellement de son parent) ; une valeur
// fournie (toujours le cas pour un parent) est posée à la création et, en
// mode "replace", mise à jour si elle diffère.
async function upsertCategory(
  tx: DbOrTx,
  organizationId: string,
  name: string,
  parentId: number | null,
  reparentIfExists: boolean,
  color?: string | null,
): Promise<number> {
  const [inserted] = await tx
    .insert(categories)
    .values({
      organizationId,
      name,
      parentId,
      ...(color !== undefined ? { color } : {}),
    })
    // Cible composite depuis que le nom n'est unique que dans l'espace : sur
    // `categories.name` seul, l'insertion ne verrait aucun conflit et une
    // seconde « Alimentation » naîtrait dans le même foyer.
    .onConflictDoNothing({
      target: [categories.organizationId, categories.name],
    })
    .returning({ id: categories.id });
  if (inserted) return inserted.id;

  const [existing] = await tx
    .select({
      id: categories.id,
      parentId: categories.parentId,
      color: categories.color,
    })
    .from(categories)
    .where(
      and(
        eq(categories.organizationId, organizationId),
        eq(categories.name, name),
      ),
    );
  if (!existing) {
    throw new Error(`Impossible de créer la catégorie « ${name} ».`);
  }
  if (reparentIfExists) {
    const patch: Partial<{ parentId: number | null; color: string | null }> =
      {};
    if (existing.parentId !== parentId) patch.parentId = parentId;
    if (color !== undefined && existing.color !== color) patch.color = color;
    if (Object.keys(patch).length > 0) {
      await tx
        .update(categories)
        .set(patch)
        .where(eq(categories.id, existing.id));
    }
  }
  return existing.id;
}

// Snapshot des catégories existantes + nombre de transactions manuelles par
// catégorie — base de calcul de computeReplacePlan. Utilisé à la fois en
// lecture seule (previewReplace, via `db`) et dans la transaction
// d'application (applySuggestions, via `tx`).
async function fetchExistingWithManualCounts(
  tx: DbOrTx,
  organizationId: string,
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
    .where(eq(categories.organizationId, organizationId))
    .groupBy(categories.id);
}

// Exécute la suppression décidée par computeReplacePlan : reset des
// transactions concernées (aucune manuelle par construction du plan), puis
// suppression cascade enfants-avant-parents (contrainte de clé étrangère
// categories.parent_id -> categories.id). `existing` doit être le snapshot
// post-upsert : une catégorie gardée/reparentée a donc déjà quitté le
// parent sur le point d'être supprimé (sinon la suppression violerait la
// FK, ce parent étant encore référencé). Une catégorie à supprimer est par
// construction absente de la proposition, donc jamais touchée par
// l'upsert — récupérer le snapshot après l'upsert garantit qu'aucune ligne
// vivante ne pointe plus vers elle.
async function deleteCategoriesInPlan(
  tx: DbOrTx,
  existing: ExistingCategoryForReplace[],
  plan: ReplacePlan,
): Promise<void> {
  if (plan.idsToDelete.length === 0) return;

  const toDelete = existing.filter((c) => plan.idsToDelete.includes(c.id));
  const childIds = toDelete.filter((c) => c.parentId !== null).map((c) => c.id);
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
export async function previewReplace(
  organizationId: string,
  suggestions: CategorySuggestion[],
): Promise<ReplacePlan> {
  const existing = await fetchExistingWithManualCounts(db, organizationId);
  return computeReplacePlan(existing, flattenProposedNames(suggestions));
}

export interface AcceptSuggestionResult {
  parentCreated: boolean;
  childCreated: boolean;
  transactionsCategorized: number;
}

// Accepte UNE proposition (une sous-catégorie sous un parent), telle que la
// page /categories la pose dans la liste. Volontairement séparée
// d'`applySuggestions` et non un appel de celle-ci sur un tableau à un
// élément : `applySuggestions` remet à NULL *toutes* les transactions à
// `category_source = 'llm'` puis relance une passe LLM complète (voir plus
// bas). Un « Ajouter » par proposition passant par là coûterait une passe
// entière et défausserait le classement de toute la base — l'inverse de ce que
// l'écran promet (« rien de ce qui est déjà rangé n'est remis en question »).
//
// Ce que fait celle-ci, et rien d'autre :
//  - crée le parent s'il manque (jamais de recoloration d'un parent existant,
//    sa teinte est un choix de l'utilisateur) ;
//  - crée la sous-catégorie sous ce parent si elle manque ; si une catégorie
//    de ce nom existe déjà ailleurs, elle est réutilisée telle quelle, jamais
//    reparentée en douce ;
//  - range les transactions listées **et encore sans catégorie**. Le garde
//    `IS NULL` est ce qui rend vrai le « 0 transaction déjà classée touchée » :
//    l'échantillon analysé contient aussi des transactions déjà rangées (voir
//    sampleTransactions), et une correction manuelle a toujours une catégorie.
//
// `category_source = 'auto'` : rangement déterministe (les identifiants sont
// énumérés, aucun appel LLM ici). Ni repris par `categorizeUncategorized` (garde
// `IS NULL`), ni remis à zéro par un `applySuggestions` ultérieur, qui ne vise
// que 'llm'.
export async function acceptSuggestion(
  organizationId: string,
  parent: string,
  parentColor: string,
  child: { name: string; txnIds: number[] },
): Promise<AcceptSuggestionResult> {
  return db.transaction(async (tx) => {
    const before = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.organizationId, organizationId));
    const beforeIds = new Set(before.map((c) => c.id));

    const parentId = await upsertCategory(
      tx,
      organizationId,
      parent,
      null,
      false,
      parentColor,
    );
    const childId = await upsertCategory(
      tx,
      organizationId,
      child.name,
      parentId,
      false,
    );

    // `txnIds` vient de la proposition, donc du client : le périmètre de
    // l'espace s'ajoute au garde `IS NULL`, sinon une liste forgée rangerait
    // les transactions d'un autre foyer dans cette sous-catégorie.
    const categorized =
      child.txnIds.length === 0
        ? []
        : await tx
            .update(transactions)
            .set({ categoryId: childId, categorySource: "auto" })
            .where(
              and(
                inArray(transactions.id, child.txnIds),
                isNull(transactions.categoryId),
                ownedByOrganization(organizationId),
              ),
            )
            .returning({ id: transactions.id });

    return {
      parentCreated: !beforeIds.has(parentId),
      childCreated: !beforeIds.has(childId),
      transactionsCategorized: categorized.length,
    };
  });
}

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
export async function applySuggestions(
  organizationId: string,
  suggestions: CategorySuggestion[],
  mode: ApplyMode = "merge",
): Promise<ApplySuggestionsResult> {
  const result = await db.transaction(async (tx) => {
    const proposedNames = flattenProposedNames(suggestions);

    const before = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.organizationId, organizationId));
    const beforeIds = new Set(before.map((c) => c.id));

    let categoriesDeleted = 0;
    let categoriesKept = 0;

    for (const { parent, parentColor, enfants } of suggestions) {
      const parentId = await upsertCategory(
        tx,
        organizationId,
        parent,
        null,
        mode === "replace",
        parentColor,
      );
      for (const enfant of enfants) {
        await upsertCategory(
          tx,
          organizationId,
          enfant.name,
          parentId,
          mode === "replace",
        );
      }
    }

    if (mode === "replace") {
      const existing = await fetchExistingWithManualCounts(tx, organizationId);
      const plan = computeReplacePlan(existing, proposedNames);
      categoriesKept = plan.namesKept.length;
      categoriesDeleted = plan.idsToDelete.length;
      await deleteCategoriesInPlan(tx, existing, plan);
    }

    const after = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.organizationId, organizationId));
    const categoriesCreated = after.filter((c) => !beforeIds.has(c.id)).length;
    const totalUpserts = suggestions.reduce(
      (n, s) => n + 1 + s.enfants.length,
      0,
    );

    await tx
      .update(transactions)
      .set({ categoryId: null, categorySource: null })
      .where(
        and(
          eq(transactions.categorySource, "llm"),
          ownedByOrganization(organizationId),
        ),
      );

    return {
      categoriesCreated,
      categoriesReused: totalUpserts - categoriesCreated,
      categoriesDeleted,
      categoriesKept,
    };
  });

  try {
    await categorizeUncategorized(organizationId);
  } catch (err) {
    console.error(
      "⚠️  Re-catégorisation après application des suggestions échouée :",
      err,
    );
  }

  return result;
}
