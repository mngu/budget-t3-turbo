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
  chunkTransactions,
  FEW_SHOT_BATCH_SIZE,
  filterValidResults,
} from "./categorize-core";

// tsx ne charge pas .env tout seul (même logique que src/db/client.ts).
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env absent : la variable doit venir de l'environnement
  }
}

export async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠️  ANTHROPIC_API_KEY absente (.env) — catégorisation sautée.",
    );
    return;
  }

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);
  if (categoryRows.length === 0) {
    console.warn("⚠️  Table categories vide — catégorisation sautée.");
    return;
  }
  const categoryNames = categoryRows.map((c) => c.name);
  const categoryIdByName = new Map(categoryRows.map((c) => [c.name, c.id]));
  const systemPrompt = buildSystemPrompt(categoryNames);
  const categorizationOutputSchema =
    buildCategorizationOutputSchema(categoryNames);

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
    return;
  }
  console.log(`🏷️  ${rows.length} transactions à catégoriser…`);

  const client = new Anthropic();
  let categorized = 0;

  try {
    for (const batch of chunkTransactions(rows, FEW_SHOT_BATCH_SIZE)) {
      const similarsByTxnId = new Map<number, SimilarTxn[]>(
        await Promise.all(
          batch.map(async (txn) => [txn.id, await findSimilar(txn)] as const),
        ),
      );
      const response = await client.messages.parse({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: buildFewShotUserMessage(batch, similarsByTxnId),
          },
        ],
        output_config: { format: zodOutputFormat(categorizationOutputSchema) },
      });

      if (!response.parsed_output) {
        console.warn(
          `   ⚠️  lot sans sortie exploitable (stop_reason: ${response.stop_reason}) — ignoré`,
        );
        continue;
      }

      const batchIds = new Set(batch.map((t) => t.id));
      const valid = filterValidResults(
        response.parsed_output.resultats,
        batchIds,
        categoryNames,
      );

      for (const { id, categorie } of valid) {
        const categoryId = categoryIdByName.get(categorie);
        if (categoryId === undefined) continue;
        // Le garde IS NULL protège les futures corrections manuelles.
        await db
          .update(transactions)
          .set({ categoryId, categorySource: "llm" })
          .where(and(eq(transactions.id, id), isNull(transactions.categoryId)));
      }
      categorized += valid.length;
      console.log(`   ${categorized}/${rows.length}…`);
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(
        `⚠️  Erreur API Claude (${err.message}) — catégorisation interrompue, relancez npm run categorize.`,
      );
    } else {
      throw err; // erreur DB ou bug → exit 1
    }
  }

  const [row] = await db
    .select({ remaining: count() })
    .from(transactions)
    .where(isNull(transactions.categoryId));
  console.log(
    `✅ ${categorized} catégorisées, ${row?.remaining ?? 0} restantes.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    });
}
