// Analyse LLM des transactions pour proposer une arborescence de catégories.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { count, desc, eq, gte } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, categories, transactions } from "@budget/db/schema";

import type { CategorySuggestion } from "./suggest-categories-schema";
import { main as runCategorize } from "../../scripts/categorize";
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
    model: "claude-sonnet-5",
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
