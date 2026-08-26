// Construction des prompts de catégorisation — pur, testable sans DB ni API.

import type { SimilarTxn } from "./similar";

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

// Le prompt ne s'appuie QUE sur les catégories réellement présentes en base :
// aucun nom de catégorie codé en dur ici (une règle citant une catégorie
// absente de la liste faisait répondre le LLM hors liste, et la transaction
// n'était jamais catégorisée). Combler les trous de l'arborescence n'est plus
// automatisé : une transaction qu'aucune catégorie ne décrit reste sans
// catégorie, et c'est à l'écran /settings/categories qu'on crée la branche
// manquante.
export function buildSystemPrompt(categoryNames: string[]): string {
  return `Tu catégorises des transactions bancaires personnelles pour le budget d'un ménage français.
Chaque transaction porte sa banque et sa contrepartie : aucune identité n'est codée ici.

Pour chaque transaction, choisis une catégorie parmi cette liste, et uniquement parmi celle-ci :
${categoryNames.map((c) => `- ${c}`).join("\n")}

Règles :
- N'invente jamais de catégorie : toute réponse hors de cette liste est ignorée.
- Les transactions similaires fournies sont des indices, pas une autorité. Ne classe par analogie que si la transaction est réellement de même nature (même contrepartie, même type d'opération) : des libellés qui se ressemblent ne suffisent pas.
- Une catégorie « à peu près » n'est pas une bonne réponse. Si la transaction relève d'un type de dépense ou de revenu absent de la liste, réponds null.
- La liste est incomplète par construction : répondre null est un résultat normal et utile. Ces transactions sont reprises par l'analyse qui propose de nouvelles catégories.

Réponds pour chaque transaction avec son id et sa catégorie (ou null).`;
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

// Message utilisateur pour un lot few-shot : un bloc par transaction, chacun
// avec ses propres exemples similaires.
export function buildFewShotUserMessage(
  batch: TxnForLlm[],
  similarsByTxnId: Map<number, SimilarTxn[]>,
): string {
  return batch
    .map((txn) => buildFewShotPrompt(txn, similarsByTxnId.get(txn.id) ?? []))
    .join("\n\n---\n\n");
}
