// Catégorisation des transactions sans catégorie de l'espace, en deux temps :
// une transaction déjà catégorisée qui lui ressemble (même contrepartie ou
// libellé proche) donne sa catégorie sans appel ; sinon le LLM choisit parmi
// les catégories de l'espace, avec les ressemblances trouvées en exemples.
// Idempotente (garde `IS NULL` partout) et sérialisée par espace.
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

// Ce que le LLM voit d'une transaction : la banque et la contrepartie y
// sont, aucune identité n'est codée dans le prompt.
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
// Calibré sur les données réelles : en dessous de 0,5 deux libellés partagent
// la même catégorie parente à peine plus souvent que le hasard (le boilerplate
// « CB … FACT … » suffit à atteindre 0,4) ; au-delà de 0,6, deux fois sur
// trois. Le premier seuil admet un exemple, le second autorise à classer sans
// LLM - une ligne classée devient elle-même exemple au run suivant, une
// erreur d'autorité se propagerait.
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

// Même espace (un exemple d'un autre foyer serait une fuite et un mauvais
// indice) et même sens : un remboursement et un achat chez la même enseigne
// ne vont pas dans la même catégorie. La similarité prime sur la source, mais
// entre candidats d'une même bande (arrondi à 0,1) une correction manuelle
// passe devant - mesuré : trier manuel d'abord faisait tomber le meilleur
// exemple de 91 % à 70 % de bonne catégorie parente.
//
// `coalesce(…, false)` sur les deux booléens : Postgres refuse une constante
// dans ORDER BY (contrepartie nulle), et un NULL passerait en tête d'un tri
// DESC.
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

// Court-circuit : les candidats sûrs (même contrepartie, ou libellé au-dessus
// du seuil haut) sont unanimes. Un seul suffit ; un désaccord passe au LLM.
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

// Le prompt ne connaît que les catégories réellement en base : une règle qui
// en citerait une absente faisait répondre hors liste, et la ligne restait
// sans catégorie pour toujours.
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

// Ne valide que la forme : un z.enum(categoryNames) ferait échouer le parsing
// de tout le lot dès qu'une réponse cite une catégorie hors liste. Le tri
// réel est dans `validResults`. `null` est la réponse légitime quand rien ne
// convient - sans elle le LLM est contraint d'inventer un nom.
const outputSchema = z.object({
  resultats: z.array(
    z.object({ id: z.number().int(), categorie: z.string().nullable() }),
  ),
});

// Défense en profondeur derrière les structured outputs : rien qui ne soit
// pas une catégorie de l'espace, sur une ligne du lot, n'atteint la base.
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
  // Lots séquentiels : un lot écrit ses résultats avant que le suivant parte,
  // un échec au quatrième garde les trois premiers.
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
