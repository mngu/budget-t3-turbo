// Analyse LLM d'un échantillon de transactions pour proposer une arborescence
// de catégories. N'écrit rien en base — voir apply.ts pour l'application.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { alias, and, desc, eq, gte, isNotNull, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, categories, transactions } from "@budget/db/schema";
import {
  CATEGORY_COLOR_HEXES,
  CATEGORY_COLOR_PALETTE,
  FALLBACK_CATEGORY_COLOR,
} from "@budget/shared";

import type { CategoryTreeNode } from "../queries";
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
  // Catégorie actuelle de la transaction, `null` si elle n'est pas encore
  // classée. C'est le signal qui permet au LLM de distinguer « déjà couvert »
  // de « réellement manquant », et surtout de voir les noms existants écrits
  // au caractère près, transaction après transaction — la liste de
  // l'arborescence seule ne suffisait pas à ancrer la réutilisation verbatim.
  category: string | null;
  // Parente de `category` — `null` quand la transaction est rattachée
  // directement à une parente (« à classer ») ou n'a pas de catégorie.
  parentCategory: string | null;
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

// Part maximale de l'échantillon réservée aux transactions sans catégorie.
// Ce plafond n'est pas cosmétique : le LLM propose une arborescence complète
// qui, en mode "replace", devient la vérité (voir apply.ts). S'il ne voyait que
// les orphelines, il proposerait un arbre ne couvrant qu'elles et "replace"
// supprimerait tout le reste — computeReplacePlan ne protège que les
// corrections manuelles. Le contexte déjà catégorisé doit rester majoritaire.
export const UNCATEGORIZED_SAMPLE_SHARE = 0.3;

// Deux alias sur `categories` : la catégorie portée par la transaction, et sa
// parente (l'arborescence n'a que 2 niveaux, un seul niveau de remontée suffit).
const txnCategory = alias(categories, "txn_category");
const txnParentCategory = alias(categories, "txn_parent_category");

const analysisColumns = {
  id: transactions.id,
  description: transactions.description,
  counterparty: transactions.counterparty,
  amount: transactions.amount,
  direction: transactions.direction,
  bankName: accounts.bankName,
  mcc: transactions.mcc,
  category: txnCategory.name,
  parentCategory: txnParentCategory.name,
};

// Jointures communes aux deux moitiés de l'échantillon : la moitié « sans
// catégorie » ne ramène que des `null` sur les deux dernières colonnes, mais
// garder une seule forme de ligne évite de reconstruire les colonnes à la main.
function analysisQuery() {
  return db
    .select(analysisColumns)
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(txnCategory, eq(transactions.categoryId, txnCategory.id))
    .leftJoin(txnParentCategory, eq(txnCategory.parentId, txnParentCategory.id));
}

// Échantillon stratifié, plafonné à SAMPLE_LIMIT :
//   1. les transactions sans catégorie — sans fenêtre de date, une orpheline
//      ancienne reste un trou de l'arborescence — dans la limite de
//      UNCATEGORIZED_SAMPLE_SHARE ;
//   2. complété par les transactions récentes déjà catégorisées, qui donnent
//      au LLM le contexte des habitudes réelles.
// Sans l'étape 1, les orphelines (aujourd'hui ~2 % des lignes) seraient diluées
// puis évincées dès que le volume dépasse la limite : la boucle « la
// catégorisation classe avec l'existant, les suggestions créent ce qui manque »
// ne se refermerait jamais.
export async function sampleTransactions(
  limit = SAMPLE_LIMIT,
): Promise<TxnForAnalysis[]> {
  const since = sampleWindowStart(new Date());

  const uncategorized = await analysisQuery()
    .where(isNull(transactions.categoryId))
    .orderBy(desc(transactions.bookingDate))
    .limit(Math.floor(limit * UNCATEGORIZED_SAMPLE_SHARE));

  const categorized = await analysisQuery()
    .where(
      and(
        isNotNull(transactions.categoryId),
        gte(transactions.bookingDate, since),
      ),
    )
    .orderBy(desc(transactions.bookingDate))
    .limit(limit - uncategorized.length);

  // Les deux requêtes sont disjointes (IS NULL / IS NOT NULL) : pas de doublon.
  return [...uncategorized, ...categorized];
}

const CATEGORY_COLOR_PROMPT_LIST = CATEGORY_COLOR_PALETTE.map(
  (c) => `- ${c.name} (${c.light})`,
).join("\n");

// Rendu de l'arborescence réelle pour le prompt : une ligne par parente, avec
// sa couleur actuelle et ses sous-catégories. C'est la référence des noms que
// le LLM doit réutiliser au caractère près.
function formatExistingTree(tree: CategoryTreeNode[]): string {
  return tree
    .map((parent) => {
      const children =
        parent.children.length > 0
          ? parent.children.map((c) => `« ${c.name} »`).join(", ")
          : "aucune sous-catégorie pour l'instant";
      const color = parent.color ? ` [${parent.color}]` : "";
      return `- « ${parent.name} »${color} : ${children}`;
    })
    .join("\n");
}

// L'arborescence réelle est passée au LLM pour deux raisons distinctes : lui
// faire réutiliser les noms existants au lieu d'en inventer des variantes
// (« Transports » à côté d'un « Transport » existant, qui devient une seconde
// parente en base — `categories.name` est unique mais sensible à la casse et
// aux accents, donc rien ne l'empêche), et lui faire garder la couleur déjà
// choisie pour une parente existante.
//
// La réponse attendue reste l'arborescence **complète**, jamais un delta :
// `applySuggestions` en mode "replace" traite la proposition comme la nouvelle
// vérité et supprime tout ce qui en est absent (voir apply.ts). Une proposition
// réduite aux nouveautés y deviendrait un bouton de suppression de masse.
export function buildAnalysisPrompt(
  txns: TxnForAnalysis[],
  tree: CategoryTreeNode[],
): string {
  const existingSection =
    tree.length === 0
      ? `Aucune catégorie n'existe encore : l'arborescence est à créer entièrement.`
      : `Arborescence actuelle, à reprendre comme base (${tree.length} catégorie(s) parente(s)) :
${formatExistingTree(tree)}`;

  return `Tu analyses les habitudes de dépense d'un ménage français à partir de ${txns.length} transactions bancaires réelles (comptes Société Générale, Caisse d'Épargne Île-de-France, Revolut).

Propose une arborescence de catégories budgétaires à 2 niveaux (catégories parentes et sous-catégories) qui reflète fidèlement ces transactions — pas une liste générique.

${existingSection}

Règles :
- **Réutilise les noms existants au caractère près.** Quand une catégorie de l'arborescence actuelle couvre déjà un concept, reprends son nom exactement tel quel : mêmes accents, même casse, même singulier/pluriel. Proposer « Transports » alors que « Transport » existe, ou « Sante » alors que « Santé » existe, est une erreur — cela crée une catégorie en double au lieu d'enrichir l'existante. N'invente un nom que pour ce qu'aucune catégorie existante ne décrit.
- **Décris l'arborescence complète**, pas seulement tes ajouts : les catégories existantes que tu conserves doivent figurer dans ta réponse, avec leurs sous-catégories.
- Chaque transaction porte sa catégorie actuelle dans "category" (et sa parente dans "parentCategory"), ou "null" si elle n'est pas encore classée. Les transactions à "null" sont le principal indice de ce qui manque à l'arborescence.
- Chaque catégorie parente doit avoir entre 2 et 8 sous-catégories.
- Les noms sont courts, en français, sans jargon bancaire.
- Regroupe par usage réel (ex. distinguer « Courses » de « Livraison » si les deux apparaissent nettement).
- Ignore les transactions trop rares ou ambiguës pour former une sous-catégorie dédiée ; elles resteront dans une catégorie générique.
- Pour chaque sous-catégorie, liste dans "txnIds" les identifiants ("id") de toutes les transactions de l'échantillon qui en relèvent. Une transaction n'appartient qu'à une seule sous-catégorie.
- Pour chaque catégorie parente (jamais les sous-catégories), choisis dans "parentColor" le code hexadécimal de la couleur qui lui correspond le mieux, parmi cette liste exclusivement :
${CATEGORY_COLOR_PROMPT_LIST}
  Une catégorie parente qui existe déjà garde la couleur indiquée entre crochets ci-dessus. Pour une nouvelle parente, essaie de choisir une couleur encore inutilisée.

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
  tree: CategoryTreeNode[],
): Promise<CategorySuggestion[]> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system:
      "Tu es un expert en catégorisation budgétaire pour les finances personnelles.",
    messages: [{ role: "user", content: buildAnalysisPrompt(txns, tree) }],
    output_config: { format: zodOutputFormat(rawCategorySuggestionsSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      `Analyse sans sortie exploitable (stop_reason: ${response.stop_reason}).`,
    );
  }
  return sanitizeSuggestionColors(response.parsed_output.categories);
}
