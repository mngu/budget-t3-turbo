import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

import { and, eq, isNull, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { transactions } from "@budget/db/schema";

import { withSingleFlight } from "./lib/single-flight";

export interface CategorizeResult {
  categorized: number;
  remaining: number;
}

const txnSchema = z.object({
  id: z.number().int(),
  description: z.string(),
  counterparty: z.string().nullable(),
  direction: z.enum(["debit", "credit"]),
  amount: z.string(),
  currency: z.string(),
  bankName: z.string(),
});
type Txn = z.infer<typeof txnSchema>;

const similarSchema = z.object({
  id: z.number().int(),
  description: z.string(),
  counterparty: z.string().nullable(),
  amount: z.string(),
  categoryName: z.string(),
  similarity: z.number(),
});
export type Similar = z.infer<typeof similarSchema>;

const SIMILAR_LIMIT = 5;
// Auto-assignment needs a stricter threshold than examples: assigned rows become
// future examples, so weak matches would propagate errors.
const EXAMPLE_THRESHOLD = 0.5;
const SHORTCUT_THRESHOLD = 0.7;
const LLM_BATCH_SIZE = 100;

async function uncategorized(organizationId: string): Promise<Txn[]> {
  const result = await db.execute(sql`
    SELECT t.id,
           t.description,
           t.counterparty,
           t.direction,
           t.amount,
           t.currency,
           ba.bank_name AS "bankName"
    FROM transactions t
    INNER JOIN bank_accounts ba ON t.account_id = ba.id
    WHERE ba.organization_id = ${organizationId}
      AND t.category_id IS NULL
      AND t.excluded = false
  `);
  return txnSchema.array().parse(result.rows);
}

// Keep examples in the same space and direction. Rank similarity before manual
// provenance; prioritizing manual corrections reduced matching accuracy.
// Coalesce nullable comparisons so NULL does not sort first under DESC.
async function findSimilar(
  organizationId: string,
  txn: Txn,
): Promise<Similar[]> {
  const result = await db.execute(sql`
    SELECT t.id,
           t.description,
           t.counterparty,
           t.amount,
           c.name AS "categoryName",
           similarity(t.description, ${txn.description}) AS similarity
    FROM transactions t
    INNER JOIN categories c ON t.category_id = c.id
    INNER JOIN bank_accounts ba ON t.account_id = ba.id
    WHERE ba.organization_id = ${organizationId}
      AND t.direction = ${txn.direction}
      AND t.id <> ${txn.id}
      AND (coalesce(t.counterparty = ${txn.counterparty}, false)
           OR similarity(t.description, ${txn.description}) > ${EXAMPLE_THRESHOLD})
    ORDER BY coalesce(t.counterparty = ${txn.counterparty}, false) DESC,
             round(similarity(t.description, ${txn.description})::numeric, 1) DESC,
             coalesce(t.category_source = 'manual', false) DESC,
             similarity(t.description, ${txn.description}) DESC
    LIMIT ${SIMILAR_LIMIT}
  `);
  return similarSchema.array().parse(result.rows);
}

// One safe candidate is enough; disagreement requires the LLM.
export function unanimousCategory(
  similars: Similar[],
  counterparty: string | null,
): string | null {
  const [first, ...rest] = similars
    .filter(
      (s) =>
        (counterparty !== null && s.counterparty === counterparty) ||
        s.similarity >= SHORTCUT_THRESHOLD,
    )
    .map((s) => s.categoryName);
  return first !== undefined && rest.every((n) => n === first) ? first : null;
}

// Never hard-code category names: only this space's actual categories are valid.
export function buildSystemPrompt(categoryNames: string[]): string {
  return `Tu catégorises des transactions bancaires personnelles pour le budget d'un ménage français.

Pour chaque transaction, choisis une catégorie parmi cette liste, et uniquement parmi celle-ci :
${categoryNames.map((c) => `- ${c}`).join("\n")}

Règles :
- N'invente jamais de catégorie : toute réponse hors de cette liste est ignorée.
- Les transactions similaires fournies sont des indices, pas une autorité. Ne classe par analogie que si la transaction est réellement de même nature (même contrepartie, même type d'opération) : des libellés qui se ressemblent ne suffisent pas.
- Une catégorie « à peu près » n'est pas une bonne réponse. Si la transaction relève d'un type de dépense ou de revenu absent de la liste, réponds null.
- La liste est incomplète par construction : répondre null est un résultat normal et utile.

Réponds pour chaque transaction avec son id et sa catégorie (ou null).`;
}

export function buildUserMessage(
  batch: Txn[],
  similarsByTxnId: Map<number, Similar[]>,
): string {
  return batch
    .map((txn) => {
      const similars = similarsByTxnId.get(txn.id) ?? [];
      const examples =
        similars.length > 0
          ? `Transactions similaires déjà catégorisées :\n${similars
              .map(
                (s) =>
                  `- "${s.description}"${s.counterparty ? ` (${s.counterparty})` : ""}, ${s.amount} → ${s.categoryName}`,
              )
              .join("\n")}\n\n`
          : "";
      return `${examples}Nouvelle transaction à catégoriser :\n${JSON.stringify(txn)}`;
    })
    .join("\n\n---\n\n");
}

// Validate names per result, not with an enum that would reject the whole batch.
// Null lets the model decline when no category fits.
const outputSchema = z.object({
  resultats: z.array(
    z.object({ id: z.number().int(), categorie: z.string().nullable() }),
  ),
});

export function validResults(
  resultats: { id: number; categorie: string | null }[],
  batchIds: Set<number>,
  categoryIdByName: Map<string, number>,
): { id: number; categoryId: number }[] {
  return resultats.flatMap(({ id, categorie }) => {
    const categoryId =
      categorie === null ? undefined : categoryIdByName.get(categorie);
    return batchIds.has(id) && categoryId !== undefined
      ? [{ id, categoryId }]
      : [];
  });
}

function setCategory(
  id: number,
  categoryId: number,
  categorySource: "auto" | "llm",
) {
  return db
    .update(transactions)
    .set({ categoryId, categorySource })
    .where(and(eq(transactions.id, id), isNull(transactions.categoryId)));
}

async function runCategorization(
  organizationId: string,
): Promise<CategorizeResult> {
  const rows = await uncategorized(organizationId);
  if (rows.length === 0) return { categorized: 0, remaining: 0 };

  const categoryRows = z
    .object({ id: z.number().int(), name: z.string() })
    .array()
    .parse(
      (
        await db.execute(sql`
          SELECT id, name FROM categories
          WHERE organization_id = ${organizationId}
        `)
      ).rows,
    );
  if (categoryRows.length === 0) {
    throw new Error("Créez d'abord des catégories.");
  }
  const categoryIdByName = new Map(categoryRows.map((c) => [c.name, c.id]));

  const similarsByTxnId = new Map(
    await Promise.all(
      rows.map(
        async (txn) =>
          [txn.id, await findSimilar(organizationId, txn)] as const,
      ),
    ),
  );

  let categorized = 0;
  const llmRows: Txn[] = [];
  for (const txn of rows) {
    const name = unanimousCategory(
      similarsByTxnId.get(txn.id) ?? [],
      txn.counterparty,
    );
    const categoryId = name === null ? undefined : categoryIdByName.get(name);
    if (categoryId === undefined) {
      llmRows.push(txn);
      continue;
    }
    await setCategory(txn.id, categoryId, "auto");
    categorized++;
  }

  if (llmRows.length > 0 && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      `${llmRows.length} transaction(s) demandent le LLM : ANTHROPIC_API_KEY est absente.`,
    );
  }
  const client = new Anthropic();
  const system = buildSystemPrompt([...categoryIdByName.keys()]);
  // Persist each batch before the next so later failures preserve earlier results.
  for (let i = 0; i < llmRows.length; i += LLM_BATCH_SIZE) {
    const batch = llmRows.slice(i, i + LLM_BATCH_SIZE);
    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system,
      messages: [
        { role: "user", content: buildUserMessage(batch, similarsByTxnId) },
      ],
      output_config: { format: zodOutputFormat(outputSchema) },
    });
    if (!response.parsed_output) {
      throw new Error(
        `Réponse du LLM inexploitable (stop_reason : ${response.stop_reason}).`,
      );
    }
    const valid = validResults(
      response.parsed_output.resultats,
      new Set(batch.map((t) => t.id)),
      categoryIdByName,
    );
    for (const { id, categoryId } of valid) {
      await setCategory(id, categoryId, "llm");
    }
    categorized += valid.length;
  }

  console.log(
    `🏷️  ${categorized} catégorisées, ${rows.length - categorized} restantes.`,
  );
  return { categorized, remaining: rows.length - categorized };
}

export async function categorizeUncategorized(
  organizationId: string,
): Promise<CategorizeResult> {
  return withSingleFlight(
    `categorize:${organizationId}`,
    "Une catégorisation est déjà en cours.",
    () => runCategorization(organizationId),
  );
}
