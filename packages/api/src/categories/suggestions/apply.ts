// Application en base d'une branche proposée : création de la catégorie
// manquante, puis rangement de ses transactions encore sans catégorie.
import { and, eq, inArray, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";

import { ownedByOrganization } from "../../transactions/queries";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Strictement additif : une catégorie déjà existante n'est **jamais** touchée,
// ni reparentée ni recoloriée. C'est la promesse de l'écran — accepter une
// branche ne remet rien en question de ce qui est déjà rangé. Le reparentage
// n'appartenait qu'au mode "replace" d'`applySuggestions`, supprimé le
// 2026-08-18 (voir CLAUDE.md).
//
// `color` : `undefined` signifie « ne pose pas cet attribut » — toujours le cas
// pour une sous-catégorie, qui n'a pas de couleur propre et hérite
// visuellement de son parent.
async function upsertCategory(
  tx: DbOrTx,
  organizationId: string,
  name: string,
  parentId: number | null,
  color?: string | null,
): Promise<number> {
  const [inserted] = await tx
    .insert(categories)
    .values({
      organizationId,
      name,
      parentId,
      ...(color !== undefined ? { color } : {}),
    })
    // Cible composite depuis que le nom n'est unique que dans l'espace : sur
    // `categories.name` seul, l'insertion ne verrait aucun conflit et une
    // seconde « Alimentation » naîtrait dans le même foyer.
    .onConflictDoNothing({
      target: [categories.organizationId, categories.name],
    })
    .returning({ id: categories.id });
  if (inserted) return inserted.id;

  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.organizationId, organizationId),
        eq(categories.name, name),
      ),
    );
  if (!existing) {
    throw new Error(`Impossible de créer la catégorie « ${name} ».`);
  }
  return existing.id;
}

export interface AcceptSuggestionResult {
  parentCreated: boolean;
  childCreated: boolean;
  transactionsCategorized: number;
}

// Accepte UNE proposition (une sous-catégorie sous un parent), telle que la
// page /categories la pose dans la liste. C'est le **seul** chemin d'écriture
// des suggestions depuis la suppression d'`applySuggestions` et de son mode
// "replace" (2026-08-18) : purement additif, sans passe LLM, sans remise à zéro
// d'aucun classement. Toute variante qui restructurerait l'arborescence est à
// écrire ailleurs et à assumer comme telle.
//
// Ce que fait celle-ci, et rien d'autre :
//  - crée le parent s'il manque (jamais de recoloration d'un parent existant,
//    sa teinte est un choix de l'utilisateur) ;
//  - crée la sous-catégorie sous ce parent si elle manque ; si une catégorie
//    de ce nom existe déjà ailleurs, elle est réutilisée telle quelle, jamais
//    reparentée en douce ;
//  - range les transactions listées **et encore sans catégorie**. Le garde
//    `IS NULL` est ce qui rend vrai le « 0 transaction déjà classée touchée » :
//    l'échantillon analysé contient aussi des transactions déjà rangées (voir
//    sampleTransactions), et une correction manuelle a toujours une catégorie.
//
// `category_source = 'auto'` : rangement déterministe (les identifiants sont
// énumérés, aucun appel LLM ici), que `categorizeUncategorized` ne reprend pas —
// son garde `IS NULL` l'en écarte.
export async function acceptSuggestion(
  organizationId: string,
  parent: string,
  parentColor: string,
  child: { name: string; txnIds: number[] },
): Promise<AcceptSuggestionResult> {
  return db.transaction(async (tx) => {
    const before = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.organizationId, organizationId));
    const beforeIds = new Set(before.map((c) => c.id));

    const parentId = await upsertCategory(
      tx,
      organizationId,
      parent,
      null,
      parentColor,
    );
    const childId = await upsertCategory(
      tx,
      organizationId,
      child.name,
      parentId,
    );

    // `txnIds` vient de la proposition, donc du client : le périmètre de
    // l'espace s'ajoute au garde `IS NULL`, sinon une liste forgée rangerait
    // les transactions d'un autre foyer dans cette sous-catégorie.
    const categorized =
      child.txnIds.length === 0
        ? []
        : await tx
            .update(transactions)
            .set({ categoryId: childId, categorySource: "auto" })
            .where(
              and(
                inArray(transactions.id, child.txnIds),
                isNull(transactions.categoryId),
                ownedByOrganization(organizationId),
              ),
            )
            .returning({ id: transactions.id });

    return {
      parentCreated: !beforeIds.has(parentId),
      childCreated: !beforeIds.has(childId),
      transactionsCategorized: categorized.length,
    };
  });
}
