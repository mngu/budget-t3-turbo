// Budgets mensuels par catégorie — écran /settings/categories.
//
// Un budget est un montant mensuel posé sur une catégorie, sans dimension de
// mois : `set` écrase, rien à versionner. Une parente peut être « détaillée » :
// ce sont alors ses sous-catégories qui portent les montants et son budget
// **est** leur somme — elle n'en garde aucun à elle (CHECK
// `categories_detailed_no_amount`), ce qui rend l'invariant vrai par
// construction plutôt que par un trigger.
import { and, eq, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { categories } from "@budget/db/schema";

/**
 * Bascule Global / Détaillé d'une parente. Passer en détaillé **efface** son
 * montant global : le CHECK l'exige, et c'est ce qui garantit que son budget
 * affiché est toujours la somme de ses enfants. L'aller-retour ne le rend donc
 * pas — les montants des enfants, eux, dorment en base et reviennent.
 *
 * Le `parent_id IS NULL` a la même raison qu'`updateCategoryIcon` : le drapeau
 * n'a aucun sens sur une sous-catégorie, et posé là il lui effacerait son
 * montant.
 */
export async function setCategoryDetailed(
  organizationId: string,
  categoryId: number,
  detailed: boolean,
): Promise<void> {
  const updated = await db
    .update(categories)
    .set({ budgetDetailed: detailed, ...(detailed && { budgetAmount: null }) })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
        isNull(categories.parentId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie parente introuvable.");
}

// Le `WHERE` porte l'espace : un id venu du client et appartenant à un autre
// foyer ne touche aucune ligne. Un `UPDATE` à zéro ligne ne lève pas, d'où le
// `returning` — l'écran attend une confirmation.
export async function setCategoryBudget(
  organizationId: string,
  categoryId: number,
  amount: number | null,
): Promise<void> {
  const value = amount === null ? null : amount.toFixed(2);
  const updated = await db
    .update(categories)
    .set({
      budgetAmount: value,
      // Poser un montant sur une catégorie, c'est dire qu'elle porte son propre
      // budget : le drapeau tombe avec. Sans ça une parente détaillée puis
      // vidée de ses sous-catégories reste `detailed` en base alors que l'écran
      // la rend globale — son champ accepte la saisie et le CHECK la refuse, et
      // la bascule est hors de portée (l'entrée de menu est cachée sans
      // sous-catégorie). Vider un montant, lui, ne dé-détaille rien.
      ...(value !== null && { budgetDetailed: false }),
    })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie introuvable.");
}
