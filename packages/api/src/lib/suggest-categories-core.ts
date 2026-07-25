// Analyse LLM des transactions pour proposer une arborescence de catégories.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { count, desc, eq, gte, inArray, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, categories, transactions } from "@budget/db/schema";

import type {
  ExistingCategoryForReplace,
  ReplacePlan,
} from "./category-replace-plan";
import type { CategorySuggestion } from "./suggest-categories-schema";
import { main as runCategorize } from "../../scripts/categorize";
import {
  computeReplacePlan,
  flattenProposedNames,
} from "./category-replace-plan";
import { categorySuggestionsSchema } from "./suggest-categories-schema";

export interface TxnForAnalysis {
  id: number;
  description: string;
  counterparty: string | null;
  amount: string;
  direction: "debit" | "credit";
  bankName: string;
  mcc: string | null;
}

export const SAMPLE_LIMIT = 500;
export const SAMPLE_WINDOW_MONTHS = 6;

// Date ISO (YYYY-MM-DD) de début de fenêtre d'échantillonnage.
export function sampleWindowStart(
  now: Date,
  months = SAMPLE_WINDOW_MONTHS,
): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

// Échantillon représentatif : transactions des 6 derniers mois (tous comptes),
// triées par date décroissante, plafonné à SAMPLE_LIMIT.
export async function sampleTransactions(
  limit = SAMPLE_LIMIT,
): Promise<TxnForAnalysis[]> {
  const since = sampleWindowStart(new Date());
  return db
    .select({
      id: transactions.id,
      description: transactions.description,
      counterparty: transactions.counterparty,
      amount: transactions.amount,
      direction: transactions.direction,
      bankName: accounts.bankName,
      mcc: transactions.mcc,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(gte(transactions.bookingDate, since))
    .orderBy(desc(transactions.bookingDate))
    .limit(limit);
}

export function buildAnalysisPrompt(txns: TxnForAnalysis[]): string {
  return `Tu analyses les habitudes de dépense d'un ménage français à partir de ${txns.length} transactions bancaires réelles (comptes Société Générale, Caisse d'Épargne Île-de-France, Revolut).

Propose une arborescence de catégories budgétaires à 2 niveaux (catégories parentes et sous-catégories) qui reflète fidèlement ces transactions — pas une liste générique.

Règles :
- Chaque catégorie parente doit avoir entre 2 et 8 sous-catégories.
- Les noms sont courts, en français, sans jargon bancaire.
- Regroupe par usage réel (ex. distinguer « Courses » de « Livraison » si les deux apparaissent nettement).
- Ignore les transactions trop rares ou ambiguës pour former une sous-catégorie dédiée ; elles resteront dans une catégorie générique.
- Pour chaque sous-catégorie, liste dans "txnIds" les identifiants ("id") de toutes les transactions de l'échantillon qui en relèvent. Une transaction n'appartient qu'à une seule sous-catégorie.

Transactions (JSON) :
${JSON.stringify(txns)}`;
}

export async function analyzeAndSuggest(
  txns: TxnForAnalysis[],
): Promise<CategorySuggestion[]> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system:
      "Tu es un expert en catégorisation budgétaire pour les finances personnelles.",
    messages: [{ role: "user", content: buildAnalysisPrompt(txns) }],
    output_config: { format: zodOutputFormat(categorySuggestionsSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      `Analyse sans sortie exploitable (stop_reason: ${response.stop_reason}).`,
    );
  }
  return response.parsed_output.categories;
}

export interface SuggestionsRun {
  generatedAt: Date;
  totalTransactionsAtRun: number;
  suggestions: CategorySuggestion[];
  // Échantillon analysé, conservé pour que l'UI résolve txnIds → transactions
  // (compteurs, drawer de prévisualisation) sans re-catégoriser au préalable.
  sample: TxnForAnalysis[];
}

// État en mémoire du dernier run — pas de table dédiée pour ce MVP mono-utilisateur ;
// se réinitialise au redémarrage du serveur (acceptable, il suffit de relancer l'analyse).
let lastRun: SuggestionsRun | null = null;

async function transactionsTotal(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(transactions);
  return row?.total ?? 0;
}

export async function generateSuggestionsCore(): Promise<SuggestionsRun> {
  const sample = await sampleTransactions();
  const suggestions = await analyzeAndSuggest(sample);
  const totalTransactionsAtRun = await transactionsTotal();
  lastRun = {
    generatedAt: new Date(),
    totalTransactionsAtRun,
    suggestions,
    sample,
  };
  return lastRun;
}

export interface SuggestionsStatus {
  exists: boolean;
  generatedAt: Date | null;
  newTransactionsCount: number;
  suggestions: CategorySuggestion[] | null;
  sample: TxnForAnalysis[] | null;
}

export async function suggestionsStatusCore(): Promise<SuggestionsStatus> {
  if (!lastRun) {
    return {
      exists: false,
      generatedAt: null,
      newTransactionsCount: 0,
      suggestions: null,
      sample: null,
    };
  }
  const total = await transactionsTotal();
  return {
    exists: true,
    generatedAt: lastRun.generatedAt,
    newTransactionsCount: Math.max(0, total - lastRun.totalTransactionsAtRun),
    suggestions: lastRun.suggestions,
    sample: lastRun.sample,
  };
}

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
// categories.parent_id -> categories.id). `existing` doit être le snapshot
// pré-upsert : les catégories à supprimer sont par construction absentes de
// la proposition, donc jamais reparentées par l'upsert, leur parentId reste
// fiable à ce stade.
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
export async function previewReplaceCore(
  suggestions: CategorySuggestion[],
): Promise<ReplacePlan> {
  const existing = await fetchExistingWithManualCounts(db);
  return computeReplacePlan(existing, flattenProposedNames(suggestions));
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
export async function applySuggestionsCore(
  suggestions: CategorySuggestion[],
  mode: ApplyMode = "merge",
): Promise<ApplySuggestionsResult> {
  const result = await db.transaction(async (tx) => {
    const proposedNames = flattenProposedNames(suggestions);

    const before = await tx.select({ id: categories.id }).from(categories);
    const beforeIds = new Set(before.map((c) => c.id));

    let categoriesDeleted = 0;
    let categoriesKept = 0;

    if (mode === "replace") {
      const existing = await fetchExistingWithManualCounts(tx);
      const plan = computeReplacePlan(existing, proposedNames);
      categoriesKept = plan.namesKept.length;
      categoriesDeleted = plan.idsToDelete.length;
      await deleteCategoriesInPlan(tx, existing, plan);
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
    const categoriesCreated = after.filter((c) => !beforeIds.has(c.id)).length;
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
