// Analyse LLM d'un échantillon de transactions pour proposer une arborescence
// de catégories. N'écrit rien en base — voir apply.ts pour l'application.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { desc, eq, gte } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, transactions } from "@budget/db/schema";
import {
  CATEGORY_COLOR_HEXES,
  CATEGORY_COLOR_PALETTE,
  FALLBACK_CATEGORY_COLOR,
} from "@budget/validators";

import type { CategorySuggestion, RawCategorySuggestion } from "./schema";
import { rawCategorySuggestionsSchema } from "./schema";

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
// Attention : le filtre ne porte que sur la date — les transactions déjà
// catégorisées comme celles laissées sans catégorie y figurent, sans priorité
// pour ces dernières (voir le commentaire de buildSystemPrompt côté
// categorization/prompt.ts, qui compte sur ce process pour combler les trous).
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

const CATEGORY_COLOR_PROMPT_LIST = CATEGORY_COLOR_PALETTE.map(
  (c) => `- ${c.name} (${c.hex})`,
).join("\n");

export function buildAnalysisPrompt(txns: TxnForAnalysis[]): string {
  return `Tu analyses les habitudes de dépense d'un ménage français à partir de ${txns.length} transactions bancaires réelles (comptes Société Générale, Caisse d'Épargne Île-de-France, Revolut).

Propose une arborescence de catégories budgétaires à 2 niveaux (catégories parentes et sous-catégories) qui reflète fidèlement ces transactions — pas une liste générique.

Règles :
- Chaque catégorie parente doit avoir entre 2 et 8 sous-catégories.
- Les noms sont courts, en français, sans jargon bancaire.
- Regroupe par usage réel (ex. distinguer « Courses » de « Livraison » si les deux apparaissent nettement).
- Ignore les transactions trop rares ou ambiguës pour former une sous-catégorie dédiée ; elles resteront dans une catégorie générique.
- Pour chaque sous-catégorie, liste dans "txnIds" les identifiants ("id") de toutes les transactions de l'échantillon qui en relèvent. Une transaction n'appartient qu'à une seule sous-catégorie.
- Pour chaque catégorie parente (jamais les sous-catégories), choisis dans "parentColor" le code hexadécimal de la couleur qui lui correspond le mieux, parmi cette liste exclusivement :
${CATEGORY_COLOR_PROMPT_LIST}
  Essaie d'utiliser une couleur différente pour chaque catégorie parente de cette proposition.

Transactions (JSON) :
${JSON.stringify(txns)}`;
}

// Ramène la couleur brute renvoyée par le LLM à un membre valide de
// CATEGORY_COLOR_HEXES — jamais une contrainte au niveau du schéma structured
// output (voir rawCategorySuggestionSchema), pour ne jamais faire planter le
// parsing de toute l'analyse à cause d'une seule couleur invalide. Repli
// déterministe (cycle sur la palette par index) plutôt qu'aléatoire, pour un
// résultat stable et testable.
export function sanitizeSuggestionColors(
  raw: RawCategorySuggestion[],
): CategorySuggestion[] {
  return raw.map((suggestion, index) => ({
    ...suggestion,
    parentColor: CATEGORY_COLOR_HEXES.includes(suggestion.parentColor)
      ? suggestion.parentColor
      : (CATEGORY_COLOR_HEXES[index % CATEGORY_COLOR_HEXES.length] ??
        FALLBACK_CATEGORY_COLOR),
  }));
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
    output_config: { format: zodOutputFormat(rawCategorySuggestionsSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      `Analyse sans sortie exploitable (stop_reason: ${response.stop_reason}).`,
    );
  }
  return sanitizeSuggestionColors(response.parsed_output.categories);
}
