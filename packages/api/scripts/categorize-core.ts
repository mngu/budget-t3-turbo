// Logique pure de catégorisation — testable sans DB ni API.

import { z } from "zod/v4";

import type { SimilarTxn } from "../src/lib/similar-transactions";

export interface TxnForLlm {
  id: number;
  description: string;
  counterparty: string | null;
  direction: "debit" | "credit";
  amount: string;
  currency: string;
  bankName: string;
  bankCode: string | null;
  mcc: string | null;
}

export const BATCH_SIZE = 50;
// Lot plus petit pour la catégorisation few-shot : chaque transaction embarque
// ses propres exemples similaires, le prompt est donc bien plus volumineux par lot.
export const FEW_SHOT_BATCH_SIZE = 10;

export function chunkTransactions<T>(items: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function buildSystemPrompt(categoryNames: string[]): string {
  return `Tu catégorises des transactions bancaires personnelles pour le budget d'un ménage français.
Les comptes appartiennent à Alex Martin et Camille Durand (banques : Société Générale, Caisse d'Épargne Île-de-France, Revolut).

Pour chaque transaction, choisis exactement une catégorie parmi :
${categoryNames.map((c) => `- ${c}`).join("\n")}

Règles :
- Un virement entre ses propres comptes (libellé mentionnant son propre nom, ex. « VIR SEPA M ALEX MARTIN ») → « Apport Alex ».
- Salaire et autres revenus entrants → « Revenus ».
- Quand des transactions similaires déjà catégorisées sont fournies, classe par analogie avec elles en priorité.
- En cas de doute, réponds « Autres » — n'invente jamais.

Réponds pour chaque transaction avec son id et sa catégorie.`;
}

export function buildUserMessage(batch: TxnForLlm[]): string {
  return JSON.stringify(batch);
}

function formatSimilarTxn(s: SimilarTxn): string {
  const signe = s.direction === "debit" ? "-" : "+";
  const contrepartie = s.counterparty ? ` (${s.counterparty})` : "";
  return `- "${s.description}"${contrepartie}, ${signe}${s.amount} → ${s.categoryName}`;
}

// Prompt par transaction pour la catégorisation few-shot : injecte les
// transactions similaires déjà catégorisées comme exemples, ou retombe
// silencieusement sur le prompt générique si aucune n'a été trouvée.
export function buildFewShotPrompt(
  transaction: TxnForLlm,
  similars: SimilarTxn[],
): string {
  const similarSection =
    similars.length > 0
      ? `Transactions similaires déjà catégorisées :\n${similars.map(formatSimilarTxn).join("\n")}\n\n`
      : "";
  return `${similarSection}Nouvelle transaction à catégoriser :\n${JSON.stringify(transaction)}`;
}

// Message utilisateur pour un micro-lot few-shot : un bloc par transaction,
// chacun avec ses propres exemples similaires.
export function buildFewShotUserMessage(
  batch: TxnForLlm[],
  similarsByTxnId: Map<number, SimilarTxn[]>,
): string {
  return batch
    .map((txn) => buildFewShotPrompt(txn, similarsByTxnId.get(txn.id) ?? []))
    .join("\n\n---\n\n");
}

// Ne valide que la forme (id + categorie en chaîne) : un z.enum(categoryNames)
// ferait planter le parsing structured-output de tout le lot dès qu'une
// réponse cite une catégorie hors liste (ex. une catégorie mentionnée dans le
// prompt métier — « Autres », « Apport Alex » — qui n'existe plus après un
// remplacement d'arborescence), au lieu d'ignorer juste cette transaction.
// Le filtrage réel se fait dans filterValidResults, après un parsing qui ne
// peut plus échouer pour cette raison.
export function buildCategorizationOutputSchema() {
  return z.object({
    resultats: z.array(
      z.object({
        id: z.number().int(),
        categorie: z.string(),
      }),
    ),
  });
}

// Court-circuit déterministe : si au moins 2 transactions similaires partagent
// la même contrepartie ET la même catégorie, on peut appliquer directement
// sans appeler le LLM. Retourne le nom de la catégorie ou null.
export function resolveShortcut(
  similars: SimilarTxn[],
): string | null {
  const byCounterparty = new Map<string, Map<string, number>>();
  for (const s of similars) {
    if (!s.counterparty) continue;
    let catCounts = byCounterparty.get(s.counterparty);
    if (!catCounts) {
      catCounts = new Map();
      byCounterparty.set(s.counterparty, catCounts);
    }
    catCounts.set(s.categoryName, (catCounts.get(s.categoryName) ?? 0) + 1);
  }
  for (const [, catCounts] of byCounterparty) {
    for (const [catName, count] of catCounts) {
      if (count >= 2) return catName;
    }
  }
  return null;
}

// Défense en profondeur derrière les structured outputs : ids hors lot ou
// catégories hors liste connue sont ignorés plutôt que de corrompre la base.
export function filterValidResults(
  resultats: { id: number; categorie: string }[],
  batchIds: Set<number>,
  categoryNames: string[],
): { id: number; categorie: string }[] {
  return resultats.filter(
    (r) => batchIds.has(r.id) && categoryNames.includes(r.categorie),
  );
}
