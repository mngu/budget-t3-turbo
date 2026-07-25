#!/usr/bin/env tsx
// Catégorisation LLM des transactions non catégorisées (category_id IS NULL).
// Best-effort : sans clé API ou en cas d'erreur API, warning + exit 0
// (l'import ne doit jamais échouer à cause de la catégorisation).
// Usage : npm run categorize
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { and, count, eq, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, categories, transactions } from "@budget/db/schema";

import type { SimilarTxn } from "../src/lib/similar-transactions";
import type { TxnForLlm } from "./categorize-core";
import { findSimilar } from "../src/lib/similar-transactions";
import {
  buildCategorizationOutputSchema,
  buildFewShotUserMessage,
  buildSystemPrompt,
  filterValidResults,
  resolveShortcut,
} from "./categorize-core";

// tsx ne charge pas .env tout seul (même logique que src/db/client.ts).
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env absent : la variable doit venir de l'environnement
  }
}

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

export async function main(): Promise<CategorizeResult> {
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
  const similarsByTxnId = new Map<number, SimilarTxn[]>(
    await Promise.all(
      rows.map(async (txn) => [txn.id, await findSimilar(txn)] as const),
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
        const valid = filterValidResults(
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
      } else {
        console.warn(
          `   ⚠️  sortie LLM non exploitable (stop_reason: ${response.stop_reason})`,
        );
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        console.warn(
          `⚠️  Erreur API Claude (${err.message}) — catégorisation interrompue, relancez npm run categorize.`,
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    });
}
