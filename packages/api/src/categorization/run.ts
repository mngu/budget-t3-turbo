// Catégorisation LLM des transactions non catégorisées (category_id IS NULL).
// Best-effort : sans clé API ou en cas d'erreur API, avertissement et retour
// normal — l'import ne doit jamais échouer à cause de la catégorisation.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { and, count, eq, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, categories, transactions } from "@budget/db/schema";

import type { TxnForLlm } from "./prompt";
import type { SimilarTxn } from "./similar";
import { withSingleFlight } from "../lib/single-flight";
import { buildFewShotUserMessage, buildSystemPrompt } from "./prompt";
import {
  buildCategorizationOutputSchema,
  partitionResults,
  resolveShortcut,
} from "./results";
import { findSimilar, loadDiscriminativeBankCodes } from "./similar";

export interface CategorizeResult {
  categorized: number;
  remaining: number;
}

async function remainingUncategorizedCount(): Promise<number> {
  const [row] = await db
    .select({ remaining: count() })
    .from(transactions)
    .where(isNull(transactions.categoryId));
  return row?.remaining ?? 0;
}

async function runCategorization(): Promise<CategorizeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠️  ANTHROPIC_API_KEY absente (.env) — catégorisation sautée.",
    );
    return { categorized: 0, remaining: await remainingUncategorizedCount() };
  }

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);
  if (categoryRows.length === 0) {
    console.warn("⚠️  Table categories vide — catégorisation sautée.");
    return { categorized: 0, remaining: await remainingUncategorizedCount() };
  }
  const categoryNames = categoryRows.map((c) => c.name);
  const categoryIdByName = new Map(categoryRows.map((c) => [c.name, c.id]));
  const systemPrompt = buildSystemPrompt(categoryNames);
  const categorizationOutputSchema = buildCategorizationOutputSchema();

  const rows: TxnForLlm[] = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      counterparty: transactions.counterparty,
      direction: transactions.direction,
      amount: transactions.amount,
      currency: transactions.currency,
      bankName: accounts.bankName,
      bankCode: transactions.bankCode,
      mcc: transactions.mcc,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(isNull(transactions.categoryId));

  if (rows.length === 0) {
    console.log("✅ Rien à catégoriser.");
    return { categorized: 0, remaining: 0 };
  }
  console.log(`🏷️  ${rows.length} transactions à catégoriser…`);

  // Étape 1 : recherche des similaires pour toutes les transactions (parallèle).
  // La pureté des bank_code est calculée une seule fois pour tout le run.
  const discriminativeBankCodes = await loadDiscriminativeBankCodes();
  const similarsByTxnId = new Map<number, SimilarTxn[]>(
    await Promise.all(
      rows.map(
        async (txn) =>
          [txn.id, await findSimilar(txn, discriminativeBankCodes)] as const,
      ),
    ),
  );

  let categorized = 0;

  // Étape 2 : court-circuit déterministe (match fort).
  const llmRows: TxnForLlm[] = [];
  for (const txn of rows) {
    const similars = similarsByTxnId.get(txn.id) ?? [];
    const shortcut = resolveShortcut(similars);
    if (shortcut !== null) {
      const categoryId = categoryIdByName.get(shortcut);
      if (categoryId !== undefined) {
        await db
          .update(transactions)
          .set({ categoryId, categorySource: "auto" as const })
          .where(
            and(eq(transactions.id, txn.id), isNull(transactions.categoryId)),
          );
        categorized++;
      }
    } else {
      llmRows.push(txn);
    }
  }
  if (categorized > 0) {
    console.log(`   ${categorized} court-circuitées (déterministe)`);
  }

  // Étape 3 : un seul appel LLM pour toutes les transactions sans match fort.
  if (llmRows.length > 0) {
    console.log(`   🤖 ${llmRows.length} soumises au LLM…`);
    const client = new Anthropic();

    try {
      const response = await client.messages.parse({
        model: "claude-haiku-4-5",
        max_tokens: 16384,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: buildFewShotUserMessage(llmRows, similarsByTxnId),
          },
        ],
        output_config: { format: zodOutputFormat(categorizationOutputSchema) },
      });

      if (response.parsed_output) {
        const llmIds = new Set(llmRows.map((t) => t.id));
        const { valid, declined, rejected } = partitionResults(
          response.parsed_output.resultats,
          llmIds,
          categoryNames,
        );

        for (const { id, categorie } of valid) {
          const categoryId = categoryIdByName.get(categorie);
          if (categoryId === undefined) continue;
          await db
            .update(transactions)
            .set({ categoryId, categorySource: "llm" })
            .where(
              and(eq(transactions.id, id), isNull(transactions.categoryId)),
            );
        }
        categorized += valid.length;

        if (declined.length > 0) {
          console.log(
            `   ${declined.length} laissées sans catégorie (aucune catégorie existante ne convient) — lancez l'analyse de suggestions depuis /categories.`,
          );
        }
        // Ne jamais avaler ce cas en silence : une catégorie inconnue renvoyée
        // par le LLM signale un prompt désaligné avec l'arborescence en base.
        if (rejected.length > 0) {
          console.warn(
            `   ⚠️  ${rejected.length} réponses ignorées (id hors lot ou catégorie inconnue) : ${rejected
              .map((r) => `${r.id}→${r.categorie ?? "null"}`)
              .join(", ")}`,
          );
        }
      } else {
        console.warn(
          `   ⚠️  sortie LLM non exploitable (stop_reason: ${response.stop_reason})`,
        );
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        console.warn(
          `⚠️  Erreur API Claude (${err.message}) — catégorisation interrompue, relancez-la depuis /categories.`,
        );
      } else {
        throw err;
      }
    }
  }

  const remaining = await remainingUncategorizedCount();
  console.log(`✅ ${categorized} catégorisées, ${remaining} restantes.`);
  return { categorized, remaining };
}

// Idempotent (garde `IS NULL` partout) : relancer est toujours sûr. Sérialisé
// pour ne pas soumettre deux fois les mêmes transactions au LLM — la
// catégorisation lancée par le pipeline de sync passe par le même verrou.
export async function categorizeUncategorized(): Promise<CategorizeResult> {
  return withSingleFlight(
    "categorize",
    "Une catégorisation est déjà en cours.",
    runCategorization,
  );
}
