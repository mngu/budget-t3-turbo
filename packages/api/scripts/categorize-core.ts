// Logique pure de catégorisation — testable sans DB ni API.

import { z } from "zod/v4";

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
- En cas de doute, réponds « Autres » — n'invente jamais.

Réponds pour chaque transaction avec son id et sa catégorie.`;
}

export function buildUserMessage(batch: TxnForLlm[]): string {
  return JSON.stringify(batch);
}

export function buildCategorizationOutputSchema(categoryNames: string[]) {
  return z.object({
    resultats: z.array(
      z.object({
        id: z.number().int(),
        categorie: z.enum(categoryNames as [string, ...string[]]),
      }),
    ),
  });
}

// Défense en profondeur derrière les structured outputs : ids hors lot ou
// catégories hors liste connue sont ignorés plutôt que de corrompre la base.
export function filterValidResults(
  resultats: { id: number; categorie: string }[],
  batchIds: Set<number>,
  categoryNames: string[],
): { id: number; categorie: string }[] {
  return resultats.filter((r) => batchIds.has(r.id) && categoryNames.includes(r.categorie));
}
